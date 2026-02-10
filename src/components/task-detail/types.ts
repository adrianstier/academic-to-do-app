import type {
  Todo,
  TodoPriority,
  TodoStatus,
  RecurrencePattern,
  Subtask,
  Attachment,
} from '@/types/todo';

export interface TaskDetailModalProps {
  todo: Todo;
  isOpen: boolean;
  onClose: () => void;
  users: string[];
  currentUserName: string;

  // Core handlers — match existing signatures from TodoItem/KanbanBoard
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onStatusChange?: (id: string, status: TodoStatus) => void;
  onUpdateText?: (id: string, text: string) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onSetRecurrence?: (id: string, recurrence: RecurrencePattern) => void;
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => void;
  onUpdateAttachments?: (id: string, attachments: Attachment[], skipDbUpdate?: boolean) => void;
  onSetReminder?: (id: string, reminderAt: string | null) => void;

  // Action handlers
  onDuplicate?: (todo: Todo) => void;
  onSaveAsTemplate?: (todo: Todo) => void;
}

export interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  defaultOpen?: boolean;
  accentColor?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}
