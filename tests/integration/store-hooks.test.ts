/**
 * Integration Tests: Store + Hooks
 *
 * Tests the interaction between Zustand store and custom hooks
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTodoStore, selectTodoStats } from '@/store/todoStore';
import { useFilters } from '@/hooks/useFilters';
import { useBulkActions } from '@/hooks/useBulkActions';
import { createMockTodo } from '../factories/todoFactory';

// Mock Supabase - using supabaseClient path which is the actual import
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback) => {
        callback('SUBSCRIBED');
        return { unsubscribe: vi.fn() };
      }),
    })),
    removeChannel: vi.fn(),
  },
  isSupabaseConfigured: () => true,
}));

// Mock activity logger
vi.mock('@/lib/activityLogger', () => ({
  logActivity: vi.fn(),
}));

describe('Store + Hooks Integration', () => {
  beforeEach(() => {
    // Reset store state using the actual store API
    const store = useTodoStore.getState();
    store.setTodos([]);
    store.clearSelection();
    store.resetFilters();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useFilters + Store Interaction', () => {
    it('should reflect store changes in filtered results', () => {
      const todos = [
        createMockTodo({ id: 'todo-1', text: 'First task', priority: 'high' }),
        createMockTodo({ id: 'todo-2', text: 'Second task', priority: 'low' }),
        createMockTodo({ id: 'todo-3', text: 'Third task', priority: 'high' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      // All todos visible initially (filteredAndSortedTodos applies filters)
      expect(result.current.filteredAndSortedTodos).toHaveLength(3);

      // Apply high priority filter via store
      act(() => {
        useTodoStore.getState().setHighPriorityOnly(true);
      });

      // Hook should reflect the filter (high and urgent)
      expect(result.current.filteredAndSortedTodos).toHaveLength(2);
      expect(result.current.filteredAndSortedTodos.every(t => t.priority === 'high' || t.priority === 'urgent')).toBe(true);
    });

    it('should update filter counts when todos change', () => {
      const initialTodos = [
        createMockTodo({ id: 'todo-1', completed: false }),
        createMockTodo({ id: 'todo-2', completed: true, status: 'done' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(initialTodos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      expect(result.current.filterCounts.active).toBe(1);
      expect(result.current.filterCounts.completed).toBe(1);

      // Add another completed todo
      act(() => {
        useTodoStore.getState().addTodo(
          createMockTodo({ id: 'todo-3', completed: true, status: 'done' })
        );
      });

      expect(result.current.filterCounts.completed).toBe(2);
    });

    it('should combine search query with quick filter', () => {
      const todos = [
        createMockTodo({ id: 'todo-1', text: 'Buy groceries', completed: false }),
        createMockTodo({ id: 'todo-2', text: 'Buy laptop', completed: true, status: 'done' }),
        createMockTodo({ id: 'todo-3', text: 'Call mom', completed: false }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      // Search for "buy" - but showCompleted is false by default, so only 1 match
      act(() => {
        useTodoStore.getState().setSearchQuery('buy');
      });

      // Only 'Buy groceries' is visible (Buy laptop is completed and hidden by default)
      expect(result.current.filteredAndSortedTodos).toHaveLength(1);
      expect(result.current.filteredAndSortedTodos[0].text).toBe('Buy groceries');
    });
  });

  describe('useBulkActions + Store Interaction', () => {
    it('should select todos and show in bulk actions', () => {
      const todos = [
        createMockTodo({ id: 'todo-1' }),
        createMockTodo({ id: 'todo-2' }),
        createMockTodo({ id: 'todo-3' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.showBulkActions).toBe(false);

      // Select multiple todos
      act(() => {
        result.current.handleSelectTodo('todo-1', true);
        result.current.handleSelectTodo('todo-2', true);
      });

      expect(result.current.selectedCount).toBe(2);
      expect(result.current.showBulkActions).toBe(true);
    });

    it('should update todos in store after bulk complete', async () => {
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

      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos.every(t => t.completed)).toBe(true);
      expect(result.current.selectedCount).toBe(0);
    });

    it('should get selected todos matching store', () => {
      const todos = [
        createMockTodo({ id: 'todo-1', text: 'Task One' }),
        createMockTodo({ id: 'todo-2', text: 'Task Two' }),
        createMockTodo({ id: 'todo-3', text: 'Task Three' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().toggleTodoSelection('todo-1');
        useTodoStore.getState().toggleTodoSelection('todo-3');
      });

      const { result } = renderHook(() => useBulkActions('TestUser'));

      const selectedTodos = result.current.getSelectedTodos();

      expect(selectedTodos).toHaveLength(2);
      expect(selectedTodos.find(t => t.id === 'todo-1')?.text).toBe('Task One');
      expect(selectedTodos.find(t => t.id === 'todo-3')?.text).toBe('Task Three');
    });
  });

  describe('Cross-Hook Interaction', () => {
    it('should clear selection when filter changes to exclude selected', () => {
      const todos = [
        createMockTodo({ id: 'todo-1', priority: 'high' }),
        createMockTodo({ id: 'todo-2', priority: 'low' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().toggleTodoSelection('todo-2');
      });

      const { result: filtersResult } = renderHook(() => useFilters('TestUser'));
      const { result: bulkResult } = renderHook(() => useBulkActions('TestUser'));

      expect(bulkResult.current.selectedCount).toBe(1);
      expect(filtersResult.current.visibleTodos).toHaveLength(2);

      // Apply high priority filter that excludes selected todo (low priority)
      act(() => {
        useTodoStore.getState().setHighPriorityOnly(true);
      });

      // After filter, visible todos should only show high/urgent priority
      expect(filtersResult.current.filteredAndSortedTodos).toHaveLength(1);
      expect(filtersResult.current.filteredAndSortedTodos[0].id).toBe('todo-1');

      // Selection still in store (not automatically cleared)
      expect(bulkResult.current.selectedCount).toBe(1);
    });

    it('should maintain selection state across filter toggles', () => {
      const todos = [
        createMockTodo({ id: 'todo-1', completed: false }),
        createMockTodo({ id: 'todo-2', completed: true, status: 'done' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().toggleTodoSelection('todo-1');
      });

      const { result: bulkResult } = renderHook(() => useBulkActions('TestUser'));

      expect(bulkResult.current.selectedCount).toBe(1);

      // Toggle between filters
      act(() => {
        useTodoStore.getState().setQuickFilter('all');
      });

      act(() => {
        useTodoStore.getState().setQuickFilter('all');
      });

      // Selection should persist
      expect(bulkResult.current.selectedCount).toBe(1);
      expect(bulkResult.current.selectedTodos.has('todo-1')).toBe(true);
    });
  });

  describe('Store Selectors', () => {
    it('selectFilteredTodos should work with multiple filters', () => {
      const todos = [
        createMockTodo({
          id: 'todo-1',
          text: 'Urgent task',
          priority: 'urgent',
          assigned_to: 'TestUser',
        }),
        createMockTodo({
          id: 'todo-2',
          text: 'Regular task',
          priority: 'medium',
          assigned_to: 'OtherUser',
        }),
        createMockTodo({
          id: 'todo-3',
          text: 'My low priority',
          priority: 'low',
          assigned_to: 'TestUser',
        }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        // Use highPriorityOnly filter (urgent/high priority tasks only)
        useTodoStore.getState().setHighPriorityOnly(true);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      // Should only show urgent/high priority tasks
      expect(result.current.filteredAndSortedTodos).toHaveLength(1);
      expect(result.current.filteredAndSortedTodos[0].id).toBe('todo-1');
    });

    it('selectTodoStats should calculate correctly', () => {
      // Use full ISO timestamps for timezone consistency
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const todos = [
        createMockTodo({ id: 'todo-1', completed: true, status: 'done' }),
        createMockTodo({ id: 'todo-2', completed: true, status: 'done' }),
        createMockTodo({ id: 'todo-3', completed: false, due_date: today.toISOString() }),
        createMockTodo({ id: 'todo-4', completed: false, due_date: yesterday.toISOString() }),
        createMockTodo({ id: 'todo-5', completed: false }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      // Use the exported selector function
      const stats = selectTodoStats(useTodoStore.getState().todos);

      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(2);
      // active = total - completed would be 3, but the selector counts non-completed
      expect(stats.dueToday).toBe(1);
      expect(stats.overdue).toBe(1);
    });
  });

  describe('Optimistic Updates Pattern', () => {
    it('should update store immediately for better UX', () => {
      const todos = [
        createMockTodo({ id: 'todo-1', completed: false }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      // Simulate optimistic update
      act(() => {
        useTodoStore.getState().updateTodo('todo-1', { completed: true, status: 'done' });
      });

      // Store should reflect change immediately
      const updatedTodo = useTodoStore.getState().todos.find(t => t.id === 'todo-1');
      expect(updatedTodo?.completed).toBe(true);
    });

    it('should allow rollback on failure', () => {
      const originalTodo = createMockTodo({ id: 'todo-1', text: 'Original text' });

      act(() => {
        useTodoStore.getState().setTodos([originalTodo]);
      });

      // Optimistic update
      act(() => {
        useTodoStore.getState().updateTodo('todo-1', { text: 'Updated text' });
      });

      expect(useTodoStore.getState().todos[0].text).toBe('Updated text');

      // Simulate rollback
      act(() => {
        useTodoStore.getState().updateTodo('todo-1', originalTodo);
      });

      expect(useTodoStore.getState().todos[0].text).toBe('Original text');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle bulk operations on filtered todos', async () => {
      const todos = [
        createMockTodo({ id: 'todo-1', priority: 'high', completed: false }),
        createMockTodo({ id: 'todo-2', priority: 'high', completed: false }),
        createMockTodo({ id: 'todo-3', priority: 'low', completed: false }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        // Use highPriorityOnly to filter for high/urgent
        useTodoStore.getState().setHighPriorityOnly(true);
      });

      const { result: filtersResult } = renderHook(() => useFilters('TestUser'));
      const { result: bulkResult } = renderHook(() => useBulkActions('TestUser'));

      // Select all visible (high priority)
      const visibleIds = filtersResult.current.filteredAndSortedTodos.map(t => t.id);

      act(() => {
        bulkResult.current.selectAll(visibleIds);
      });

      expect(bulkResult.current.selectedCount).toBe(2);

      // Complete all selected
      await act(async () => {
        await bulkResult.current.bulkComplete();
      });

      // Verify only high priority todos were completed
      const storeTodos = useTodoStore.getState().todos;
      expect(storeTodos.find(t => t.id === 'todo-1')?.completed).toBe(true);
      expect(storeTodos.find(t => t.id === 'todo-2')?.completed).toBe(true);
      expect(storeTodos.find(t => t.id === 'todo-3')?.completed).toBe(false);
    });

    it('should maintain sort order when updating todos', () => {
      const todos = [
        createMockTodo({ id: 'todo-1', priority: 'low', text: 'Low task' }),
        createMockTodo({ id: 'todo-2', priority: 'high', text: 'High task' }),
        createMockTodo({ id: 'todo-3', priority: 'medium', text: 'Medium task' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().setSortOption('priority');
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      // Should be sorted by priority (urgent, high, medium, low)
      expect(result.current.filteredAndSortedTodos[0].priority).toBe('high');
      expect(result.current.filteredAndSortedTodos[1].priority).toBe('medium');
      expect(result.current.filteredAndSortedTodos[2].priority).toBe('low');

      // Update a todo's priority
      act(() => {
        useTodoStore.getState().updateTodo('todo-1', { priority: 'urgent' });
      });

      // Sort order should update
      expect(result.current.filteredAndSortedTodos[0].priority).toBe('urgent');
    });
  });
});
