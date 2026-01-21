/**
 * Reminder Service
 *
 * Handles reminder processing, notification sending, and reminder scheduling.
 * Integrates with both push notifications and chat message notifications.
 */

import { supabase } from './supabaseClient';
import { format, formatDistanceToNow, startOfDay } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { TaskReminder, ReminderType, TodoPriority } from '@/types/todo';

const SYSTEM_SENDER = 'System';

// Priority emoji mapping
const PRIORITY_EMOJI: Record<TodoPriority, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  urgent: '🔴',
};

interface DueReminder {
  reminder_id: string;
  todo_id: string;
  todo_text: string;
  todo_priority: TodoPriority;
  assigned_to: string;
  due_date: string;
  user_id: string | null;
  user_name: string;
  reminder_time: string;
  reminder_type: ReminderType;
  custom_message: string | null;
}

/**
 * Fetch reminders that are due to be sent
 */
export async function getDueReminders(
  windowMinutes: number = 5
): Promise<DueReminder[]> {
  const { data, error } = await supabase.rpc('get_due_reminders', {
    check_window_minutes: windowMinutes,
  });

  if (error) {
    console.error('Error fetching due reminders:', error);
    return [];
  }

  return data || [];
}

/**
 * Build a reminder notification message for chat
 */
function buildReminderMessage(
  taskText: string,
  priority: TodoPriority,
  dueDate?: string,
  customMessage?: string
): string {
  const lines: string[] = [];

  lines.push('⏰ **Reminder**');
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');

  // Task title with priority
  const priorityEmoji = PRIORITY_EMOJI[priority] || '🟡';
  const priorityLabel = priority
    ? ` (${priority.charAt(0).toUpperCase() + priority.slice(1)})`
    : '';
  lines.push(`${priorityEmoji} **${taskText}**${priorityLabel}`);

  // Due date
  if (dueDate) {
    const formattedDue = formatReminderDueDate(dueDate);
    const isOverdue = startOfDay(new Date(dueDate)) < startOfDay(new Date());
    const dueLine = isOverdue
      ? `⚠️ Due: ${formattedDue}`
      : `📅 Due: ${formattedDue}`;
    lines.push(dueLine);
  }

  // Custom message
  if (customMessage) {
    lines.push('');
    lines.push(`💬 ${customMessage}`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('👆 Tap to view task');

  return lines.join('\n');
}

/**
 * Format due date for reminder message
 */
function formatReminderDueDate(dateString: string): string {
  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const todayStart = startOfDay(new Date());
  const dateStart = startOfDay(date);
  const diffDays = Math.ceil(
    (dateStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return `Overdue (${format(date, 'MMM d')})`;
  } else if (diffDays === 0) {
    // Include time if due today
    return `Today at ${format(date, 'h:mm a')}`;
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else if (diffDays <= 7) {
    return formatDistanceToNow(date, { addSuffix: true });
  } else {
    return format(date, 'EEEE, MMM d');
  }
}

/**
 * Send a chat notification for a reminder
 */
export async function sendReminderChatNotification(
  todoId: string,
  todoText: string,
  priority: TodoPriority,
  recipientUserName: string,
  dueDate?: string,
  customMessage?: string
): Promise<{ success: boolean; error?: string }> {
  const message = buildReminderMessage(todoText, priority, dueDate, customMessage);

  try {
    const { error } = await supabase.from('messages').insert({
      id: uuidv4(),
      text: message,
      created_by: SYSTEM_SENDER,
      created_at: new Date().toISOString(),
      related_todo_id: todoId,
      recipient: recipientUserName,
      mentions: [recipientUserName],
    });

    if (error) {
      console.error('Failed to send reminder chat notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error sending reminder chat notification:', err);
    return { success: false, error: 'Unknown error occurred' };
  }
}

/**
 * Send a push notification for a reminder
 * Uses the Supabase Edge Function which handles both iOS and Web platforms
 */
export async function sendReminderPushNotification(
  todoId: string,
  todoText: string,
  userIds: string[],
  dueDate?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const timeUntil = dueDate
      ? formatDistanceToNow(new Date(dueDate), { addSuffix: false })
      : undefined;

    const { error } = await supabase.functions.invoke(
      'send-push-notification',
      {
        body: {
          type: 'task_due_soon',
          payload: {
            taskId: todoId,
            taskText: todoText,
            timeUntil: timeUntil ? `in ${timeUntil}` : undefined,
          },
          userIds,
        },
      }
    );

    if (error) {
      console.error('Failed to send reminder push notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error sending reminder push notification:', err);
    return { success: false, error: 'Unknown error occurred' };
  }
}

/**
 * Process and send a single reminder
 */
export async function processReminder(
  reminder: DueReminder
): Promise<{ success: boolean; error?: string }> {
  const {
    reminder_id,
    todo_id,
    todo_text,
    todo_priority,
    due_date,
    user_id,
    user_name,
    reminder_type,
    custom_message,
  } = reminder;

  let chatSuccess = true;
  let pushSuccess = true;
  const errorMessages: string[] = [];

  // Send chat notification
  if (reminder_type === 'chat_message' || reminder_type === 'both') {
    const result = await sendReminderChatNotification(
      todo_id,
      todo_text,
      todo_priority,
      user_name,
      due_date,
      custom_message || undefined
    );
    chatSuccess = result.success;
    if (!chatSuccess && result.error) {
      errorMessages.push(`Chat: ${result.error}`);
    }
  }

  // Send push notification
  if (reminder_type === 'push_notification' || reminder_type === 'both') {
    if (user_id) {
      const result = await sendReminderPushNotification(
        todo_id,
        todo_text,
        [user_id],
        due_date
      );
      pushSuccess = result.success;
      if (!pushSuccess && result.error) {
        errorMessages.push(`Push: ${result.error}`);
      }
    } else {
      // No user_id means we can't send push notification
      pushSuccess = false;
      errorMessages.push('Push: No user ID available');
    }
  }

  // Determine overall success - for 'both' type, both must succeed
  const overallSuccess = reminder_type === 'both'
    ? chatSuccess && pushSuccess
    : (reminder_type === 'chat_message' ? chatSuccess : pushSuccess);

  // Combine all error messages
  const combinedError = errorMessages.length > 0 ? errorMessages.join('; ') : undefined;

  // Mark reminder as sent or failed
  const { error } = await supabase.rpc('mark_reminder_sent', {
    p_reminder_id: reminder_id,
    p_error_message: overallSuccess ? null : combinedError,
  });

  if (error) {
    console.error('Error marking reminder as sent:', error);
    return { success: false, error: 'Failed to update reminder status' };
  }

  return { success: overallSuccess, error: combinedError };
}

/**
 * Process all due reminders
 * Call this from a cron job or scheduled function
 */
export async function processAllDueReminders(): Promise<{
  processed: number;
  successful: number;
  failed: number;
}> {
  const reminders = await getDueReminders();
  let successful = 0;
  let failed = 0;

  for (const reminder of reminders) {
    const result = await processReminder(reminder);
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
  }

  return {
    processed: reminders.length,
    successful,
    failed,
  };
}

/**
 * Create a reminder from the simple reminder_at field on a todo
 */
export async function createSimpleReminder(
  todoId: string,
  reminderTime: Date,
  createdBy: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('task_reminders').insert({
    todo_id: todoId,
    reminder_time: reminderTime.toISOString(),
    reminder_type: 'both',
    status: 'pending',
    created_by: createdBy,
  });

  if (error) {
    console.error('Error creating simple reminder:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Auto-create reminders for a task with a due date
 * Creates reminders for 1 day before and 1 hour before the deadline
 */
export async function createAutoReminders(
  todoId: string,
  dueDate: string,
  userId: string,
  createdBy: string
): Promise<{ success: boolean; created: number; error?: string }> {
  const due = new Date(dueDate);
  const now = new Date();

  // Define the automatic reminder times
  const reminderConfigs = [
    {
      time: new Date(due.getTime() - 24 * 60 * 60 * 1000), // 1 day before
      message: 'Task due tomorrow',
    },
    {
      time: new Date(due.getTime() - 60 * 60 * 1000), // 1 hour before
      message: 'Task due in 1 hour',
    },
  ];

  // Filter to only future reminders
  const futureReminders = reminderConfigs.filter(r => r.time > now);

  if (futureReminders.length === 0) {
    return { success: true, created: 0 };
  }

  try {
    // First, cancel any existing auto-created reminders for this task
    // to avoid duplicates when due date is updated
    await supabase
      .from('task_reminders')
      .delete()
      .eq('todo_id', todoId)
      .eq('status', 'pending')
      .is('message', null); // Auto-created reminders have no custom message

    // Create new reminders
    const remindersToInsert = futureReminders.map(config => ({
      todo_id: todoId,
      user_id: userId,
      reminder_time: config.time.toISOString(),
      reminder_type: 'push_notification' as ReminderType,
      status: 'pending',
      message: config.message,
      created_by: createdBy,
    }));

    const { error } = await supabase
      .from('task_reminders')
      .insert(remindersToInsert);

    if (error) {
      console.error('Error creating auto reminders:', error);
      return { success: false, created: 0, error: error.message };
    }

    return { success: true, created: futureReminders.length };
  } catch (err) {
    console.error('Error in createAutoReminders:', err);
    return { success: false, created: 0, error: 'Unknown error occurred' };
  }
}

/**
 * Update auto reminders when a task's due date changes
 */
export async function updateAutoReminders(
  todoId: string,
  newDueDate: string | null,
  userId: string,
  createdBy: string
): Promise<{ success: boolean; error?: string }> {
  // If no due date, cancel all auto reminders
  if (!newDueDate) {
    return cancelTaskReminders(todoId);
  }

  // Create new auto reminders (this also cleans up old ones)
  const result = await createAutoReminders(todoId, newDueDate, userId, createdBy);
  return { success: result.success, error: result.error };
}

/**
 * Cancel all pending reminders for a task
 */
export async function cancelTaskReminders(
  todoId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('task_reminders')
    .update({ status: 'cancelled' })
    .eq('todo_id', todoId)
    .eq('status', 'pending');

  if (error) {
    console.error('Error cancelling task reminders:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get pending reminders count for a user
 */
export async function getUserPendingRemindersCount(
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('task_reminders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) {
    console.error('Error counting user reminders:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Calculate reminder time based on preset and due date
 */
export function calculateReminderTime(
  preset: string,
  dueDate?: Date,
  customTime?: Date
): Date | null {
  switch (preset) {
    case 'at_time':
    case 'custom':
      return customTime || null;
    case '5_min_before':
      return dueDate
        ? new Date(dueDate.getTime() - 5 * 60 * 1000)
        : null;
    case '15_min_before':
      return dueDate
        ? new Date(dueDate.getTime() - 15 * 60 * 1000)
        : null;
    case '30_min_before':
      return dueDate
        ? new Date(dueDate.getTime() - 30 * 60 * 1000)
        : null;
    case '1_hour_before':
      return dueDate
        ? new Date(dueDate.getTime() - 60 * 60 * 1000)
        : null;
    case '1_day_before':
      return dueDate
        ? new Date(dueDate.getTime() - 24 * 60 * 60 * 1000)
        : null;
    case 'morning_of':
      if (!dueDate) return null;
      const morning = new Date(dueDate);
      morning.setHours(9, 0, 0, 0);
      return morning;
    default:
      return null;
  }
}
