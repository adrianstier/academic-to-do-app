/**
 * Task Notification System
 *
 * Automatically sends chat notifications when tasks are assigned,
 * completed, or updated. Creates rich "task card" style messages
 * with task details and clickable links.
 */

import { supabase } from './supabaseClient';
import { format, formatDistanceToNow, startOfDay } from 'date-fns';
import { TodoPriority, Subtask } from '@/types/todo';

const SYSTEM_SENDER = 'System';

export interface TaskAssignmentNotification {
  taskId: string;
  taskText: string;
  assignedTo: string;
  assignedBy: string;
  dueDate?: string;
  priority: TodoPriority;
  subtasks?: Subtask[];
  notes?: string;
}

export interface TaskCompletionNotification {
  taskId: string;
  taskText: string;
  completedBy: string;
  assignedBy: string;
}

const PRIORITY_EMOJI: Record<TodoPriority, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  urgent: '🔴',
};

/**
 * Sends a rich "task card" notification when a task is assigned to a user.
 * Includes task details, priority, due date, and subtask summary.
 * Skips notification if the user is self-assigning.
 */
export async function sendTaskAssignmentNotification(
  options: TaskAssignmentNotification
): Promise<{ success: boolean; error?: string }> {
  const { taskId, taskText, assignedTo, assignedBy, dueDate, priority, subtasks, notes } = options;

  // Input validation
  if (!taskId || !taskId.trim()) {
    return { success: false, error: 'taskId is required' };
  }
  if (!taskText || !taskText.trim()) {
    return { success: false, error: 'taskText is required' };
  }
  if (!assignedTo || !assignedTo.trim()) {
    return { success: false, error: 'assignedTo is required' };
  }

  // Validate priority if provided
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (priority && !validPriorities.includes(priority)) {
    return { success: false, error: 'Invalid priority value' };
  }

  // Validate subtasks array if provided
  if (subtasks && !Array.isArray(subtasks)) {
    return { success: false, error: 'subtasks must be an array' };
  }

  // Validate dueDate format if provided
  if (dueDate) {
    const date = new Date(dueDate);
    if (isNaN(date.getTime())) {
      return { success: false, error: 'Invalid dueDate format' };
    }
  }

  // Don't notify if self-assigned
  if (assignedTo === assignedBy) {
    return { success: true };
  }

  // Build the rich task card notification message
  const message = buildTaskCardMessage({
    taskText,
    assignedBy,
    priority,
    dueDate,
    subtasks,
    notes,
    type: 'assignment',
  });

  try {
    const { error } = await supabase.from('messages').insert({
      text: message,
      created_by: SYSTEM_SENDER,
      related_todo_id: taskId,
      recipient: assignedTo,
      mentions: [assignedTo],
    });

    if (error) {
      console.error('Failed to send task assignment notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error sending task assignment notification:', err);
    return { success: false, error: 'Unknown error occurred' };
  }
}

/**
 * Builds a rich task card message with all relevant details
 */
interface TaskCardMessageOptions {
  taskText: string;
  assignedBy?: string;
  completedBy?: string;
  reassignedBy?: string;
  previousAssignee?: string;
  newAssignee?: string;
  priority?: TodoPriority;
  dueDate?: string;
  subtasks?: Subtask[];
  notes?: string;
  type: 'assignment' | 'completion' | 'reassignment_new' | 'reassignment_old';
}

function buildTaskCardMessage(options: TaskCardMessageOptions): string {
  const { taskText, assignedBy, completedBy, reassignedBy, newAssignee, priority, dueDate, subtasks, notes, type } = options;

  const lines: string[] = [];

  // Header based on notification type
  switch (type) {
    case 'assignment':
      lines.push(`📋 **New Task Assigned**`);
      lines.push(`From: ${assignedBy}`);
      break;
    case 'completion':
      lines.push(`✅ **Task Completed**`);
      lines.push(`By: ${completedBy}`);
      break;
    case 'reassignment_new':
      lines.push(`📋 **Task Reassigned to You**`);
      lines.push(`By: ${reassignedBy}`);
      break;
    case 'reassignment_old':
      lines.push(`📋 **Task Reassigned**`);
      lines.push(`From you to ${newAssignee} by ${reassignedBy}`);
      break;
  }

  lines.push(''); // Empty line separator
  lines.push('━━━━━━━━━━━━━━━━━━━━');

  // Task title with priority
  const priorityEmoji = priority ? PRIORITY_EMOJI[priority] || '🟡' : '';
  const priorityLabel = priority ? ` (${priority.charAt(0).toUpperCase() + priority.slice(1)})` : '';
  lines.push(`${priorityEmoji} **${taskText}**${priorityLabel}`);

  // Due date
  if (dueDate) {
    const dueFormatted = formatDueDate(dueDate);
    const isOverdue = startOfDay(new Date(dueDate)) < startOfDay(new Date());
    const dueLine = isOverdue ? `⚠️ Due: ${dueFormatted}` : `📅 Due: ${dueFormatted}`;
    lines.push(dueLine);
  }

  // Subtasks summary
  if (subtasks && subtasks.length > 0) {
    const completedCount = subtasks.filter(s => s.completed).length;
    lines.push('');
    lines.push(`📝 Subtasks: ${completedCount}/${subtasks.length} completed`);

    // Show first 3 subtasks as preview
    const previewSubtasks = subtasks.slice(0, 3);
    previewSubtasks.forEach(st => {
      const checkbox = st.completed ? '✓' : '○';
      lines.push(`  ${checkbox} ${st.text}`);
    });

    if (subtasks.length > 3) {
      lines.push(`  ... and ${subtasks.length - 3} more`);
    }
  }

  // Notes preview (truncated)
  if (notes && notes.trim()) {
    lines.push('');
    const truncatedNotes = notes.length > 100 ? notes.substring(0, 100) + '...' : notes;
    lines.push(`💬 Notes: ${truncatedNotes}`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('👆 Tap "View Task" to open');

  return lines.join('\n');
}

/**
 * Sends a rich notification when a task assigned by someone else is completed
 */
export async function sendTaskCompletionNotification(
  options: TaskCompletionNotification
): Promise<{ success: boolean; error?: string }> {
  const { taskId, taskText, completedBy, assignedBy } = options;

  // Input validation
  if (!taskId || !taskId.trim()) {
    return { success: false, error: 'taskId is required' };
  }
  if (!taskText || !taskText.trim()) {
    return { success: false, error: 'taskText is required' };
  }
  if (!completedBy || !completedBy.trim()) {
    return { success: false, error: 'completedBy is required' };
  }

  // Don't notify if the completer is also the assigner (or no assigner)
  if (!assignedBy || completedBy === assignedBy) {
    return { success: true };
  }

  const message = buildTaskCardMessage({
    taskText,
    completedBy,
    type: 'completion',
  });

  try {
    const { error } = await supabase.from('messages').insert({
      text: message,
      created_by: SYSTEM_SENDER,
      related_todo_id: taskId,
      recipient: assignedBy,
      mentions: [assignedBy],
    });

    if (error) {
      console.error('Failed to send task completion notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error sending task completion notification:', err);
    return { success: false, error: 'Unknown error occurred' };
  }
}

/**
 * Sends rich notifications when a task is reassigned
 */
export async function sendTaskReassignmentNotification(
  taskId: string,
  taskText: string,
  previousAssignee: string,
  newAssignee: string,
  reassignedBy: string,
  priority?: TodoPriority,
  dueDate?: string
): Promise<{ success: boolean; error?: string }> {
  // Input validation
  if (!taskId || !taskId.trim()) {
    return { success: false, error: 'taskId is required' };
  }
  if (!taskText || !taskText.trim()) {
    return { success: false, error: 'taskText is required' };
  }
  if (!newAssignee || !newAssignee.trim()) {
    return { success: false, error: 'newAssignee is required' };
  }
  if (!reassignedBy || !reassignedBy.trim()) {
    return { success: false, error: 'reassignedBy is required' };
  }

  // Validate priority if provided
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (priority && !validPriorities.includes(priority)) {
    return { success: false, error: 'Invalid priority value' };
  }

  // Validate dueDate format if provided
  if (dueDate) {
    const date = new Date(dueDate);
    if (isNaN(date.getTime())) {
      return { success: false, error: 'Invalid dueDate format' };
    }
  }

  // Early return if same assignee
  if (previousAssignee === newAssignee) {
    return { success: true };
  }

  try {
    // Notify new assignee (skip if self-assigning)
    if (newAssignee !== reassignedBy) {
      const newAssigneeMessage = buildTaskCardMessage({
        taskText,
        reassignedBy,
        priority,
        dueDate,
        type: 'reassignment_new',
      });

      const { error: newAssigneeError } = await supabase.from('messages').insert({
        text: newAssigneeMessage,
        created_by: SYSTEM_SENDER,
        related_todo_id: taskId,
        recipient: newAssignee,
        mentions: [newAssignee],
      });

      if (newAssigneeError) {
        console.error('Failed to send reassignment notification to new assignee:', newAssigneeError);
        return { success: false, error: newAssigneeError.message };
      }
    }

    // Notify previous assignee (skip if they did the reassignment)
    if (previousAssignee && previousAssignee !== reassignedBy) {
      const prevAssigneeMessage = buildTaskCardMessage({
        taskText,
        reassignedBy,
        newAssignee,
        priority,
        dueDate,
        type: 'reassignment_old',
      });

      const { error: prevAssigneeError } = await supabase.from('messages').insert({
        text: prevAssigneeMessage,
        created_by: SYSTEM_SENDER,
        related_todo_id: taskId,
        recipient: previousAssignee,
        mentions: [previousAssignee],
      });

      if (prevAssigneeError) {
        console.error('Failed to send reassignment notification to previous assignee:', prevAssigneeError);
        return { success: false, error: prevAssigneeError.message };
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Error sending task reassignment notification:', err);
    return { success: false, error: 'Unknown error occurred' };
  }
}

/**
 * Formats a due date for display in notifications
 */
function formatDueDate(dateString: string): string {
  const date = new Date(dateString);

  // Validate date
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const todayStart = startOfDay(new Date());
  const dateStart = startOfDay(date);
  const diffDays = Math.ceil((dateStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `Overdue (${format(date, 'MMM d')})`;
  } else if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else if (diffDays <= 7) {
    return formatDistanceToNow(date, { addSuffix: true });
  } else {
    return format(date, 'EEEE, MMM d');
  }
}
