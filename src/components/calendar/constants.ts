import { TaskCategory, TodoStatus, Subtask, TaskReminder } from '@/types/todo';

/** Category color mapping — Tailwind bg class for each category */
export const CATEGORY_COLORS: Record<TaskCategory, string> = {
  research: 'bg-blue-500',
  meeting: 'bg-amber-500',
  analysis: 'bg-indigo-500',
  submission: 'bg-red-500',
  revision: 'bg-orange-500',
  presentation: 'bg-purple-500',
  writing: 'bg-emerald-500',
  reading: 'bg-cyan-500',
  coursework: 'bg-pink-500',
  admin: 'bg-slate-500',
  grant: 'bg-green-500',
  teaching: 'bg-violet-500',
  fieldwork: 'bg-teal-500',
  other: 'bg-gray-500',
};

/** Human-readable labels for each task category */
export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  research: 'Research',
  meeting: 'Meeting',
  analysis: 'Analysis',
  submission: 'Submission',
  revision: 'Revision',
  presentation: 'Presentation',
  writing: 'Writing',
  reading: 'Reading',
  coursework: 'Coursework',
  admin: 'Admin',
  grant: 'Grant',
  teaching: 'Teaching',
  fieldwork: 'Fieldwork',
  other: 'Other',
};

/** All task categories in display order */
export const ALL_CATEGORIES: TaskCategory[] = [
  'research',
  'meeting',
  'analysis',
  'submission',
  'revision',
  'presentation',
  'writing',
  'reading',
  'coursework',
  'admin',
  'grant',
  'teaching',
  'fieldwork',
  'other',
];

/** Priority sort weight — lower number = higher priority */
export const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Check whether a task's due date is in the past (before today).
 * Compares date-only (no time component) to avoid timezone issues.
 */
export function isTaskOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  // Extract date-only portion to avoid timezone issues and handle both
  // 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm:ss' formats
  const dateOnly = dueDate.split('T')[0];
  const taskDate = new Date(dateOnly + 'T00:00:00');
  const today = new Date(new Date().toDateString());
  return taskDate < today;
}

// ============================================
// Wave 1: Status, Subtask, Waiting indicators
// ============================================

/** Tailwind classes for task status indicator (left border) */
export const STATUS_BORDER: Record<TodoStatus, string> = {
  in_progress: 'border-l-2 border-l-amber-400',
  todo: '',
  done: '',
};


/** Get subtask progress string (e.g. "3/5") or null if no subtasks */
export function getSubtaskProgress(subtasks: Subtask[] | undefined): string | null {
  if (!subtasks || subtasks.length === 0) return null;
  const done = subtasks.filter((s) => s.completed).length;
  return `${done}/${subtasks.length}`;
}

/** Check if a task's follow-up is overdue based on waiting_since and follow_up_after_hours */
export function isFollowUpOverdue(
  waitingSince: string | undefined,
  followUpHours: number | undefined,
): boolean {
  if (!waitingSince) return false;
  const since = new Date(waitingSince);
  const now = new Date();
  const diffHours = (now.getTime() - since.getTime()) / (1000 * 60 * 60);
  return diffHours >= (followUpHours ?? 48);
}

// ============================================
// Wave 2: Assigned user, reminders
// ============================================

/** Get 1-2 character initials from a name string */
export function getInitials(name: string | undefined): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}


/** Check if a task has any pending reminders */
export function hasPendingReminders(
  reminders: TaskReminder[] | undefined,
  reminderAt: string | undefined,
): boolean {
  if (reminderAt && !isReminderPast(reminderAt)) return true;
  if (reminders?.some((r) => r.status === 'pending')) return true;
  return false;
}

function isReminderPast(reminderAt: string): boolean {
  return new Date(reminderAt) < new Date();
}
