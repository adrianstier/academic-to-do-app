/**
 * Task Notification System
 *
 * Automatically sends chat notifications when tasks are assigned,
 * completed, or updated.
 */

import { supabase } from './supabaseClient';
import { format, formatDistanceToNow } from 'date-fns';
import { TodoPriority } from '@/types/todo';

export interface TaskAssignmentNotification {
  taskId: string;
  taskText: string;
  assignedTo: string;
  assignedBy: string;
  dueDate?: string;
  priority: TodoPriority;
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
 * Sends a notification when a task is assigned to a user
 * Skips notification if the user is self-assigning
 */
export async function sendTaskAssignmentNotification(
  options: TaskAssignmentNotification
): Promise<{ success: boolean; error?: string }> {
  const { taskId, taskText, assignedTo, assignedBy, dueDate, priority } = options;

  // Don't notify if self-assigned
  if (assignedTo === assignedBy) {
    return { success: true };
  }

  // Build the notification message
  const priorityEmoji = PRIORITY_EMOJI[priority] || '🟡';
  let message = `📋 New task assigned to you by ${assignedBy}:\n\n`;
  message += `${priorityEmoji} **${taskText}**`;

  if (dueDate) {
    const dueFormatted = formatDueDate(dueDate);
    message += `\n📅 Due: ${dueFormatted}`;
  }

  try {
    const { error } = await supabase.from('messages').insert({
      text: message,
      created_by: 'System',
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
 * Sends a notification when a task assigned by someone else is completed
 */
export async function sendTaskCompletionNotification(
  options: TaskCompletionNotification
): Promise<{ success: boolean; error?: string }> {
  const { taskId, taskText, completedBy, assignedBy } = options;

  // Don't notify if the completer is also the assigner
  if (completedBy === assignedBy) {
    return { success: true };
  }

  const message = `✅ Task completed by ${completedBy}:\n\n**${taskText}**`;

  try {
    const { error } = await supabase.from('messages').insert({
      text: message,
      created_by: 'System',
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
 * Sends a notification when a task is reassigned
 */
export async function sendTaskReassignmentNotification(
  taskId: string,
  taskText: string,
  previousAssignee: string,
  newAssignee: string,
  reassignedBy: string
): Promise<{ success: boolean; error?: string }> {
  // Notify new assignee (skip if self-assigning)
  if (newAssignee !== reassignedBy) {
    const newAssigneeMessage = `📋 Task reassigned to you by ${reassignedBy}:\n\n**${taskText}**`;

    await supabase.from('messages').insert({
      text: newAssigneeMessage,
      created_by: 'System',
      related_todo_id: taskId,
      recipient: newAssignee,
      mentions: [newAssignee],
    });
  }

  // Notify previous assignee (skip if they did the reassignment)
  if (previousAssignee && previousAssignee !== reassignedBy) {
    const prevAssigneeMessage = `📋 Task reassigned from you to ${newAssignee} by ${reassignedBy}:\n\n**${taskText}**`;

    await supabase.from('messages').insert({
      text: prevAssigneeMessage,
      created_by: 'System',
      related_todo_id: taskId,
      recipient: previousAssignee,
      mentions: [previousAssignee],
    });
  }

  return { success: true };
}

/**
 * Formats a due date for display in notifications
 */
function formatDueDate(dueDate: string): string {
  const date = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

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
