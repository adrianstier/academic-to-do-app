export type TodoStatus = 'todo' | 'in_progress' | 'done';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  status: TodoStatus;
  created_at: string;
  created_by: string;
}

export type ViewMode = 'list' | 'kanban';

export interface User {
  id: string;
  name: string;
  color: string;
}
