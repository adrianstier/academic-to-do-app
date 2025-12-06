export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface Note {
  id: string;
  content: string;
  author: string;
  taskId: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: string | null;
  assignee: string | null;
  dueDate: string | null;
  reminderTime: string | null;
  reminderSent: boolean;
  sourceEmailId: string | null;
  sourceEmailFrom: string | null;
  sourceEmailReceived: string | null;
  createdAt: string;
  updatedAt: string;
  notes: Note[];
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: string;
  assignee?: string;
  dueDate?: string;
  reminderTime?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: string;
  assignee?: string;
  dueDate?: string | null;
  reminderTime?: string | null;
}

export interface TaskStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byAssignee: Record<string, number>;
  overdue: number;
  dueToday: number;
  dueSoon: number;
}
