export type TodoStatus = 'todo' | 'in_progress' | 'done';

export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | null;

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
  priority: TodoPriority;
  estimatedMinutes?: number;
}

export interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

// Allowed attachment file types
export const ALLOWED_ATTACHMENT_TYPES = {
  // Documents
  'application/pdf': { ext: 'pdf', category: 'document' },
  'application/msword': { ext: 'doc', category: 'document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', category: 'document' },
  'application/vnd.ms-excel': { ext: 'xls', category: 'document' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', category: 'document' },
  'application/vnd.ms-powerpoint': { ext: 'ppt', category: 'document' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: 'pptx', category: 'document' },
  'text/plain': { ext: 'txt', category: 'document' },
  'text/csv': { ext: 'csv', category: 'document' },
  // Images
  'image/jpeg': { ext: 'jpg', category: 'image' },
  'image/png': { ext: 'png', category: 'image' },
  'image/gif': { ext: 'gif', category: 'image' },
  'image/webp': { ext: 'webp', category: 'image' },
  'image/svg+xml': { ext: 'svg', category: 'image' },
  // Audio
  'audio/mpeg': { ext: 'mp3', category: 'audio' },
  'audio/wav': { ext: 'wav', category: 'audio' },
  'audio/ogg': { ext: 'ogg', category: 'audio' },
  'audio/webm': { ext: 'webm', category: 'audio' },
  'audio/mp4': { ext: 'm4a', category: 'audio' },
  'audio/x-m4a': { ext: 'm4a', category: 'audio' },
  // Video
  'video/mp4': { ext: 'mp4', category: 'video' },
  'video/webm': { ext: 'webm', category: 'video' },
  'video/quicktime': { ext: 'mov', category: 'video' },
  // Archives
  'application/zip': { ext: 'zip', category: 'archive' },
  'application/x-rar-compressed': { ext: 'rar', category: 'archive' },
} as const;

export type AttachmentMimeType = keyof typeof ALLOWED_ATTACHMENT_TYPES;
export type AttachmentCategory = 'document' | 'image' | 'audio' | 'video' | 'archive';

// Max file size: 25MB
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
// Max attachments per todo
export const MAX_ATTACHMENTS_PER_TODO = 10;

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  status: TodoStatus;
  priority: TodoPriority;
  created_at: string;
  created_by: string;
  assigned_to?: string;
  due_date?: string;
  notes?: string;
  recurrence?: RecurrencePattern;
  updated_at?: string;
  updated_by?: string;
  subtasks?: Subtask[];
  attachments?: Attachment[];
  transcription?: string;
  merged_from?: string[]; // IDs of tasks that were merged into this one
  reminder_at?: string; // Simple single reminder timestamp
  reminder_sent?: boolean; // Whether simple reminder has been sent
  reminders?: TaskReminder[]; // Multiple reminders (from task_reminders table)
  display_order?: number; // Manual sort order for drag-and-drop (lower = higher in list)
  team_id?: string; // Multi-tenancy: which team this task belongs to
  project_id?: string; // Which project this task belongs to
  start_date?: string; // When work on this task should begin
}

// ============================================
// Reminder Types
// ============================================

