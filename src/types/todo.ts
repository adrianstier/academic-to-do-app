export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
  created_by: string;
}

export interface User {
  id: string;
  name: string;
  color: string;
}
