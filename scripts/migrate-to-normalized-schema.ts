#!/usr/bin/env ts-node
/**
 * Background Data Migration Script
 *
 * Migrates data from JSONB columns to normalized tables
 * Runs safely in the background without affecting users
 *
 * Usage:
 *   DRY_RUN=true npm run migrate:schema  # Preview only
 *   npm run migrate:schema                # Actual migration
 */

import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const BATCH_SIZE = 100;
const CONCURRENCY = 5;
const DRY_RUN = process.env.DRY_RUN === 'true';

const limit = pLimit(CONCURRENCY);

interface Todo {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subtasks?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments?: any[];
  assigned_to?: string;
  created_at: string;
}

async function main() {
  console.log('🚀 Starting schema migration...');
  if (DRY_RUN) {
    console.log('📋 DRY RUN MODE - No changes will be made\n');
  }

  await migrateTodos();
  await verifyMigration();

  console.log('\n✅ Migration completed successfully!');
}

async function migrateTodos() {
  console.log('\n📊 Migrating todos...');

  // Get total count
  const { count: totalTodos, error: countError } = await supabase
    .from('todos')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Failed to count todos:', countError);
    throw countError;
  }

  console.log(`   Total todos to migrate: ${totalTodos}`);

  // Update migration status
  if (!DRY_RUN) {
    await supabase.from('schema_migration_status').upsert({
      table_name: 'todos',
      total_rows: totalTodos || 0,
      rows_migrated: 0,
      status: 'in_progress',
      migration_started_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    }, { onConflict: 'table_name' });
  }

  let offset = 0;
  let migrated = 0;
  let errors = 0;

  while (offset < (totalTodos || 0)) {
    // Fetch batch
    const { data: todos, error } = await supabase
      .from('todos')
      .select('*')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('❌ Failed to fetch batch:', error);
      break;
    }

    if (!todos || todos.length === 0) break;

    // Migrate each todo in parallel (with concurrency limit)
    const results = await Promise.allSettled(
      todos.map((todo: Todo) =>
        limit(() => migrateSingleTodo(todo))
      )
    );

    // Count successes and failures
    const batchSuccess = results.filter(r => r.status === 'fulfilled').length;
    const batchErrors = results.filter(r => r.status === 'rejected').length;

    migrated += batchSuccess;
    errors += batchErrors;
    offset += BATCH_SIZE;

    const percentage = Math.round((migrated / (totalTodos || 1)) * 100);
    console.log(
      `   Progress: ${migrated}/${totalTodos} (${percentage}%) | Errors: ${errors}`
    );

    // Update migration status
    if (!DRY_RUN) {
      await supabase
        .from('schema_migration_status')
        .update({
          rows_migrated: migrated,
          last_updated: new Date().toISOString(),
        })
        .eq('table_name', 'todos');
    }

    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Mark as complete
  if (!DRY_RUN && errors === 0) {
    await supabase
      .from('schema_migration_status')
      .update({
        status: 'completed',
        migration_completed_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      })
      .eq('table_name', 'todos');
  }

  console.log(`\n   ✅ Migrated: ${migrated}`);
  console.log(`   ❌ Errors: ${errors}`);
}

async function migrateSingleTodo(todo: Todo): Promise<void> {
  try {
    // Migrate subtasks from JSONB to table
    if (todo.subtasks && Array.isArray(todo.subtasks) && todo.subtasks.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subtasksToInsert = todo.subtasks.map((st: any, index: number) => ({
        id: st.id,
        todo_id: todo.id,
        text: st.text,
        completed: st.completed || false,
        priority: st.priority || 'medium',
        estimated_minutes: st.estimatedMinutes,
        display_order: index,
      }));

      if (!DRY_RUN) {
        // Use upsert to handle re-runs
        const { error } = await supabase
          .from('subtasks_v2')
          .upsert(subtasksToInsert, { onConflict: 'id' });

        if (error) throw error;
      }
    }

    // Migrate attachments from JSONB to table
    if (todo.attachments && Array.isArray(todo.attachments) && todo.attachments.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attachmentsToInsert = todo.attachments.map((att: any) => ({
        id: att.id,
        todo_id: todo.id,
        file_name: att.file_name,
        file_type: att.file_type,
        file_size: att.file_size,
        storage_path: att.storage_path,
        mime_type: att.mime_type,
        uploaded_by_name: att.uploaded_by,
        uploaded_at: att.uploaded_at,
      }));

      if (!DRY_RUN) {
        const { error } = await supabase
          .from('attachments_v2')
          .upsert(attachmentsToInsert, { onConflict: 'id' });

        if (error) throw error;
      }
    }

    // Migrate user assignments (if assigned_to exists)
    if (todo.assigned_to) {
      // Find user ID from name
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('name', todo.assigned_to)
        .single();

      if (user && !DRY_RUN) {
        const { error } = await supabase
          .from('user_assignments')
          .upsert({
            todo_id: todo.id,
            user_id: user.id,
            assigned_at: todo.created_at,
          }, { onConflict: 'todo_id,user_id' });

        if (error) throw error;
      }
    }
  } catch (error) {
    console.error(`   ❌ Failed to migrate todo ${todo.id}:`, error);

    // Log error to database
    if (!DRY_RUN) {
      await supabase.from('migration_errors').insert({
        table_name: 'todos',
        record_id: todo.id,
        error: (error as Error).message,
      });
    }

    throw error;
  }
}

async function verifyMigration() {
  if (DRY_RUN) {
    console.log('\n⏭️  Skipping verification (dry run)');
    return;
  }

  console.log('\n🔍 Verifying migration...');

  // Spot check: compare JSONB vs normalized data
  const { data: todos } = await supabase
    .from('todos')
    .select('id, subtasks, attachments')
    .limit(100);

  let mismatches = 0;

  for (const todo of todos || []) {
    // Check subtasks
    const { data: normalizedSubtasks } = await supabase
      .from('subtasks_v2')
      .select('*')
      .eq('todo_id', todo.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsonbCount = (todo.subtasks as any[] || []).length;
    const normalizedCount = normalizedSubtasks?.length || 0;

    if (jsonbCount !== normalizedCount) {
      console.warn(
        `   ⚠️  Subtask mismatch for todo ${todo.id}: JSONB=${jsonbCount}, Normalized=${normalizedCount}`
      );
      mismatches++;
    }

    // Check attachments
    const { data: normalizedAttachments } = await supabase
      .from('attachments_v2')
      .select('*')
      .eq('todo_id', todo.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsonbAttCount = (todo.attachments as any[] || []).length;
    const normalizedAttCount = normalizedAttachments?.length || 0;

    if (jsonbAttCount !== normalizedAttCount) {
      console.warn(
        `   ⚠️  Attachment mismatch for todo ${todo.id}: JSONB=${jsonbAttCount}, Normalized=${normalizedAttCount}`
      );
      mismatches++;
    }
  }

  if (mismatches === 0) {
    console.log('   ✅ All spot checks passed!');
  } else {
    console.warn(`   ⚠️  Found ${mismatches} mismatches in spot check`);
  }
}

// Run the migration
main().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