export type ReminderType = 'push_notification' | 'chat_message' | 'both';
export type ReminderStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface TaskReminder {
  id: string;
  todo_id: string;
  user_id?: string; // User to remind (null = assigned user)
  reminder_time: string;
  reminder_type: ReminderType;
  status: ReminderStatus;
  message?: string; // Custom reminder message
  sent_at?: string;
  error_message?: string;
  retry_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Preset reminder options for UI
export type ReminderPreset =
  | 'at_time'        // At specific time
  | '5_min_before'   // 5 minutes before due date
  | '15_min_before'  // 15 minutes before due date
  | '30_min_before'  // 30 minutes before due date
  | '1_hour_before'  // 1 hour before due date
  | '1_day_before'   // 1 day before due date
  | 'morning_of'     // 9 AM on due date
  | 'custom';        // Custom time selection

export interface ReminderPresetConfig {
  label: string;
  description: string;
  icon: string;
  calculateTime: (dueDate?: Date) => Date | null;
}

export const REMINDER_PRESETS: Record<ReminderPreset, ReminderPresetConfig> = {
  at_time: {
    label: 'At time',
    description: 'Remind at a specific time',
    icon: '⏰',
    calculateTime: () => null, // User selects time
  },
  '5_min_before': {
    label: '5 min before',
    description: '5 minutes before due time',
    icon: '⚡',
    calculateTime: (dueDate) => dueDate ? new Date(dueDate.getTime() - 5 * 60 * 1000) : null,
  },
  '15_min_before': {
    label: '15 min before',
    description: '15 minutes before due time',
    icon: '🔔',
    calculateTime: (dueDate) => dueDate ? new Date(dueDate.getTime() - 15 * 60 * 1000) : null,
  },
  '30_min_before': {
    label: '30 min before',
    description: '30 minutes before due time',
    icon: '⏱️',
    calculateTime: (dueDate) => dueDate ? new Date(dueDate.getTime() - 30 * 60 * 1000) : null,
  },
  '1_hour_before': {
    label: '1 hour before',
    description: '1 hour before due time',
    icon: '🕐',
    calculateTime: (dueDate) => dueDate ? new Date(dueDate.getTime() - 60 * 60 * 1000) : null,
  },
  '1_day_before': {
    label: '1 day before',
    description: '24 hours before due time',
    icon: '📅',
    calculateTime: (dueDate) => dueDate ? new Date(dueDate.getTime() - 24 * 60 * 60 * 1000) : null,
  },
  morning_of: {
    label: 'Morning of',
    description: '9 AM on the due date',
    icon: '🌅',
    calculateTime: (dueDate) => {
      if (!dueDate) return null;
      const morning = new Date(dueDate);
      morning.setHours(9, 0, 0, 0);
      return morning;
    },
  },
  custom: {
    label: 'Custom',
    description: 'Choose a specific date and time',
    icon: '📝',
    calculateTime: () => null, // User selects time
  },
};

export type SortOption = 'created' | 'due_date' | 'priority' | 'alphabetical' | 'custom' | 'urgency';
export type QuickFilter = 'all' | 'my_tasks' | 'due_today' | 'overdue';

export type ViewMode = 'list' | 'kanban';

export interface User {
  id: string;
  name: string;
  color: string;
  pin_hash?: string;
  email?: string;
  global_role?: GlobalRole;
  created_at?: string;
  last_login?: string;
}

export type UserRole = 'owner' | 'admin' | 'member';
export type GlobalRole = 'user' | 'super_admin';

// Import team types for re-export (uses Team terminology)
import type { TeamMembership, TeamRole, TeamPermissions } from './team';
export type { TeamMembership, TeamRole, TeamPermissions };

export interface AuthUser {
  id: string;
  name: string;
  color: string;
  email?: string;
  role: UserRole;
  global_role?: GlobalRole;
  created_at: string;
  last_login?: string;
  streak_count?: number;
  streak_last_date?: string;
  welcome_shown_at?: string;
  // Multi-tenancy fields
  teams?: TeamMembership[];
  current_team_id?: string;
  current_team_role?: TeamRole;
  current_team_permissions?: TeamPermissions;
}

export const PRIORITY_CONFIG: Record<TodoPriority, { label: string; color: string; bgColor: string; icon: string }> = {
  urgent: { label: 'Urgent', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)', icon: '!' },
  high: { label: 'High', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)', icon: '!!' },
  medium: { label: 'Medium', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)', icon: '-' },
  low: { label: 'Low', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)', icon: '...' },
};

export const STATUS_CONFIG: Record<TodoStatus, { label: string; color: string; bgColor: string }> = {
  todo: { label: 'To Do', color: '#6366f1', bgColor: 'rgba(99, 102, 241, 0.1)' },
  in_progress: { label: 'In Progress', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
  done: { label: 'Done', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
};

// Tapback reaction types (iMessage-style)
export type TapbackType = 'heart' | 'thumbsup' | 'thumbsdown' | 'haha' | 'exclamation' | 'question';

export interface MessageReaction {
  user: string;
  reaction: TapbackType;
  created_at: string;
}

// Chat message types
export interface ChatMessage {
  id: string;
  text: string;
  created_by: string;
  created_at: string;
  related_todo_id?: string;
  recipient?: string | null; // null = team chat, username = DM
  reactions?: MessageReaction[]; // Tapback reactions
  read_by?: string[]; // Users who have read this message
  reply_to_id?: string | null; // ID of message being replied to
  reply_to_text?: string | null; // Cached text of replied message
  reply_to_user?: string | null; // Cached user of replied message
  edited_at?: string | null; // Timestamp when message was edited
  deleted_at?: string | null; // Timestamp when message was deleted (soft delete)
  is_pinned?: boolean; // Whether message is pinned
  pinned_by?: string | null; // User who pinned the message
  pinned_at?: string | null; // When it was pinned
  mentions?: string[]; // Array of mentioned usernames
  team_id?: string; // Multi-tenancy: which team this message belongs to
}

// User presence status
export type PresenceStatus = 'online' | 'away' | 'offline' | 'dnd';

export interface UserPresence {
  user_name: string;
  status: PresenceStatus;
  last_seen: string;
  custom_status?: string;
}

// Muted conversation settings
export interface MutedConversation {
  conversation_key: string; // 'team' or username
  muted_until?: string | null; // null = forever, date = until then
}

// Chat conversation type
export type ChatConversation =
  | { type: 'team' }
  | { type: 'dm'; userName: string };

// Task Template types
export interface TemplateSubtask {
  text: string;
  priority: TodoPriority;
  estimatedMinutes?: number;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  default_priority: TodoPriority;
  default_assigned_to?: string;
  subtasks: TemplateSubtask[];
  created_by: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  team_id?: string; // Multi-tenancy: which team this template belongs to
}

// Activity Log types
export type ActivityAction =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'task_completed'
  | 'task_reopened'
  | 'status_changed'
  | 'priority_changed'
  | 'assigned_to_changed'
  | 'due_date_changed'
  | 'subtask_added'
  | 'subtask_completed'
  | 'subtask_deleted'
  | 'notes_updated'
  | 'template_created'
  | 'template_used'
  | 'attachment_added'
  | 'attachment_removed'
  | 'tasks_merged'
  | 'task_reordered'
  | 'reminder_added'
  | 'reminder_removed'
  | 'reminder_sent';

export interface ActivityLogEntry {
  id: string;
  action: ActivityAction;
  todo_id?: string;
  todo_text?: string;
  user_name: string;
  details: Record<string, unknown>;
  created_at: string;
  team_id?: string; // Multi-tenancy: which team this activity belongs to
}

// Activity feed is now accessible to all users (legacy constants kept for compatibility)
export const ACTIVITY_FEED_USERS: string[] = [];

// All users can now see all todos (legacy constants kept for compatibility)
export const FULL_VISIBILITY_USERS: string[] = [];

// Notification settings for activity feed
export interface ActivityNotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
  notifyOwnActions: boolean; // Also notify for your own actions (useful for testing)
}

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS: ActivityNotificationSettings = {
  enabled: true,
  soundEnabled: true,
  browserNotificationsEnabled: false,
  notifyOwnActions: false,
};

// Strategic Goals Types (Owner Dashboard)
export type GoalStatus = 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';

export interface GoalCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  display_order: number;
  created_at: string;
  team_id?: string; // Multi-tenancy: which team this category belongs to
}

export interface StrategicGoal {
  id: string;
  title: string;
  description?: string;
  category_id?: string;
  status: GoalStatus;
  priority: GoalPriority;
  target_date?: string;
  target_value?: string;
  current_value?: string;
  progress_percent: number;
  notes?: string;
  display_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  team_id?: string; // Multi-tenancy: which team this goal belongs to
  // Joined data
  category?: GoalCategory;
  milestones?: GoalMilestone[];
}

export interface GoalMilestone {
  id: string;
  goal_id: string;
  title: string;
  completed: boolean;
  target_date?: string;
  display_order: number;
  created_at: string;
}

export const GOAL_STATUS_CONFIG: Record<GoalStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  not_started: { label: 'Not Started', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)', icon: '○' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)', icon: '◐' },
  on_hold: { label: 'On Hold', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)', icon: '⏸' },
  completed: { label: 'Completed', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)', icon: '✓' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)', icon: '✕' },
};

