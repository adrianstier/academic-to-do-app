/**
 * Task Completion Summary Generator
 *
 * Generates formatted text summaries of completed tasks that can be
 * copied and pasted into agent management systems or databases.
 *
 * Supports multiple output formats: Plain Text, Markdown, CSV, and JSON.
 */

import { Todo, Subtask, Attachment, TaskCompletionSummaryData } from '@/types/todo';
import { format, isValid, parseISO } from 'date-fns';

export type SummaryFormat = 'text' | 'markdown' | 'json' | 'csv';

// ============================================
// User Preference Persistence
// ============================================

const FORMAT_PREFERENCE_KEY = 'todo_summary_format_preference';

/**
 * Valid summary formats for validation
 */
const VALID_FORMATS: SummaryFormat[] = ['text', 'markdown', 'json', 'csv'];

/**
 * Get the user's preferred summary format from localStorage
 *
 * SSR-safe: Returns 'text' during server-side rendering.
 * Gracefully handles errors and invalid stored values.
 *
 * @returns The stored format preference, or 'text' as default
 */
export function getPreferredFormat(): SummaryFormat {
  // SSR safety check
  if (typeof window === 'undefined') {
    return 'text';
  }

  try {
    const stored = localStorage.getItem(FORMAT_PREFERENCE_KEY);

    // Validate stored value
    if (stored && VALID_FORMATS.includes(stored as SummaryFormat)) {
      return stored as SummaryFormat;
    }
  } catch (error) {
    // localStorage may be unavailable (private mode, storage quota, etc.)
    console.warn('Failed to read format preference from localStorage:', error);
  }

  return 'text';
}

/**
 * Save the user's preferred summary format to localStorage
 *
 * SSR-safe: Does nothing during server-side rendering.
 * Gracefully handles errors without throwing.
 *
 * @param format - The format to save as the user's preference
 */
export function setPreferredFormat(format: SummaryFormat): void {
  // SSR safety check
  if (typeof window === 'undefined') {
    return;
  }

  // Validate the format before storing
  if (!VALID_FORMATS.includes(format)) {
    console.warn(`Invalid summary format: ${format}. Not saving to localStorage.`);
    return;
  }

  try {
    localStorage.setItem(FORMAT_PREFERENCE_KEY, format);
  } catch (error) {
    // localStorage may be unavailable or full
    console.warn('Failed to save format preference to localStorage:', error);
  }
}

/**
 * Clear the stored format preference
 *
 * Useful for testing or resetting user preferences.
 */
export function clearPreferredFormat(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(FORMAT_PREFERENCE_KEY);
  } catch (error) {
    console.warn('Failed to clear format preference from localStorage:', error);
  }
}

// ============================================
// Task Summary Options & Configuration
// ============================================

export interface TaskSummaryOptions {
  includeSubtasks?: boolean;
  includeNotes?: boolean;
  includeAttachments?: boolean;
  includeTranscription?: boolean;
  includeCreatedDate?: boolean;
  includeTimestamps?: boolean;
}

const DEFAULT_OPTIONS: TaskSummaryOptions = {
  includeSubtasks: true,
  includeNotes: true,
  includeAttachments: true,
  includeTranscription: true,
  includeCreatedDate: true,
  includeTimestamps: true,
};

/**
 * Safely format a date string, returning fallback if invalid
 */
function safeFormatDate(dateStr: string | undefined, formatStr: string, fallback = 'N/A'): string {
  if (!dateStr) return fallback;
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    if (!isValid(date)) return fallback;
    return format(date, formatStr);
  } catch {
    return fallback;
  }
}

/**
 * Helper to capitalize first letter
 */
function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Convert Todo to structured summary data
 */
export function toSummaryData(todo: Todo, completedBy: string): TaskCompletionSummaryData {
  return {
    taskText: todo.text,
    completedBy,
    completedAt: new Date().toISOString(),
    priority: todo.priority,
    assignedTo: todo.assigned_to,
    dueDate: todo.due_date,
    subtasksCompleted: todo.subtasks?.filter(s => s.completed).length || 0,
    subtasksTotal: todo.subtasks?.length || 0,
    subtaskDetails: todo.subtasks?.map(s => ({ text: s.text, completed: s.completed })) || [],
    notes: todo.notes,
    attachments: todo.attachments?.map(a => a.file_name) || [],
    transcription: todo.transcription,
  };
}

