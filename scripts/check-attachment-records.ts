#!/usr/bin/env npx tsx
/**
 * Check Activity Log for Attachment Records
 *
 * Checks if attachment metadata was logged when tasks were deleted.
 *
 * Run with: npx tsx scripts/check-attachment-records.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Checking for Attachment Records in Activity Log\n');
  console.log('='.repeat(60));

  // 1. Check for attachment-related activity
  console.log('\n📎 Attachment activity records:');
  const { data: attachmentActivity, error: attachError } = await supabase
    .from('activity_log')
    .select('*')
    .or('action.eq.attachment_added,action.eq.attachment_removed')
    .order('created_at', { ascending: false })
    .limit(50);

  if (attachError) {
    console.error('  Error:', attachError.message);
  } else if (attachmentActivity && attachmentActivity.length > 0) {
    console.log(`  Found ${attachmentActivity.length} attachment activity records:`);
    attachmentActivity.forEach((a, i) => {
      console.log(`\n  ${i + 1}. ${a.action}`);
      console.log(`     Task: "${a.todo_text?.substring(0, 40)}..."`);
      console.log(`     Task ID: ${a.todo_id}`);
      console.log(`     Date: ${new Date(a.created_at).toLocaleString()}`);
      if (a.details) {
        console.log(`     Details: ${JSON.stringify(a.details, null, 2)}`);
      }
    });
  } else {
    console.log('  No attachment activity records found');
  }

  // 2. Check deleted task details for attachment info
  console.log('\n\n📜 Checking deleted task details for attachment metadata:');
  const { data: deletedTasks, error: deleteError } = await supabase
    .from('activity_log')
    .select('*')
    .eq('action', 'task_deleted')
    .order('created_at', { ascending: false });

  if (deleteError) {
    console.error('  Error:', deleteError.message);
  } else if (deletedTasks) {
    const tasksWithDetails = deletedTasks.filter(t =>
      t.details && Object.keys(t.details).length > 0
    );

    if (tasksWithDetails.length > 0) {
      console.log(`  Found ${tasksWithDetails.length} deleted tasks with details:`);
      tasksWithDetails.forEach((t, i) => {
        console.log(`\n  ${i + 1}. "${t.todo_text?.substring(0, 40)}..."`);
        console.log(`     Details: ${JSON.stringify(t.details, null, 2)}`);
      });
    } else {
      console.log('  Deleted task records don\'t contain attachment metadata');
      console.log('  (The activity logger only stores task text, not full details)');
    }
  }

  // 3. Check current todos for attachment patterns
  console.log('\n\n📋 Current todos with attachments:');
  const { data: todosWithAttachments } = await supabase
    .from('todos')
    .select('id, text, attachments')
    .not('attachments', 'eq', '[]');

  if (todosWithAttachments) {
    const withAttachments = todosWithAttachments.filter(t =>
      t.attachments && Array.isArray(t.attachments) && t.attachments.length > 0
    );

    console.log(`  ${withAttachments.length} current tasks have attachments`);

    if (withAttachments.length > 0) {
      console.log('\n  Example attachment structure:');
      const example = withAttachments[0];
      console.log(`  Task: "${example.text?.substring(0, 40)}..."`);
      console.log(`  Attachment: ${JSON.stringify(example.attachments[0], null, 2)}`);
    }
  }

  // 4. Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 ATTACHMENT RECOVERY STATUS:\n');

  console.log('  ❌ Activity log does NOT store full attachment metadata');
  console.log('  ❌ Cannot recover attachment references from activity log\n');

  console.log('  ALTERNATIVE OPTIONS:');
  console.log('  1. Check Supabase Storage directly via Dashboard');
  console.log('     - Go to Storage → todo-attachments bucket');
  console.log('     - Files may still exist even if DB records were deleted');
  console.log('');
  console.log('  2. Use Point-in-Time Recovery (PITR)');
  console.log('     - This is the ONLY way to fully recover attachments');
  console.log('     - PITR restores the full database including JSONB fields');
  console.log('');
  console.log('  3. Check if you have database backups');
  console.log('     - Supabase Dashboard → Database → Backups');
  console.log('');
}

main().catch(console.error);
