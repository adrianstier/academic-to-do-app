#!/usr/bin/env npx tsx
/**
 * Database Recovery Check Script
 *
 * This script helps identify deleted data and recovery options.
 * Run with: npx tsx scripts/db-recovery-check.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Database Recovery Check\n');
  console.log('='.repeat(60));

  // Get today's date at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // 1. Get current todos count
  console.log('\n📋 Current Todos:');
  const { data: todos, error: todosError } = await supabase
    .from('todos')
    .select('id, text, created_at, created_by, completed')
    .order('created_at', { ascending: false });

  let todaysTodos: typeof todos = [];

  if (todosError) {
    console.error('  Error fetching todos:', todosError.message);
  } else {
    console.log(`  Total todos in database: ${todos?.length || 0}`);

    // Show recent todos
    console.log('\n  Recent todos (last 10):');
    todos?.slice(0, 10).forEach((todo, i) => {
      const status = todo.completed ? '✓' : '○';
      const date = new Date(todo.created_at).toLocaleString();
      console.log(`    ${i + 1}. [${status}] ${todo.text?.substring(0, 50)}...`);
      console.log(`       Created: ${date} by ${todo.created_by}`);
    });

    // Show todos created today
    todaysTodos = todos?.filter(t => new Date(t.created_at) >= today) || [];
    console.log(`\n  Tasks created TODAY: ${todaysTodos.length}`);
    if (todaysTodos.length > 0) {
      console.log('  Today\'s tasks (to preserve):');
      todaysTodos.forEach((todo, i) => {
        console.log(`    ${i + 1}. ${todo.text?.substring(0, 60)}`);
      });
    }
  }

  // 2. Check activity log for ALL deleted items
  console.log('\n📜 Activity Log - All Deleted Items:');
  const { data: deletedActivities, error: activityError } = await supabase
    .from('activity_log')
    .select('*')
    .eq('action', 'task_deleted')
    .order('created_at', { ascending: false })
    .limit(50);

  if (activityError) {
    console.error('  Error fetching activity log:', activityError.message);
  } else if (deletedActivities && deletedActivities.length > 0) {
    console.log(`  Found ${deletedActivities.length} deleted task records:`);
    deletedActivities.forEach((activity, i) => {
      const date = new Date(activity.created_at).toLocaleString();
      console.log(`\n    ${i + 1}. "${activity.todo_text}"`);
      console.log(`       Deleted by: ${activity.user_name} at ${date}`);
      console.log(`       Task ID: ${activity.todo_id}`);
    });
  } else {
    console.log('  No deleted tasks found in activity log');
  }

  // 3. Check for all activity in last 24 hours
  console.log('\n📅 All Activity in Last 24 Hours:');
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentActivity, error: recentError } = await supabase
    .from('activity_log')
    .select('*')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false });

  if (recentError) {
    console.error('  Error:', recentError.message);
  } else {
    // Group by action type
    const actionCounts: Record<string, number> = {};
    recentActivity?.forEach(a => {
      actionCounts[a.action] = (actionCounts[a.action] || 0) + 1;
    });

    console.log('  Activity breakdown:');
    Object.entries(actionCounts).forEach(([action, count]) => {
      console.log(`    - ${action}: ${count}`);
    });
  }

  // 4. Check if deleted todos still exist (soft delete check)
  if (deletedActivities && deletedActivities.length > 0) {
    console.log('\n🔍 Checking if deleted tasks can be restored:');
    const deletedIds = deletedActivities.map(a => a.todo_id).filter(Boolean);

    const { data: stillExists, error: existsError } = await supabase
      .from('todos')
      .select('id, text')
      .in('id', deletedIds);

    if (!existsError) {
      const existingIds = new Set(stillExists?.map(t => t.id) || []);
      const trulyDeleted = deletedActivities.filter(a => !existingIds.has(a.todo_id));
      const stillInDb = deletedActivities.filter(a => existingIds.has(a.todo_id));

      console.log(`  - Tasks completely deleted: ${trulyDeleted.length}`);
      console.log(`  - Tasks still in database: ${stillInDb.length}`);
    }
  }

  // 5. Summary and recommendations
  console.log('\n' + '='.repeat(60));
  console.log('📊 RECOVERY SUMMARY:\n');

  console.log(`  Current tasks in database: ${todos?.length || 0}`);
  console.log(`  Tasks created today (WILL PRESERVE): ${todaysTodos.length}`);
  console.log(`  Deleted task records in log: ${deletedActivities?.length || 0}`);

  console.log('\n📝 RECOVERY OPTIONS:');

  if (deletedActivities && deletedActivities.length > 0) {
    console.log('\n  Option 1: Restore from Activity Log');
    console.log('  -----------------------------------');
    console.log('  The activity log has records of deleted tasks.');
    console.log('  However, it only stores the task TEXT, not full details.');
    console.log('  This can recreate basic tasks but may lose:');
    console.log('    - Subtasks');
    console.log('    - Attachments');
    console.log('    - Notes');
    console.log('    - Priority/assignment details');
  }

  console.log('\n  Option 2: Supabase Point-in-Time Recovery (PITR)');
  console.log('  ------------------------------------------------');
  console.log('  If PITR is enabled on your Supabase project:');
  console.log('  1. Go to Supabase Dashboard → Database → Backups');
  console.log('  2. Click "Point in Time Recovery"');
  console.log('  3. Select a time from 24 hours ago');
  console.log('  4. Download the backup or restore to a new branch');
  console.log('  5. Export the todos table from the backup');
  console.log('  6. Merge with current data, keeping today\'s tasks');

  console.log('\n  Option 3: Manual Database Backup');
  console.log('  --------------------------------');
  console.log('  If you have daily backups enabled:');
  console.log('  1. Download yesterday\'s backup from Supabase');
  console.log('  2. Import into a temp database');
  console.log('  3. Export todos that don\'t exist in current DB');
  console.log('  4. Insert missing todos\n');

  // Export current data as backup
  console.log('\n💾 CREATING BACKUP OF CURRENT DATA...');
  const backupFile = `backup-todos-${new Date().toISOString().split('T')[0]}.json`;
  const fs = await import('fs');
  fs.writeFileSync(
    path.join(__dirname, `../${backupFile}`),
    JSON.stringify({ todos, todaysTodos, deletedActivities }, null, 2)
  );
  console.log(`  ✅ Backup saved to: ${backupFile}\n`);
}

main().catch(console.error);
