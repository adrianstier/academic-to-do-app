import { Task, CreateTaskInput, UpdateTaskInput, TaskStats, Note } from '@/types/task';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5566';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function getTasks(params?: {
  status?: string;
  priority?: string;
  category?: string;
  assignee?: string;
  search?: string;
  overdue?: boolean;
}): Promise<Task[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.priority) searchParams.set('priority', params.priority);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.assignee) searchParams.set('assignee', params.assignee);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.overdue) searchParams.set('overdue', 'true');

  const queryString = searchParams.toString();
  const endpoint = `/tasks${queryString ? `?${queryString}` : ''}`;

  return fetchApi<Task[]>(endpoint);
}

export async function getTask(id: string): Promise<Task> {
  return fetchApi<Task>(`/tasks/${id}`);
}

export async function getTaskStats(): Promise<TaskStats> {
  return fetchApi<TaskStats>('/tasks/stats');
}

export async function getCategories(): Promise<string[]> {
  return fetchApi<string[]>('/tasks/categories');
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return fetchApi<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  return fetchApi<Task>(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteTask(id: string): Promise<void> {
  return fetchApi<void>(`/tasks/${id}`, {
    method: 'DELETE',
  });
}

export async function addNote(taskId: string, content: string, author: string): Promise<Note> {
  return fetchApi<Note>(`/tasks/${taskId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content, author }),
  });
}

export async function deleteNote(taskId: string, noteId: string): Promise<void> {
  return fetchApi<void>(`/tasks/${taskId}/notes/${noteId}`, {
    method: 'DELETE',
  });
}

export async function bulkUpdateTasks(
  ids: string[],
  action: 'delete' | 'update',
  data?: { status?: string; priority?: string; assignee?: string; category?: string }
): Promise<{ message: string }> {
  return fetchApi<{ message: string }>('/tasks/bulk', {
    method: 'POST',
    body: JSON.stringify({ ids, action, data }),
  });
}

export async function clearAllTasks(): Promise<{ message: string }> {
  return fetchApi<{ message: string }>('/tasks/all', {
    method: 'DELETE',
  });
}