/**
 * Generates a formatted plain text summary of a completed task
 */
export function generateTaskSummary(
  todo: Todo,
  completedBy: string,
  options: TaskSummaryOptions = DEFAULT_OPTIONS
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = new Date();
  const lines: string[] = [];

  // Header
  lines.push('═══════════════════════════════════════');
  lines.push('TASK COMPLETION SUMMARY');
  lines.push('═══════════════════════════════════════');
  lines.push('');

  // Basic info
  lines.push(`Task: ${todo.text}`);
  lines.push(`Status: Completed ✓`);
  lines.push(`Completed By: ${completedBy}`);
  lines.push(`Completion Date: ${format(now, "MMMM d, yyyy 'at' h:mm a")}`);
  lines.push(`Priority: ${capitalize(todo.priority)}`);

  if (opts.includeCreatedDate && todo.created_at) {
    lines.push(`Created: ${safeFormatDate(todo.created_at, "MMMM d, yyyy 'at' h:mm a")}`);
    lines.push(`Created By: ${todo.created_by}`);
  }

  if (todo.assigned_to) {
    lines.push(`Originally Assigned To: ${todo.assigned_to}`);
  }

  if (todo.due_date) {
    const dueDateStr = safeFormatDate(todo.due_date, 'MMMM d, yyyy');
    lines.push(`Due Date: ${dueDateStr}`);
  }

  // Subtasks section
  if (opts.includeSubtasks && todo.subtasks && todo.subtasks.length > 0) {
    lines.push('');
    const completedSubtasks = todo.subtasks.filter(s => s.completed).length;
    lines.push(`SUBTASKS: ${completedSubtasks}/${todo.subtasks.length} completed`);
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    todo.subtasks.forEach((subtask: Subtask) => {
      const checkbox = subtask.completed ? '✓' : '○';
      const status = subtask.completed ? '' : ' (incomplete)';
      lines.push(`[${checkbox}] ${subtask.text}${status}`);
    });
  }

  // Notes section
  if (opts.includeNotes) {
    lines.push('');
    lines.push('NOTES:');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(todo.notes || 'None');
  }

  // Attachments section
  if (opts.includeAttachments && todo.attachments && todo.attachments.length > 0) {
    lines.push('');
    lines.push(`ATTACHMENTS: ${todo.attachments.length}`);
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    todo.attachments.forEach((attachment: Attachment) => {
      const size = formatFileSize(attachment.file_size);
      lines.push(`• ${attachment.file_name} (${size})`);
    });
  }

  // Transcription section
  if (opts.includeTranscription && todo.transcription) {
    lines.push('');
    lines.push('VOICEMAIL TRANSCRIPTION:');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(todo.transcription);
  }

  // Footer
  lines.push('');
  lines.push('═══════════════════════════════════════');
  lines.push('Generated by Academic Project Manager');
  lines.push(format(now, "MMMM d, yyyy 'at' h:mm a"));
  lines.push('═══════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Generates a Markdown-formatted summary of a completed task
 */
export function generateMarkdownSummary(
  todo: Todo,
  completedBy: string,
  options: TaskSummaryOptions = DEFAULT_OPTIONS
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = new Date();
  const lines: string[] = [];

  // Header
  lines.push('# Task Completion Summary');
  lines.push('');

  // Basic info table
  lines.push('## Details');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| **Task** | ${todo.text} |`);
  lines.push(`| **Status** | ✅ Completed |`);
  lines.push(`| **Completed By** | ${completedBy} |`);
  lines.push(`| **Completion Date** | ${format(now, "MMMM d, yyyy 'at' h:mm a")} |`);
  lines.push(`| **Priority** | ${capitalize(todo.priority)} |`);

  if (opts.includeCreatedDate && todo.created_at) {
    lines.push(`| **Created** | ${safeFormatDate(todo.created_at, "MMMM d, yyyy 'at' h:mm a")} |`);
    lines.push(`| **Created By** | ${todo.created_by} |`);
  }

  if (todo.assigned_to) {
    lines.push(`| **Assigned To** | ${todo.assigned_to} |`);
  }

  if (todo.due_date) {
    lines.push(`| **Due Date** | ${safeFormatDate(todo.due_date, 'MMMM d, yyyy')} |`);
  }

  // Subtasks section
  if (opts.includeSubtasks && todo.subtasks && todo.subtasks.length > 0) {
    const completedSubtasks = todo.subtasks.filter(s => s.completed).length;
    lines.push('');
    lines.push(`## Subtasks (${completedSubtasks}/${todo.subtasks.length})`);
    lines.push('');

    todo.subtasks.forEach((subtask: Subtask) => {
      const checkbox = subtask.completed ? '[x]' : '[ ]';
      lines.push(`- ${checkbox} ${subtask.text}`);
    });
  }

  // Notes section
  if (opts.includeNotes && todo.notes) {
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    lines.push(todo.notes);
  }

  // Attachments section
  if (opts.includeAttachments && todo.attachments && todo.attachments.length > 0) {
    lines.push('');
    lines.push(`## Attachments (${todo.attachments.length})`);
    lines.push('');

    todo.attachments.forEach((attachment: Attachment) => {
      const size = formatFileSize(attachment.file_size);
      lines.push(`- 📎 **${attachment.file_name}** (${size})`);
    });
  }

  // Transcription section
  if (opts.includeTranscription && todo.transcription) {
    lines.push('');
    lines.push('## Voicemail Transcription');
    lines.push('');
    lines.push('> ' + todo.transcription.split('\n').join('\n> '));
  }

  // Footer
  lines.push('');
  lines.push('---');
  lines.push(`*Generated by Academic Project Manager on ${format(now, "MMMM d, yyyy 'at' h:mm a")}*`);

  return lines.join('\n');
}

/**
 * Generates a JSON summary of a completed task
 */
export function generateJSONSummary(
  todo: Todo,
  completedBy: string,
  options: TaskSummaryOptions = DEFAULT_OPTIONS
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = new Date();

  const summary: Record<string, unknown> = {
    task: todo.text,
    status: 'completed',
    completedBy,
    completionDate: now.toISOString(),
    priority: todo.priority,
  };

  if (opts.includeCreatedDate && todo.created_at) {
    summary.createdAt = todo.created_at;
    summary.createdBy = todo.created_by;
  }

  if (todo.assigned_to) {
    summary.assignedTo = todo.assigned_to;
  }

  if (todo.due_date) {
    summary.dueDate = todo.due_date;
  }

  if (opts.includeSubtasks && todo.subtasks && todo.subtasks.length > 0) {
    summary.subtasks = {
      total: todo.subtasks.length,
      completed: todo.subtasks.filter(s => s.completed).length,
      items: todo.subtasks.map(s => ({
        text: s.text,
        completed: s.completed,
        priority: s.priority,
      })),
    };
  }

  if (opts.includeNotes && todo.notes) {
    summary.notes = todo.notes;
  }

  if (opts.includeAttachments && todo.attachments && todo.attachments.length > 0) {
    summary.attachments = todo.attachments.map(a => ({
      fileName: a.file_name,
      fileType: a.file_type,
      fileSize: a.file_size,
      uploadedBy: a.uploaded_by,
      uploadedAt: a.uploaded_at,
    }));
  }

  if (opts.includeTranscription && todo.transcription) {
    summary.transcription = todo.transcription;
  }

  summary.generatedAt = now.toISOString();
  summary.generator = 'Academic Project Manager';

  return JSON.stringify(summary, null, 2);
}

/**
 * Escapes a value for CSV (handles commas, quotes, newlines)
 */
function escapeCSV(value: string | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates a CSV row for a completed task (single row format)
 */
export function generateCSVSummary(
  todo: Todo,
  completedBy: string,
  options: TaskSummaryOptions = DEFAULT_OPTIONS
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = new Date();

  const subtasksCompleted = todo.subtasks?.filter(s => s.completed).length || 0;
  const subtasksTotal = todo.subtasks?.length || 0;

  // CSV Header
  const headers = [
    'Task',
    'Status',
    'Completed By',
    'Completion Date',
    'Priority',
    'Created At',
    'Created By',
    'Assigned To',
    'Due Date',
    'Subtasks Completed',
    'Subtasks Total',
    'Subtask Details',
    'Notes',
    'Attachments',
    'Transcription',
  ];

  // CSV Values
  const values = [
    escapeCSV(todo.text),
    'Completed',
    escapeCSV(completedBy),
    format(now, 'yyyy-MM-dd HH:mm:ss'),
    capitalize(todo.priority),
    opts.includeCreatedDate ? safeFormatDate(todo.created_at, 'yyyy-MM-dd HH:mm:ss', '') : '',
    opts.includeCreatedDate ? escapeCSV(todo.created_by) : '',
    escapeCSV(todo.assigned_to),
    safeFormatDate(todo.due_date, 'yyyy-MM-dd', ''),
    opts.includeSubtasks ? String(subtasksCompleted) : '',
    opts.includeSubtasks ? String(subtasksTotal) : '',
    opts.includeSubtasks && todo.subtasks
      ? escapeCSV(todo.subtasks.map(s => `${s.completed ? '✓' : '○'} ${s.text}`).join('; '))
      : '',
    opts.includeNotes ? escapeCSV(todo.notes) : '',
    opts.includeAttachments && todo.attachments
      ? escapeCSV(todo.attachments.map(a => a.file_name).join('; '))
      : '',
    opts.includeTranscription ? escapeCSV(todo.transcription) : '',
  ];

  return headers.join(',') + '\n' + values.join(',');
}

/**
 * Generates CSV for multiple tasks (batch export)
 */
export function generateBatchCSVSummary(
  todos: Array<{ todo: Todo; completedBy: string }>,
  options: TaskSummaryOptions = DEFAULT_OPTIONS
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // CSV Header
  const headers = [
    'Task',
    'Status',
    'Completed By',
    'Completion Date',
    'Priority',
    'Created At',
    'Created By',
    'Assigned To',
    'Due Date',
    'Subtasks Completed',
    'Subtasks Total',
    'Notes',
    'Attachments Count',
  ];

  const rows = [headers.join(',')];

  for (const { todo, completedBy } of todos) {
    const subtasksCompleted = todo.subtasks?.filter(s => s.completed).length || 0;
    const subtasksTotal = todo.subtasks?.length || 0;

    const values = [
      escapeCSV(todo.text),
      'Completed',
      escapeCSV(completedBy),
      format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      capitalize(todo.priority),
      opts.includeCreatedDate ? safeFormatDate(todo.created_at, 'yyyy-MM-dd HH:mm:ss', '') : '',
      opts.includeCreatedDate ? escapeCSV(todo.created_by) : '',
      escapeCSV(todo.assigned_to),
      safeFormatDate(todo.due_date, 'yyyy-MM-dd', ''),
      opts.includeSubtasks ? String(subtasksCompleted) : '',
      opts.includeSubtasks ? String(subtasksTotal) : '',
      opts.includeNotes ? escapeCSV(todo.notes) : '',
      opts.includeAttachments ? String(todo.attachments?.length || 0) : '',
    ];

    rows.push(values.join(','));
  }

  return rows.join('\n');
}

/**
 * Unified summary generator - generates summary in the specified format
 */
export function generateSummary(
  todo: Todo,
  completedBy: string,
  format: SummaryFormat = 'text',
  options: TaskSummaryOptions = DEFAULT_OPTIONS
): string {
  switch (format) {
    case 'markdown':
      return generateMarkdownSummary(todo, completedBy, options);
    case 'json':
      return generateJSONSummary(todo, completedBy, options);
    case 'csv':
      return generateCSVSummary(todo, completedBy, options);
    case 'text':
    default:
      return generateTaskSummary(todo, completedBy, options);
  }
}

/**
 * Generates a compact single-line summary for activity logs
 */
export function generateCompactSummary(todo: Todo, completedBy: string): string {
  const subtaskInfo = todo.subtasks && todo.subtasks.length > 0
    ? ` (${todo.subtasks.filter(s => s.completed).length}/${todo.subtasks.length} subtasks)`
    : '';

  return `${todo.text}${subtaskInfo} - Completed by ${completedBy} on ${format(new Date(), 'MM/dd/yyyy')}`;
}

/**
 * Copies text to clipboard and returns success status
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch {
    console.error('Failed to copy to clipboard');
    return false;
  }
}

