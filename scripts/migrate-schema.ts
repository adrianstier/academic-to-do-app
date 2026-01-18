#!/usr/bin/env tsx
/**
 * Schema Migration Script
 *
 * Migrates data from JSONB columns to normalized relational tables.
 * This script is safe to run multiple times - it tracks progress and resumes from where it left off.
 *
 * Usage:
 *   DRY_RUN=true npm run migrate:schema  # Preview changes
 *   npm run migrate:schema                # Run migration
 */

import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';

// Configuration
const BATCH_SIZE = 100;
const CONCURRENCY = 5;
const DRY_RUN = process.env.DRY_RUN === 'true';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MigrationProgress {
  id: string;
  table_name: string;
  total_records: number;
  migrated_records: number;
  started_at: string;
  completed_at?: string;
  status: 'in_progress' | 'completed' | 'failed';
  error_message?: string;
}

interface Todo {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subtasks?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments?: any[];
  assigned_to?: string;
  created_by: string;
}

// Initialize or get migration progress
async function getOrCreateProgress(tableName: string, totalRecords: number): Promise<MigrationProgress> {
  const { data: existing } = await supabase
    .from('schema_migration_status')
    .select('*')
    .eq('table_name', tableName)
    .single();

  if (existing) {
    console.log(`📊 Resuming migration for ${tableName}: ${existing.migrated_records}/${existing.total_records} records migrated`);
    return existing;
  }

  const newProgress: Partial<MigrationProgress> = {
    table_name: tableName,
    total_records: totalRecords,
    migrated_records: 0,
    started_at: new Date().toISOString(),
    status: 'in_progress',
  };

  const { data } = await supabase
    .from('schema_migration_status')
    .insert(newProgress)
    .select()
    .single();

  return data!;
}

// Update migration progress
async function updateProgress(id: string, migratedRecords: number, completed: boolean = false) {
  const updates: Partial<MigrationProgress> = {
    migrated_records: migratedRecords,
  };

  if (completed) {
    updates.completed_at = new Date().toISOString();
    updates.status = 'completed';
  }

  await supabase
    .from('schema_migration_status')
    .update(updates)
    .eq('id', id);
}

// Migrate subtasks for a single todo
async function migrateSubtasks(todo: Todo): Promise<void> {
  if (!todo.subtasks || todo.subtasks.length === 0) {
    return;
  }

  const subtasksToInsert = todo.subtasks.map((subtask, index) => ({
    id: subtask.id,
    todo_id: todo.id,
    text: subtask.text,
    completed: subtask.completed || false,
    priority: subtask.priority || 'medium',
    estimated_minutes: subtask.estimatedMinutes || null,
    display_order: index,
    created_at: new Date().toISOString(),
  }));

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would insert ${subtasksToInsert.length} subtasks for todo ${todo.id}`);
    return;
  }

  const { error } = await supabase
    .from('subtasks_v2')
    .upsert(subtasksToInsert, { onConflict: 'id' });

  if (error) {
    console.error(`  ❌ Failed to migrate subtasks for todo ${todo.id}:`, error);
    throw error;
  }
}

// Migrate attachments for a single todo
async function migrateAttachments(todo: Todo): Promise<void> {
  if (!todo.attachments || todo.attachments.length === 0) {
    return;
  }

  // Get user ID for uploaded_by
  const { data: uploadedByUser } = await supabase
    .from('users')
    .select('id')
    .eq('name', todo.attachments[0].uploaded_by || todo.created_by)
    .single();

  const attachmentsToInsert = todo.attachments.map((attachment) => ({
    id: attachment.id,
    todo_id: todo.id,
    file_name: attachment.file_name,
    file_type: attachment.file_type,
    file_size: attachment.file_size,
    mime_type: attachment.mime_type,
    storage_path: attachment.storage_path,
    uploaded_by: uploadedByUser?.id || null,
    uploaded_at: attachment.uploaded_at || new Date().toISOString(),
  }));

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would insert ${attachmentsToInsert.length} attachments for todo ${todo.id}`);
    return;
  }

  const { error } = await supabase
    .from('attachments_v2')
    .upsert(attachmentsToInsert, { onConflict: 'id' });

  if (error) {
    console.error(`  ❌ Failed to migrate attachments for todo ${todo.id}:`, error);
    throw error;
  }
}

