import { ActivityAction } from '@/types/todo';
import { logger } from '@/lib/logger';
import { fetchWithCsrf } from '@/lib/csrf';

interface LogActivityParams {
  action: ActivityAction;
  userName: string;
  todoId?: string;
  todoText?: string;
  details?: Record<string, unknown>;
}

export async function logActivity({ action, userName, todoId, todoText, details }: LogActivityParams): Promise<void> {
  // Skip in test mode to avoid 500 errors with non-existent test users
  if (typeof window !== 'undefined' && localStorage.getItem('__test_mode__') === 'true') return;

  try {
    await fetchWithCsrf('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        user_name: userName,
        todo_id: todoId,
        todo_text: todoText,
        details: details || {},
      }),
    });
  } catch (error) {
    // Silently fail - activity logging shouldn't break the app
    logger.error('Failed to log activity', error, { component: 'ActivityLogger' });
  }
}
