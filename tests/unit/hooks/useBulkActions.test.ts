/**
 * useBulkActions Hook Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkActions } from '@/hooks/useBulkActions';
import { useTodoStore } from '@/store/todoStore';
import { Todo } from '@/types/todo';

// Mock Supabase - using supabaseClient path which is the actual import
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ error: null })),
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      update: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ error: null })),
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
  isSupabaseConfigured: () => true,
}));

// Mock activity logger
vi.mock('@/lib/activityLogger', () => ({
  logActivity: vi.fn(),
}));

// Helper to create a mock todo
const createMockTodo = (overrides: Partial<Todo> = {}): Todo => ({
  id: `todo-${Date.now()}-${Math.random()}`,
  text: 'Test todo',
  completed: false,
  status: 'todo',
  priority: 'medium',
  created_at: new Date().toISOString(),
  created_by: 'TestUser',
  ...overrides,
});

describe('useBulkActions', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useTodoStore.getState();
    store.setTodos([]);
    store.clearSelection();
  });

  describe('Selection State', () => {
    it('should return initial empty selection', () => {
      const { result } = renderHook(() => useBulkActions('TestUser'));

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.showBulkActions).toBe(false);
    });

    it('should handle single todo selection', () => {
      const todo = createMockTodo({ id: 'todo-1' });

      act(() => {
        useTodoStore.getState().setTodos([todo]);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      act(() => {
        result.current.handleSelectTodo('todo-1', true);
      });

      expect(result.current.selectedCount).toBe(1);
      expect(result.current.selectedTodos.has('todo-1')).toBe(true);
    });

    it('should toggle todo selection off', () => {
      const todo = createMockTodo({ id: 'todo-1' });

      act(() => {
        useTodoStore.getState().setTodos([todo]);
        useTodoStore.getState().toggleTodoSelection('todo-1');
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      expect(result.current.selectedCount).toBe(1);

      act(() => {
        result.current.handleSelectTodo('todo-1', false);
      });

      expect(result.current.selectedCount).toBe(0);
    });

    it('should select all todos', () => {
      const todos = [
        createMockTodo({ id: 'todo-1' }),
        createMockTodo({ id: 'todo-2' }),
        createMockTodo({ id: 'todo-3' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      act(() => {
        result.current.selectAll(['todo-1', 'todo-2', 'todo-3']);
      });

      expect(result.current.selectedCount).toBe(3);
      expect(result.current.showBulkActions).toBe(true);
    });

    it('should clear selection', () => {
      const todo = createMockTodo({ id: 'todo-1' });

      act(() => {
        useTodoStore.getState().setTodos([todo]);
        useTodoStore.getState().toggleTodoSelection('todo-1');
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      expect(result.current.selectedCount).toBe(1);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.showBulkActions).toBe(false);
    });

    it('should get selected todos', () => {
      const todos = [
        createMockTodo({ id: 'todo-1', text: 'First' }),
        createMockTodo({ id: 'todo-2', text: 'Second' }),
        createMockTodo({ id: 'todo-3', text: 'Third' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().toggleTodoSelection('todo-1');
        useTodoStore.getState().toggleTodoSelection('todo-3');
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      const selectedTodos = result.current.getSelectedTodos();

      expect(selectedTodos).toHaveLength(2);
      expect(selectedTodos.map(t => t.id)).toContain('todo-1');
      expect(selectedTodos.map(t => t.id)).toContain('todo-3');
    });
  });

  describe('Bulk Complete', () => {
    it('should complete selected todos optimistically', async () => {
      const todos = [
        createMockTodo({ id: 'todo-1', completed: false }),
        createMockTodo({ id: 'todo-2', completed: false }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      await act(async () => {
        await result.current.bulkComplete();
      });

      // Check store was updated
      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos.every(t => t.completed)).toBe(true);
      expect(storeTodos.every(t => t.status === 'done')).toBe(true);

      // Selection should be cleared
      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('Bulk Assign', () => {
    it('should assign selected todos to a user', async () => {
      const todos = [
        createMockTodo({ id: 'todo-1', assigned_to: undefined }),
        createMockTodo({ id: 'todo-2', assigned_to: 'OldUser' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      await act(async () => {
        await result.current.bulkAssign('NewUser');
      });

      // Check store was updated
      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos.every(t => t.assigned_to === 'NewUser')).toBe(true);

      // Selection should be cleared
      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('Bulk Reschedule', () => {
    it('should reschedule selected todos', async () => {
      const todos = [
        createMockTodo({ id: 'todo-1', due_date: '2025-01-01' }),
        createMockTodo({ id: 'todo-2', due_date: undefined }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      await act(async () => {
        await result.current.bulkReschedule('2025-06-15');
      });

      // Check store was updated
      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos.every(t => t.due_date === '2025-06-15')).toBe(true);

      // Selection should be cleared
      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('Bulk Set Priority', () => {
    it('should set priority for selected todos', async () => {
      const todos = [
        createMockTodo({ id: 'todo-1', priority: 'low' }),
        createMockTodo({ id: 'todo-2', priority: 'medium' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      await act(async () => {
        await result.current.bulkSetPriority('urgent');
      });

      // Check store was updated
      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos.every(t => t.priority === 'urgent')).toBe(true);

      // Selection should be cleared
      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('Date Offset Helper', () => {
    it('should return correct date for today (offset 0)', () => {
      const { result } = renderHook(() => useBulkActions('TestUser'));

      const today = result.current.getDateOffset(0);
      const expected = new Date().toISOString().split('T')[0];

      expect(today).toBe(expected);
    });

    it('should return correct date for tomorrow (offset 1)', () => {
      const { result } = renderHook(() => useBulkActions('TestUser'));

      const tomorrow = result.current.getDateOffset(1);
      const expected = new Date();
      expected.setDate(expected.getDate() + 1);

      expect(tomorrow).toBe(expected.toISOString().split('T')[0]);
    });

    it('should return correct date for next week (offset 7)', () => {
      const { result } = renderHook(() => useBulkActions('TestUser'));

      const nextWeek = result.current.getDateOffset(7);
      const expected = new Date();
      expected.setDate(expected.getDate() + 7);

      expect(nextWeek).toBe(expected.toISOString().split('T')[0]);
    });
  });

  describe('Show Bulk Actions', () => {
    it('should toggle show bulk actions', () => {
      const { result } = renderHook(() => useBulkActions('TestUser'));

      expect(result.current.showBulkActions).toBe(false);

      act(() => {
        result.current.setShowBulkActions(true);
      });

      expect(result.current.showBulkActions).toBe(true);
    });
  });

  describe('Bulk Delete', () => {
    it('should call onConfirm callback with count and action', async () => {
      const todos = [
        createMockTodo({ id: 'todo-1', text: 'First' }),
        createMockTodo({ id: 'todo-2', text: 'Second' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      const mockOnConfirm = vi.fn();

      await act(async () => {
        await result.current.bulkDelete(mockOnConfirm);
      });

      expect(mockOnConfirm).toHaveBeenCalledWith(2, expect.any(Function));
    });

    it('should delete todos when confirm action is executed', async () => {
      const todos = [
        createMockTodo({ id: 'todo-1', text: 'First' }),
        createMockTodo({ id: 'todo-2', text: 'Second' }),
        createMockTodo({ id: 'todo-3', text: 'Third' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      await act(async () => {
        await result.current.bulkDelete(async (count, action) => {
          await action();
        });
      });

      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos).toHaveLength(1);
      expect(storeTodos[0].id).toBe('todo-3');
      expect(result.current.selectedCount).toBe(0);
    });

    it('should not call callback when no todos selected', async () => {
      const { result } = renderHook(() => useBulkActions('TestUser'));
      const mockOnConfirm = vi.fn();

      await act(async () => {
        await result.current.bulkDelete(mockOnConfirm);
      });

      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Error Rollback', () => {
    it('should rollback bulkAssign on error', async () => {
      // Mock supabase to return error
      const { supabase } = await import('@/lib/supabaseClient');
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ error: new Error('DB error') })),
        })),
      } as any);

      const todos = [
        createMockTodo({ id: 'todo-1', assigned_to: 'OldUser' }),
        createMockTodo({ id: 'todo-2', assigned_to: 'OldUser' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      await act(async () => {
        await result.current.bulkAssign('NewUser');
      });

      // Should rollback to original assigned_to
      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos.every(t => t.assigned_to === 'OldUser')).toBe(true);
    });

    it('should rollback bulkComplete on error', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ error: new Error('DB error') })),
        })),
      } as any);

      const todos = [
        createMockTodo({ id: 'todo-1', completed: false, status: 'todo' }),
        createMockTodo({ id: 'todo-2', completed: false, status: 'in_progress' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      await act(async () => {
        await result.current.bulkComplete();
      });

      // Should rollback to original completed/status
      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos.find(t => t.id === 'todo-1')?.completed).toBe(false);
      expect(storeTodos.find(t => t.id === 'todo-1')?.status).toBe('todo');
      expect(storeTodos.find(t => t.id === 'todo-2')?.status).toBe('in_progress');
    });

    it('should rollback bulkReschedule on error', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ error: new Error('DB error') })),
        })),
      } as any);

      const todos = [
        createMockTodo({ id: 'todo-1', due_date: '2025-01-01' }),
        createMockTodo({ id: 'todo-2', due_date: '2025-02-01' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      await act(async () => {
        await result.current.bulkReschedule('2025-06-15');
      });

      // Should rollback to original due_date
      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos.find(t => t.id === 'todo-1')?.due_date).toBe('2025-01-01');
      expect(storeTodos.find(t => t.id === 'todo-2')?.due_date).toBe('2025-02-01');
    });

    it('should rollback bulkSetPriority on error', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ error: new Error('DB error') })),
        })),
      } as any);

      const todos = [
        createMockTodo({ id: 'todo-1', priority: 'low' }),
        createMockTodo({ id: 'todo-2', priority: 'medium' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      await act(async () => {
        await result.current.bulkSetPriority('urgent');
      });

      // Should rollback to original priority
      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos.find(t => t.id === 'todo-1')?.priority).toBe('low');
      expect(storeTodos.find(t => t.id === 'todo-2')?.priority).toBe('medium');
    });

    it('should rollback bulkDelete on error', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ error: new Error('DB error') })),
        })),
      } as any);

      const todos = [
        createMockTodo({ id: 'todo-1', text: 'First' }),
        createMockTodo({ id: 'todo-2', text: 'Second' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      await act(async () => {
        await result.current.bulkDelete(async (_count, action) => {
          await action();
        });
      });

      // Should rollback - todos should be restored
      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos).toHaveLength(2);
    });
  });

  describe('Merge Todos', () => {
    it('should merge multiple todos into one', async () => {
      const todos = [
        createMockTodo({
          id: 'primary',
          text: 'Primary task',
          notes: 'Note 1',
          priority: 'medium',
          subtasks: [{ id: 's1', text: 'Sub 1', completed: false, priority: 'medium' as const }],
        }),
        createMockTodo({
          id: 'secondary',
          text: 'Secondary task',
          notes: 'Note 2',
          priority: 'high',
          subtasks: [{ id: 's2', text: 'Sub 2', completed: false, priority: 'medium' as const }],
        }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['primary', 'secondary']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      let mergeResult: boolean = false;
      await act(async () => {
        mergeResult = await result.current.mergeTodos('primary');
      });

      expect(mergeResult).toBe(true);

      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos).toHaveLength(1);
      expect(storeTodos[0].id).toBe('primary');
      expect(storeTodos[0].text).toContain('[+1 merged]');
      expect(storeTodos[0].priority).toBe('high'); // Higher priority kept
    });

    it('should return false when less than 2 todos selected', async () => {
      const todos = [createMockTodo({ id: 'todo-1' })];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      let mergeResult: boolean = true;
      await act(async () => {
        mergeResult = await result.current.mergeTodos('todo-1');
      });

      expect(mergeResult).toBe(false);
    });

    it('should return false when primary todo not found', async () => {
      const todos = [
        createMockTodo({ id: 'todo-1' }),
        createMockTodo({ id: 'todo-2' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      let mergeResult: boolean = true;
      await act(async () => {
        mergeResult = await result.current.mergeTodos('non-existent');
      });

      expect(mergeResult).toBe(false);
    });

    it('should return false when merge update fails', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: new Error('Update failed') })),
        })),
      } as any);

      const todos = [
        createMockTodo({ id: 'primary', text: 'Primary' }),
        createMockTodo({ id: 'secondary', text: 'Secondary' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['primary', 'secondary']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      let mergeResult: boolean = true;
      await act(async () => {
        mergeResult = await result.current.mergeTodos('primary');
      });

      expect(mergeResult).toBe(false);
    });

    it('should return false when merge delete fails', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      // First call for update succeeds
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      } as any);
      // Second call for delete fails
      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ error: new Error('Delete failed') })),
        })),
      } as any);

      const todos = [
        createMockTodo({ id: 'primary', text: 'Primary' }),
        createMockTodo({ id: 'secondary', text: 'Secondary' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['primary', 'secondary']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      let mergeResult: boolean = true;
      await act(async () => {
        mergeResult = await result.current.mergeTodos('primary');
      });

      expect(mergeResult).toBe(false);
    });

    it('should combine attachments from all todos', async () => {
      const todos = [
        createMockTodo({
          id: 'primary',
          text: 'Primary',
          attachments: [{ id: 'a1', file_name: 'file1.pdf', file_type: 'pdf', file_size: 100, storage_path: 'path/file1.pdf', mime_type: 'application/pdf', uploaded_by: 'TestUser', uploaded_at: new Date().toISOString() }],
        }),
        createMockTodo({
          id: 'secondary',
          text: 'Secondary',
          attachments: [{ id: 'a2', file_name: 'file2.pdf', file_type: 'pdf', file_size: 200, storage_path: 'path/file2.pdf', mime_type: 'application/pdf', uploaded_by: 'TestUser', uploaded_at: new Date().toISOString() }],
        }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['primary', 'secondary']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      await act(async () => {
        await result.current.mergeTodos('primary');
      });

      const mergedTodo = useTodoStore.getState().todos.find(t => t.id === 'primary');
      expect(mergedTodo?.attachments).toHaveLength(2);
    });

    it('should keep urgent priority over lower priorities', async () => {
      const todos = [
        createMockTodo({ id: 'primary', priority: 'low' }),
        createMockTodo({ id: 'secondary', priority: 'urgent' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(['primary', 'secondary']);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      await act(async () => {
        await result.current.mergeTodos('primary');
      });

      const mergedTodo = useTodoStore.getState().todos.find(t => t.id === 'primary');
      expect(mergedTodo?.priority).toBe('urgent');
    });
  });
});
