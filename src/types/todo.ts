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
}

export type SortOption = 'created' | 'due_date' | 'priority' | 'alphabetical' | 'custom' | 'urgency';
export type QuickFilter = 'all' | 'my_tasks' | 'due_today' | 'overdue';

export type ViewMode = 'list' | 'kanban';

export interface User {
  id: string;
  name: string;
  color: string;
  pin_hash?: string;
  created_at?: string;
  last_login?: string;
}

export type UserRole = 'admin' | 'member';

export interface AuthUser {
  id: string;
  name: string;
  color: string;
  role: UserRole;
  created_at: string;
  last_login?: string;
  streak_count?: number;
  streak_last_date?: string;
  welcome_shown_at?: string;
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
  | 'tasks_merged';

export interface ActivityLogEntry {
  id: string;
  action: ActivityAction;
  todo_id?: string;
  todo_text?: string;
  user_name: string;
  details: Record<string, unknown>;
  created_at: string;
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

// Owner username for dashboard access
export const OWNER_USERNAME = 'Derrick';

// ============================================
// Task Completion & Celebration Types
// ============================================

// Task category for pattern analysis (Feature 4)
export type TaskCategory =
  | 'policy_review'
  | 'vehicle_add'
  | 'new_client'
  | 'claim'
  | 'payment'
  | 'quote'
  | 'documentation'
  | 'follow_up'
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

// Insurance-specific quick task definitions
export const INSURANCE_QUICK_TASKS: QuickTaskTemplate[] = [
  {
    text: 'Policy review for [customer]',
    category: 'policy_review',
    defaultPriority: 'medium',
    icon: '📋',
    suggestedSubtasks: [
      'Review current coverage limits',
      'Check for discount opportunities',
      'Verify contact information',
      'Prepare renewal quote',
    ],
  },
  {
    text: 'Add vehicle to policy - [customer]',
    category: 'vehicle_add',
    defaultPriority: 'high',
    icon: '🚗',
    suggestedSubtasks: [
      'Collect VIN and vehicle information',
      'Verify registration',
      'Calculate premium change',
      'Update policy and send new dec page',
    ],
  },
  {
    text: 'New client onboarding - [customer]',
    category: 'new_client',
    defaultPriority: 'high',
    icon: '👤',
    suggestedSubtasks: [
      'Gather customer information',
      'Pull MVR for all drivers',
      'Run quotes with multiple carriers',
      'Present options and bind coverage',
      'Set up account in management system',
      'Send welcome packet',
    ],
  },
  {
    text: 'Process claim for [customer]',
    category: 'claim',
    defaultPriority: 'urgent',
    icon: '⚠️',
    suggestedSubtasks: [
      'File claim with carrier',
      'Document incident details',
      'Coordinate with adjuster',
      'Follow up on claim status',
      'Update customer on progress',
    ],
  },
  {
    text: 'Quote request - [customer]',
    category: 'quote',
    defaultPriority: 'medium',
    icon: '💰',
    suggestedSubtasks: [
      'Gather customer information',
      'Run quotes with carriers',
      'Compare coverage options',
      'Prepare and send proposal',
    ],
  },
  {
    text: 'Payment/billing issue - [customer]',
    category: 'payment',
    defaultPriority: 'high',
    icon: '💳',
    suggestedSubtasks: [
      'Review account status',
      'Contact carrier if needed',
      'Resolve payment issue',
      'Confirm with customer',
    ],
  },
];