export const GOAL_PRIORITY_CONFIG: Record<GoalPriority, { label: string; color: string; bgColor: string }> = {
  critical: { label: 'Critical', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
  high: { label: 'High', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
  medium: { label: 'Medium', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  low: { label: 'Low', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)' },
};

// REMOVED: OWNER_USERNAME constant - use role-based checks instead
// The isOwner() and isAdmin() functions now rely solely on the role field

/**
 * Check if a user has owner privileges
 * Supports both single-tenant (legacy) and multi-tenant modes
 *
 * In multi-tenant mode, checks current_team_role
 * In single-tenant mode, checks role
 */
export function isOwner(user: {
  role?: string;
  name?: string;
  current_team_role?: string;
} | null | undefined): boolean {
  if (!user) return false;

  // Multi-tenant: check team-specific role
  if (user.current_team_role === 'owner') return true;

  // Single-tenant: use role from database
  if (user.role === 'owner') return true;

  return false;
}

/**
 * Check if a user has admin privileges (owner or admin)
 * Supports both single-tenant (legacy) and multi-tenant modes
 */
export function isAdmin(user: {
  role?: string;
  name?: string;
  current_team_role?: string;
} | null | undefined): boolean {
  if (!user) return false;

  // Multi-tenant: check team-specific role
  if (user.current_team_role === 'owner' || user.current_team_role === 'admin') return true;

  // Single-tenant: use role from database
  if (user.role === 'owner' || user.role === 'admin') return true;

  return false;
}

/**
 * Check if a user can view strategic goals
 * In multi-tenant mode, checks permissions
 * In single-tenant mode, checks if user is admin
 */
export function canViewStrategicGoals(user: {
  role?: string;
  name?: string;
  current_team_role?: string;
  current_team_permissions?: { can_view_strategic_goals?: boolean };
} | null | undefined): boolean {
  if (!user) return false;

  // Multi-tenant: check team permissions
  if (user.current_team_permissions?.can_view_strategic_goals) return true;

  // Fall back to admin check
  return isAdmin(user);
}

// ============================================
// Task Completion & Celebration Types
// ============================================

// Task category for pattern analysis (Feature 4)
// Academic task categories for research and coursework management
export type TaskCategory =
  | 'research'         // Literature review, data collection, experiments, studies
  | 'meeting'          // Advisor meetings, committee, lab meetings, seminars, office hours
  | 'analysis'         // Statistics, data analysis, results, R, Python, SPSS
  | 'submission'       // Submit deadlines, conference, journal submissions
  | 'revision'         // Revisions, edits, feedback, reviewer comments
  | 'presentation'     // Defense, poster, talks, slides, conference presentations
  | 'writing'          // Draft, paper, manuscript, thesis, dissertation, abstract
  | 'reading'          // Articles, chapters, textbook, review papers
  | 'coursework'       // Assignments, homework, exams, quizzes, grades
  | 'admin'            // Forms, registration, IRB, grant administration
  | 'other';

// Task pattern learned from historical data
export interface TaskPattern {
  id: string;
  pattern_text: string;
  category: TaskCategory;
  occurrence_count: number;
  avg_priority: TodoPriority;
  common_subtasks: string[];
  last_occurrence: string;
  created_at: string;
  updated_at?: string;
}

// Quick task template for common insurance tasks
export interface QuickTaskTemplate {
  text: string;
  category: TaskCategory;
  defaultPriority: TodoPriority;
  suggestedSubtasks: string[];
  icon?: string;
}

// Celebration data for enhanced completion feedback
export interface CelebrationData {
  completedTask: Todo;
  nextTasks: Todo[];
  streakCount: number;
  encouragementMessage: string;
}

// Celebration intensity levels
export type CelebrationIntensity = 'light' | 'medium' | 'high';

// Task completion summary for copying to external systems
export interface TaskCompletionSummaryData {
  taskText: string;
  completedBy: string;
  completedAt: string;
  priority: TodoPriority;
  assignedTo?: string;
  dueDate?: string;
  subtasksCompleted: number;
  subtasksTotal: number;
  subtaskDetails: Array<{ text: string; completed: boolean }>;
  notes?: string;
  attachments: string[];
  transcription?: string;
}

// Academic quick task definitions for research and coursework management
export const ACADEMIC_QUICK_TASKS: QuickTaskTemplate[] = [
  // Research tasks - literature review, experiments, data collection
  {
    text: 'Literature review: [topic]',
    category: 'research',
    defaultPriority: 'medium',
    suggestedSubtasks: [
      'Search databases for relevant papers',
      'Read and annotate key articles',
      'Identify themes and gaps',
      'Write synthesis summary',
    ],
    icon: '🔬',
  },
  // Writing tasks - papers, manuscripts, thesis
  {
    text: 'Write [section] for [paper/thesis]',
    category: 'writing',
    defaultPriority: 'high',
    suggestedSubtasks: [
      'Create outline',
      'Write first draft',
      'Add citations and references',
      'Revise and edit',
    ],
    icon: '✍️',
  },
  // Analysis tasks - data analysis, statistics
  {
    text: 'Data analysis: [dataset/project]',
    category: 'analysis',
    defaultPriority: 'medium',
    suggestedSubtasks: [
      'Clean and prepare data',
      'Run statistical analyses',
      'Create visualizations',
      'Document results',
    ],
    icon: '📊',
  },
  // Submission tasks - conference, journal submissions
  {
    text: 'Submit to [conference/journal]',
    category: 'submission',
    defaultPriority: 'urgent',
    suggestedSubtasks: [
      'Review submission guidelines',
      'Format manuscript',
      'Prepare supplementary materials',
      'Complete submission form',
      'Verify submission receipt',
    ],
    icon: '📤',
  },
  // Meeting tasks - advisor, committee, lab meetings
  {
    text: 'Meeting with [advisor/committee]',
    category: 'meeting',
    defaultPriority: 'high',
    suggestedSubtasks: [
      'Prepare agenda and materials',
      'Review previous meeting notes',
      'Prepare progress update',
      'Document action items after meeting',
    ],
    icon: '👥',
  },
  // Presentation tasks - defense, conference talks
  {
    text: 'Prepare presentation: [topic]',
    category: 'presentation',
    defaultPriority: 'high',
    suggestedSubtasks: [
      'Create slide deck',
      'Prepare speaker notes',
      'Practice presentation',
      'Get feedback and revise',
    ],
    icon: '🎤',
  },
  // Reading tasks - articles, textbooks
  {
    text: 'Read [article/chapter]: [title]',
    category: 'reading',
    defaultPriority: 'medium',
    suggestedSubtasks: [
      'First pass reading',
      'Take detailed notes',
      'Identify key concepts',
      'Summarize main findings',
    ],
    icon: '📚',
  },
  // Coursework tasks - assignments, homework
  {
    text: 'Complete [assignment] for [course]',
    category: 'coursework',
    defaultPriority: 'high',
    suggestedSubtasks: [
      'Review assignment requirements',
      'Gather resources',
      'Complete main work',
      'Review and proofread',
      'Submit before deadline',
    ],
    icon: '📝',
  },
  // Revision tasks - paper revisions, reviewer comments
  {
    text: 'Address reviewer comments: [paper]',
    category: 'revision',
    defaultPriority: 'high',
    suggestedSubtasks: [
      'Read all reviewer comments',
      'Create response document',
      'Make revisions to manuscript',
      'Write point-by-point response',
      'Submit revision',
    ],
    icon: '🔄',
  },
  // Admin tasks - forms, IRB, grants
  {
    text: 'Complete [form/application]',
    category: 'admin',
    defaultPriority: 'medium',
    suggestedSubtasks: [
      'Gather required information',
      'Complete all sections',
      'Get necessary signatures',
      'Submit and confirm receipt',
    ],
    icon: '📋',
  },
];
