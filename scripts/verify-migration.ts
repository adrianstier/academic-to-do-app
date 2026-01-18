#!/usr/bin/env tsx
/**
 * Migration Verification Script
 *
 * Verifies that data was correctly migrated from JSONB to normalized tables.
 * Compares old and new schemas to ensure data integrity.
 *
 * Usage:
 *   npm run migrate:verify
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface VerificationResult {
  passed: boolean;
  totalTodos: number;
  subtasksVerified: number;
  subtasksMismatch: number;
  attachmentsVerified: number;
  attachmentsMismatch: number;
  assignmentsVerified: number;
  assignmentsMismatch: number;
  errors: string[];
}

async function verifyMigration(): Promise<VerificationResult> {
  console.log('\n🔍 Starting Migration Verification\n');

  const result: VerificationResult = {
    passed: true,
    totalTodos: 0,
    subtasksVerified: 0,
    subtasksMismatch: 0,
    attachmentsVerified: 0,
    attachmentsMismatch: 0,
    assignmentsVerified: 0,
    assignmentsMismatch: 0,
    errors: [],
  };

  // Get all todos
  const { data: todos, error: todosError } = await supabase
    .from('todos')
    .select('id, subtasks, attachments, assigned_to');

  if (todosError) {
    result.passed = false;
    result.errors.push(`Failed to fetch todos: ${todosError.message}`);
    return result;
  }

  if (!todos || todos.length === 0) {
    console.log('✅ No todos to verify');
    return result;
  }

  result.totalTodos = todos.length;
  console.log(`📊 Verifying ${todos.length} todos...\n`);

  let progressCount = 0;

  for (const todo of todos) {
    progressCount++;
    if (progressCount % 50 === 0) {
      console.log(`  Progress: ${progressCount}/${todos.length} todos verified`);
    }

    // Verify subtasks
    if (todo.subtasks && Array.isArray(todo.subtasks) && todo.subtasks.length > 0) {
      const { data: migratedSubtasks } = await supabase
        .from('subtasks_v2')
        .select('*')
        .eq('todo_id', todo.id)
        .order('display_order');

      if (!migratedSubtasks || migratedSubtasks.length !== todo.subtasks.length) {
        result.subtasksMismatch++;
        result.passed = false;
        result.errors.push(
          `Todo ${todo.id}: Expected ${todo.subtasks.length} subtasks, found ${migratedSubtasks?.length || 0}`
        );
      } else {
        // Verify content matches
        let subtasksMatch = true;
        for (let i = 0; i < todo.subtasks.length; i++) {
          const oldSubtask = todo.subtasks[i];
          const newSubtask = migratedSubtasks[i];

          if (
            oldSubtask.text !== newSubtask.text ||
            oldSubtask.completed !== newSubtask.completed
          ) {
            subtasksMatch = false;
            break;
          }
        }

        if (subtasksMatch) {
          result.subtasksVerified++;
        } else {
          result.subtasksMismatch++;
          result.passed = false;
          result.errors.push(`Todo ${todo.id}: Subtask content mismatch`);
        }
      }
    }

    // Verify attachments
    if (todo.attachments && Array.isArray(todo.attachments) && todo.attachments.length > 0) {
      const { data: migratedAttachments } = await supabase
        .from('attachments_v2')
        .select('*')
        .eq('todo_id', todo.id);

      if (!migratedAttachments || migratedAttachments.length !== todo.attachments.length) {
        result.attachmentsMismatch++;
        result.passed = false;
        result.errors.push(
          `Todo ${todo.id}: Expected ${todo.attachments.length} attachments, found ${migratedAttachments?.length || 0}`
        );
      } else {
        // Verify file names match
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oldFileNames = todo.attachments.map((a: any) => a.file_name).sort();
        const newFileNames = migratedAttachments.map((a) => a.file_name).sort();

        if (JSON.stringify(oldFileNames) === JSON.stringify(newFileNames)) {
          result.attachmentsVerified++;
        } else {
          result.attachmentsMismatch++;
          result.passed = false;
          result.errors.push(`Todo ${todo.id}: Attachment file names mismatch`);
        }
      }
    }

    // Verify user assignment
    if (todo.assigned_to) {
      // Get user ID
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('name', todo.assigned_to)
        .single();

      if (user) {
        const { data: assignment } = await supabase
          .from('user_assignments')
          .select('*')
          .eq('todo_id', todo.id)
          .eq('user_id', user.id)
          .single();

        if (assignment) {
          result.assignmentsVerified++;
        } else {
          result.assignmentsMismatch++;
          result.passed = false;
          result.errors.push(`Todo ${todo.id}: Missing user assignment for ${todo.assigned_to}`);
        }
      }
    }
  }

  return result;
}

// Print verification results
function printResults(result: VerificationResult) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION RESULTS');
  console.log('='.repeat(60) + '\n');

  console.log(`Total todos verified: ${result.totalTodos}\n`);

  console.log('Subtasks:');
  console.log(`  ✅ Verified: ${result.subtasksVerified}`);
  if (result.subtasksMismatch > 0) {
    console.log(`  ❌ Mismatches: ${result.subtasksMismatch}`);
  }

  console.log('\nAttachments:');
  console.log(`  ✅ Verified: ${result.attachmentsVerified}`);
  if (result.attachmentsMismatch > 0) {
    console.log(`  ❌ Mismatches: ${result.attachmentsMismatch}`);
  }

  console.log('\nUser Assignments:');
  console.log(`  ✅ Verified: ${result.assignmentsVerified}`);
  if (result.assignmentsMismatch > 0) {
    console.log(`  ❌ Mismatches: ${result.assignmentsMismatch}`);
  }

  if (result.errors.length > 0) {
    console.log('\n❌ ERRORS FOUND:\n');
    result.errors.slice(0, 10).forEach((error) => {
      console.log(`  • ${error}`);
    });
    if (result.errors.length > 10) {
      console.log(`\n  ... and ${result.errors.length - 10} more errors`);
    }
  }

  console.log('\n' + '='.repeat(60));

  if (result.passed) {
    console.log('✅ VERIFICATION PASSED - Migration is correct!\n');
  } else {
    console.log('❌ VERIFICATION FAILED - Please review errors above\n');
  }
}

// Run verification
verifyMigration()
  .then((result) => {
    printResults(result);
    process.exit(result.passed ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Verification script failed:', error);
    process.exit(1);
  });
