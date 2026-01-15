#!/usr/bin/env npx tsx
/**
 * Restore Deleted Tasks from Activity Log
 *
 * This script recreates deleted tasks using data from the activity log.
 * NOTE: Only task TEXT is preserved. Subtasks, notes, attachments are NOT recoverable.
 *
 * Run with: npx tsx scripts/restore-deleted-tasks.ts
 * Dry run:  npx tsx scripts/restore-deleted-tasks.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Check for dry run flag
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('🔄 Restore Deleted Tasks from Activity Log\n');
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  // 1. Get all deleted task records from activity log
  console.log('\n📜 Fetching deleted task records...');
  const { data: deletedActivities, error: activityError } = await supabase
    .from('activity_log')
    .select('*')
    .eq('action', 'task_deleted')
    .order('created_at', { ascending: false });

  if (activityError) {
    console.error('❌ Error fetching activity log:', activityError.message);
    process.exit(1);
  }

  if (!deletedActivities || deletedActivities.length === 0) {
    console.log('✅ No deleted tasks found in activity log. Nothing to restore.');
    process.exit(0);
  }

  console.log(`  Found ${deletedActivities.length} deleted task records\n`);

  // 2. Check which tasks still exist (avoid duplicates)
  console.log('🔍 Checking for existing tasks...');
  const deletedIds = deletedActivities.map(a => a.todo_id).filter(Boolean);

  const { data: existingTodos } = await supabase
    .from('todos')
    .select('id')
    .in('id', deletedIds);

  const existingIds = new Set(existingTodos?.map(t => t.id) || []);

  // 3. Filter out tasks that already exist
  const tasksToRestore = deletedActivities.filter(a => !existingIds.has(a.todo_id));

  if (tasksToRestore.length === 0) {
    console.log('✅ All deleted tasks already exist in database. Nothing to restore.');
    process.exit(0);
  }

  console.log(`  Tasks to restore: ${tasksToRestore.length}\n`);

  // 4. Prepare tasks for insertion
  console.log('📝 Tasks to be restored:');
  const tasksToInsert = tasksToRestore.map((activity, i) => {
    const task = {
      id: activity.todo_id, // Use original ID
      text: activity.todo_text,
      completed: false,
      status: 'todo' as const,
      priority: 'medium' as const,
      created_at: new Date().toISOString(),
      created_by: activity.user_name || 'System',
      notes: `[RESTORED] Originally deleted on ${new Date(activity.created_at).toLocaleString()}`,
      subtasks: [],
      attachments: [],
    };

    console.log(`\n  ${i + 1}. "${task.text}"`);
    console.log(`     Original ID: ${task.id}`);
    console.log(`     Deleted by: ${activity.user_name} on ${new Date(activity.created_at).toLocaleString()}`);

    return task;
  });

  // 5. Insert restored tasks
  if (isDryRun) {
    console.log('\n\n⚠️  DRY RUN - Would have restored the above tasks');
    console.log('   Run without --dry-run to actually restore\n');
    process.exit(0);
  }

  console.log('\n\n🚀 Restoring tasks...');

  const { data: inserted, error: insertError } = await supabase
    .from('todos')
    .insert(tasksToInsert)
    .select();

  if (insertError) {
    console.error('❌ Error restoring tasks:', insertError.message);

    // Try inserting one by one to find the problem
    console.log('\n🔄 Attempting individual inserts...');
    let successCount = 0;
    let failCount = 0;

    for (const task of tasksToInsert) {
      const { error } = await supabase.from('todos').insert(task);
      if (error) {
        console.error(`  ❌ Failed to restore: "${task.text?.substring(0, 40)}..." - ${error.message}`);
        failCount++;
      } else {
        console.log(`  ✅ Restored: "${task.text?.substring(0, 40)}..."`);
        successCount++;
      }
    }

    console.log(`\n📊 Results: ${successCount} restored, ${failCount} failed`);
  } else {
    console.log(`\n✅ Successfully restored ${inserted?.length || 0} tasks!\n`);
  }

  // 6. Log the restoration activity
  console.log('📝 Logging restoration activity...');
  const restorationLogs = tasksToInsert.map(task => ({
    action: 'task_created',
    todo_id: task.id,
    todo_text: task.text,
    user_name: 'System',
    details: { restored_from_activity_log: true },
  }));

  const { error: logError } = await supabase
    .from('activity_log')
    .insert(restorationLogs);

  if (logError) {
    console.warn('⚠️  Warning: Could not log restoration activity:', logError.message);
  } else {
    console.log('  ✅ Activity logged\n');
  }

  console.log('='.repeat(60));
  console.log('🎉 Restoration complete!\n');
  console.log('⚠️  NOTE: Only task TEXT was restored.');
  console.log('   The following data could NOT be recovered:');
  console.log('   - Subtasks');
  console.log('   - Attachments');
  console.log('   - Original notes');
  console.log('   - Priority settings');
  console.log('   - Assignments\n');
}

main().catch(console.error);