// Migrate user assignment for a single todo
async function migrateUserAssignment(todo: Todo): Promise<void> {
  if (!todo.assigned_to) {
    return;
  }

  // Get user ID from name
  const { data: assignedUser } = await supabase
    .from('users')
    .select('id')
    .eq('name', todo.assigned_to)
    .single();

  if (!assignedUser) {
    console.warn(`  ⚠️  User not found for assignment: ${todo.assigned_to}`);
    return;
  }

  const assignment = {
    todo_id: todo.id,
    user_id: assignedUser.id,
  };

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would create assignment for todo ${todo.id} → user ${assignedUser.id}`);
    return;
  }

  const { error } = await supabase
    .from('user_assignments')
    .upsert(assignment, { onConflict: 'todo_id,user_id' });

  if (error && !error.message.includes('duplicate key')) {
    console.error(`  ❌ Failed to migrate assignment for todo ${todo.id}:`, error);
  }
}

// Migrate a single todo
async function migrateTodo(todo: Todo): Promise<void> {
  try {
    await Promise.all([
      migrateSubtasks(todo),
      migrateAttachments(todo),
      migrateUserAssignment(todo),
    ]);
  } catch (error) {
    console.error(`❌ Failed to migrate todo ${todo.id}:`, error);
    throw error;
  }
}

// Main migration function
async function runMigration() {
  console.log('\n🚀 Starting Schema Migration\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Concurrency: ${CONCURRENCY}\n`);

  // Get total number of todos
  const { count: totalTodos } = await supabase
    .from('todos')
    .select('*', { count: 'exact', head: true });

  if (!totalTodos) {
    console.log('✅ No todos to migrate');
    return;
  }

  console.log(`📊 Total todos to migrate: ${totalTodos}\n`);

  // Get or create migration progress
  const progress = await getOrCreateProgress('todos', totalTodos);

  // Calculate where to start
  let offset = progress.migrated_records;
  let migratedCount = progress.migrated_records;

  // Rate limiter for concurrency control
  const limit = pLimit(CONCURRENCY);

  while (offset < totalTodos) {
    const { data: todos, error } = await supabase
      .from('todos')
      .select('id, subtasks, attachments, assigned_to, created_by')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('❌ Failed to fetch todos:', error);
      throw error;
    }

    if (!todos || todos.length === 0) {
      break;
    }

    console.log(`\n📦 Processing batch ${Math.floor(offset / BATCH_SIZE) + 1} (${offset + 1}-${offset + todos.length} of ${totalTodos})`);

    // Process todos with concurrency limit
    const results = await Promise.allSettled(
      todos.map((todo) => limit(() => migrateTodo(todo)))
    );

    // Count successes
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    migratedCount += successful;
    offset += todos.length;

    console.log(`  ✅ Migrated: ${successful}/${todos.length} todos`);
    if (failed > 0) {
      console.log(`  ❌ Failed: ${failed}`);
    }

    // Update progress
    if (!DRY_RUN) {
      await updateProgress(progress.id, migratedCount, offset >= totalTodos);
    }

    console.log(`  📊 Total progress: ${migratedCount}/${totalTodos} (${Math.round((migratedCount / totalTodos) * 100)}%)`);
  }

  console.log('\n✅ Migration completed!\n');
  console.log(`📊 Final stats:`);
  console.log(`   Total todos: ${totalTodos}`);
  console.log(`   Migrated: ${migratedCount}`);
  console.log(`   Success rate: ${Math.round((migratedCount / totalTodos) * 100)}%\n`);

  if (DRY_RUN) {
    console.log('💡 This was a DRY RUN. No changes were made to the database.');
    console.log('   Run without DRY_RUN=true to perform the actual migration.\n');
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('✨ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
