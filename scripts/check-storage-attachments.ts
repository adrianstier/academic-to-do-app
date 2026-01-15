#!/usr/bin/env npx tsx
/**
 * Check Supabase Storage for Orphaned Attachments
 *
 * This script checks if attachments still exist in storage even though
 * the database records were deleted.
 *
 * Run with: npx tsx scripts/check-storage-attachments.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials (need SERVICE_ROLE_KEY for storage access)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Checking Supabase Storage for Attachments\n');
  console.log('='.repeat(60));

  // 1. List all buckets
  console.log('\n📦 Available Storage Buckets:');
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

  if (bucketsError) {
    console.error('❌ Error listing buckets:', bucketsError.message);
    return;
  }

  if (!buckets || buckets.length === 0) {
    console.log('  No storage buckets found');
    return;
  }

  buckets.forEach((bucket) => {
    console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
  });

  // 2. Check the 'todo-attachments' bucket (or similar)
  const attachmentBucket = buckets.find(b =>
    b.name.includes('attachment') ||
    b.name.includes('todo') ||
    b.name.includes('files')
  );

  const bucketName = attachmentBucket?.name || 'todo-attachments';

  console.log(`\n📁 Scanning bucket: ${bucketName}`);

  // 3. List all files in the bucket
  const { data: files, error: filesError } = await supabase.storage
    .from(bucketName)
    .list('todos', {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  if (filesError) {
    console.error('❌ Error listing files:', filesError.message);

    // Try listing from root
    console.log('\n  Trying root directory...');
    const { data: rootFiles, error: rootError } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 100 });

    if (rootError) {
      console.error('  ❌ Error:', rootError.message);
    } else if (rootFiles) {
      console.log(`  Found ${rootFiles.length} items in root:`);
      rootFiles.forEach(f => {
        console.log(`    - ${f.name} (${f.metadata?.size || 'folder'})`);
      });
    }
    return;
  }

  if (!files || files.length === 0) {
    console.log('  No files found in todos/ directory');
  } else {
    console.log(`  Found ${files.length} items:\n`);

    // For each folder (task ID), check contents
    for (const item of files) {
      if (item.id === null) {
        // This is a folder
        console.log(`  📂 Task folder: ${item.name}`);

        const { data: taskFiles } = await supabase.storage
          .from(bucketName)
          .list(`todos/${item.name}`, { limit: 20 });

        if (taskFiles && taskFiles.length > 0) {
          taskFiles.forEach(f => {
            const size = f.metadata?.size
              ? `${Math.round(f.metadata.size / 1024)}KB`
              : 'unknown size';
            console.log(`     - ${f.name} (${size})`);
          });
        }
      } else {
        console.log(`  📄 ${item.name}`);
      }
    }
  }

  // 4. Get deleted task IDs to check
  console.log('\n📜 Checking for attachments from deleted tasks...');
  const { data: deletedActivities } = await supabase
    .from('activity_log')
    .select('todo_id')
    .eq('action', 'task_deleted');

  if (deletedActivities && deletedActivities.length > 0) {
    const deletedIds = deletedActivities.map(a => a.todo_id).filter(Boolean);

    for (const taskId of deletedIds) {
      const { data: taskFiles, error } = await supabase.storage
        .from(bucketName)
        .list(`todos/${taskId}`);

      if (!error && taskFiles && taskFiles.length > 0) {
        console.log(`\n  ✅ Found attachments for deleted task ${taskId}:`);
        taskFiles.forEach(f => {
          console.log(`     - ${f.name}`);
        });
      }
    }
  }

  // 5. Check for any attachments referenced in current todos
  console.log('\n📋 Attachments referenced in current todos:');
  const { data: todosWithAttachments } = await supabase
    .from('todos')
    .select('id, text, attachments')
    .not('attachments', 'eq', '[]');

  if (todosWithAttachments) {
    const tasksWithAttachments = todosWithAttachments.filter(t =>
      t.attachments && t.attachments.length > 0
    );

    console.log(`  ${tasksWithAttachments.length} tasks have attachments`);
    tasksWithAttachments.forEach(t => {
      console.log(`\n  Task: "${t.text?.substring(0, 40)}..."`);
      t.attachments.forEach((a: { file_name: string; file_size?: number }) => {
        console.log(`    - ${a.file_name}`);
      });
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('  If attachments exist in storage for deleted tasks,');
  console.log('  they can be recovered by re-linking them in the database.');
  console.log('  Use the restore script with --with-attachments flag.\n');
}

main().catch(console.error);
