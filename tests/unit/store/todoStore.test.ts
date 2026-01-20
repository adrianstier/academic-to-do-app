/**
 * TodoStore Unit Tests
 *
 * Tests for the centralized Zustand store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTodoStore, selectFilteredTodos, selectTodoStats, isDueToday, isOverdue, priorityOrder } from '@/store/todoStore';
import { Todo } from '@/types/todo';
import { act } from '@testing-library/react';

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

describe('useTodoStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useTodoStore.getState();
    store.setTodos([]);
    store.setUsers([]);
    store.setUsersWithColors([]);
    store.setLoading(true);
    store.setConnected(false);
    store.setError(null);
    store.resetFilters();
    store.clearSelection();
  });

  describe('Core Data Actions', () => {
    it('should set todos', () => {
      const todos = [createMockTodo({ text: 'Todo 1' }), createMockTodo({ text: 'Todo 2' })];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      expect(useTodoStore.getState().todos).toHaveLength(2);
      expect(useTodoStore.getState().todos[0].text).toBe('Todo 1');
    });

    it('should add a todo', () => {
      const todo = createMockTodo({ text: 'New Todo' });

      act(() => {
        useTodoStore.getState().addTodo(todo);
      });

      expect(useTodoStore.getState().todos).toHaveLength(1);
      expect(useTodoStore.getState().todos[0].text).toBe('New Todo');
    });

    it('should prepend new todos to the beginning', () => {
      const todo1 = createMockTodo({ text: 'First' });
      const todo2 = createMockTodo({ text: 'Second' });

      act(() => {
        useTodoStore.getState().addTodo(todo1);
        useTodoStore.getState().addTodo(todo2);
      });

      expect(useTodoStore.getState().todos[0].text).toBe('Second');
      expect(useTodoStore.getState().todos[1].text).toBe('First');
    });

    it('should update a todo', () => {
      const todo = createMockTodo({ text: 'Original' });

      act(() => {
        useTodoStore.getState().setTodos([todo]);
        useTodoStore.getState().updateTodo(todo.id, { text: 'Updated' });
      });

      expect(useTodoStore.getState().todos[0].text).toBe('Updated');
    });

    it('should update todo completion status', () => {
      const todo = createMockTodo({ completed: false });

      act(() => {
        useTodoStore.getState().setTodos([todo]);
        useTodoStore.getState().updateTodo(todo.id, { completed: true, status: 'done' });
      });

      expect(useTodoStore.getState().todos[0].completed).toBe(true);
      expect(useTodoStore.getState().todos[0].status).toBe('done');
    });

    it('should delete a todo', () => {
      const todo = createMockTodo();

      act(() => {
        useTodoStore.getState().setTodos([todo]);
        useTodoStore.getState().deleteTodo(todo.id);
      });

      expect(useTodoStore.getState().todos).toHaveLength(0);
    });

    it('should remove deleted todo from selected todos', () => {
      const todo = createMockTodo();

      act(() => {
        useTodoStore.getState().setTodos([todo]);
        useTodoStore.getState().toggleTodoSelection(todo.id);
      });

      expect(useTodoStore.getState().bulkActions.selectedTodos.has(todo.id)).toBe(true);

      act(() => {
        useTodoStore.getState().deleteTodo(todo.id);
      });

      expect(useTodoStore.getState().bulkActions.selectedTodos.has(todo.id)).toBe(false);
    });

    it('should set users', () => {
      act(() => {
        useTodoStore.getState().setUsers(['User1', 'User2']);
      });

      expect(useTodoStore.getState().users).toEqual(['User1', 'User2']);
    });

    it('should set users with colors', () => {
      const usersWithColors = [
        { name: 'User1', color: '#FF0000' },
        { name: 'User2', color: '#00FF00' },
      ];

      act(() => {
        useTodoStore.getState().setUsersWithColors(usersWithColors);
      });

      expect(useTodoStore.getState().usersWithColors).toEqual(usersWithColors);
    });

    it('should set loading state', () => {
      act(() => {
        useTodoStore.getState().setLoading(false);
      });

      expect(useTodoStore.getState().loading).toBe(false);
    });

    it('should set connected state', () => {
      act(() => {
        useTodoStore.getState().setConnected(true);
      });

      expect(useTodoStore.getState().connected).toBe(true);
    });

    it('should set error state', () => {
      act(() => {
        useTodoStore.getState().setError('Something went wrong');
      });

      expect(useTodoStore.getState().error).toBe('Something went wrong');
    });
  });

  describe('Filter Actions', () => {
    it('should set search query', () => {
      act(() => {
        useTodoStore.getState().setSearchQuery('test');
      });

      expect(useTodoStore.getState().filters.searchQuery).toBe('test');
    });

    it('should set quick filter', () => {
      act(() => {
        useTodoStore.getState().setQuickFilter('my_tasks');
      });

      expect(useTodoStore.getState().filters.quickFilter).toBe('my_tasks');
    });

    it('should set sort option', () => {
      act(() => {
        useTodoStore.getState().setSortOption('priority');
      });

      expect(useTodoStore.getState().filters.sortOption).toBe('priority');
    });

    it('should set show completed', () => {
      act(() => {
        useTodoStore.getState().setShowCompleted(true);
      });

      expect(useTodoStore.getState().filters.showCompleted).toBe(true);
    });

    it('should set high priority only', () => {
      act(() => {
        useTodoStore.getState().setHighPriorityOnly(true);
      });

      expect(useTodoStore.getState().filters.highPriorityOnly).toBe(true);
    });

    it('should set multiple filters at once', () => {
      act(() => {
        useTodoStore.getState().setFilters({
          searchQuery: 'test',
          quickFilter: 'all',
          sortOption: 'due_date',
        });
      });

      const filters = useTodoStore.getState().filters;
      expect(filters.searchQuery).toBe('test');
      expect(filters.quickFilter).toBe('urgent');
      expect(filters.sortOption).toBe('due_date');
    });

    it('should reset filters to defaults', () => {
      act(() => {
        useTodoStore.getState().setFilters({
          searchQuery: 'test',
          quickFilter: 'all',
          showCompleted: true,
        });
        useTodoStore.getState().resetFilters();
      });

      const filters = useTodoStore.getState().filters;
      expect(filters.searchQuery).toBe('');
      expect(filters.quickFilter).toBe('all');
      expect(filters.showCompleted).toBe(false);
    });

    it('should set status filter', () => {
      act(() => {
        useTodoStore.getState().setStatusFilter('in_progress');
      });

      expect(useTodoStore.getState().filters.statusFilter).toBe('in_progress');
    });

    it('should set assigned to filter', () => {
      act(() => {
        useTodoStore.getState().setAssignedToFilter('User1');
      });

      expect(useTodoStore.getState().filters.assignedToFilter).toBe('User1');
    });

    it('should set has attachments filter', () => {
      act(() => {
        useTodoStore.getState().setHasAttachmentsFilter(true);
      });

      expect(useTodoStore.getState().filters.hasAttachmentsFilter).toBe(true);
    });

    it('should set date range filter', () => {
      act(() => {
        useTodoStore.getState().setDateRangeFilter({ start: '2025-01-01', end: '2025-12-31' });
      });

      expect(useTodoStore.getState().filters.dateRangeFilter).toEqual({ start: '2025-01-01', end: '2025-12-31' });
    });
  });

  describe('Bulk Action Actions', () => {
    it('should toggle todo selection', () => {
      const todo = createMockTodo();

      act(() => {
        useTodoStore.getState().setTodos([todo]);
        useTodoStore.getState().toggleTodoSelection(todo.id);
      });

      expect(useTodoStore.getState().bulkActions.selectedTodos.has(todo.id)).toBe(true);
      expect(useTodoStore.getState().bulkActions.showBulkActions).toBe(true);

      act(() => {
        useTodoStore.getState().toggleTodoSelection(todo.id);
      });

      expect(useTodoStore.getState().bulkActions.selectedTodos.has(todo.id)).toBe(false);
      expect(useTodoStore.getState().bulkActions.showBulkActions).toBe(false);
    });

    it('should select all todos', () => {
      const todos = [createMockTodo(), createMockTodo(), createMockTodo()];
      const ids = todos.map(t => t.id);

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().selectAllTodos(ids);
      });

      expect(useTodoStore.getState().bulkActions.selectedTodos.size).toBe(3);
      expect(useTodoStore.getState().bulkActions.showBulkActions).toBe(true);
    });

    it('should clear selection', () => {
      const todo = createMockTodo();

      act(() => {
        useTodoStore.getState().setTodos([todo]);
        useTodoStore.getState().toggleTodoSelection(todo.id);
        useTodoStore.getState().clearSelection();
      });

      expect(useTodoStore.getState().bulkActions.selectedTodos.size).toBe(0);
      expect(useTodoStore.getState().bulkActions.showBulkActions).toBe(false);
    });

    it('should set selected todos directly', () => {
      const todos = [createMockTodo(), createMockTodo()];

      act(() => {
        useTodoStore.getState().setTodos(todos);
        useTodoStore.getState().setSelectedTodos(new Set([todos[0].id]));
      });

      expect(useTodoStore.getState().bulkActions.selectedTodos.size).toBe(1);
      expect(useTodoStore.getState().bulkActions.selectedTodos.has(todos[0].id)).toBe(true);
    });
  });

  describe('UI Actions', () => {
    it('should set view mode', () => {
      act(() => {
        useTodoStore.getState().setViewMode('kanban');
      });

      expect(useTodoStore.getState().ui.viewMode).toBe('kanban');
    });

    it('should set show advanced filters', () => {
      act(() => {
        useTodoStore.getState().setShowAdvancedFilters(true);
      });

      expect(useTodoStore.getState().ui.showAdvancedFilters).toBe(true);
    });

    it('should set show celebration with text', () => {
      act(() => {
        useTodoStore.getState().setShowCelebration(true, 'Task completed!');
      });

      expect(useTodoStore.getState().ui.showCelebration).toBe(true);
      expect(useTodoStore.getState().ui.celebrationText).toBe('Task completed!');
    });

    it('should set show activity feed', () => {
      act(() => {
        useTodoStore.getState().setShowActivityFeed(true);
      });

      expect(useTodoStore.getState().ui.showActivityFeed).toBe(true);
    });

    it('should set custom order', () => {
      act(() => {
        useTodoStore.getState().setCustomOrder(['id1', 'id2', 'id3']);
      });

      expect(useTodoStore.getState().customOrder).toEqual(['id1', 'id2', 'id3']);
    });
  });
});

describe('Helper Functions', () => {
  // Note: isDueToday and isOverdue have timezone-dependent behavior when comparing
  // date strings (YYYY-MM-DD) with local dates. These tests use full ISO timestamps
  // to ensure consistent behavior across timezones.

  describe('isDueToday', () => {
    it('should return true for current timestamp', () => {
      // Use a full ISO timestamp which ensures proper parsing
      const now = new Date();
      expect(isDueToday(now.toISOString())).toBe(true);
    });

    it('should return false for date in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);
      expect(isDueToday(pastDate.toISOString())).toBe(false);
    });

    it('should return false for date in the future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      expect(isDueToday(futureDate.toISOString())).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isDueToday(undefined)).toBe(false);
    });
  });

  describe('isOverdue', () => {
    it('should return true for past date on incomplete todo', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);
      expect(isOverdue(pastDate.toISOString(), false)).toBe(true);
    });

    it('should return false for past date on completed todo', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);
      expect(isOverdue(pastDate.toISOString(), true)).toBe(false);
    });

    it('should return false for future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      expect(isOverdue(futureDate.toISOString(), false)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isOverdue(undefined, false)).toBe(false);
    });
  });

  describe('priorityOrder', () => {
    it('should have correct order values', () => {
      expect(priorityOrder.urgent).toBe(0);
      expect(priorityOrder.high).toBe(1);
      expect(priorityOrder.medium).toBe(2);
      expect(priorityOrder.low).toBe(3);
    });
  });
});

describe('Selectors', () => {
  describe('selectFilteredTodos', () => {
    const mockTodos: Todo[] = [
      createMockTodo({ id: '1', text: 'Todo 1', completed: false, priority: 'urgent', assigned_to: 'User1' }),
      createMockTodo({ id: '2', text: 'Todo 2', completed: true, priority: 'low', assigned_to: 'User2' }),
      createMockTodo({ id: '3', text: 'Todo 3', completed: false, priority: 'high', assigned_to: 'User1' }),
    ];

    it('should filter out completed todos by default', () => {
      const filtered = selectFilteredTodos(mockTodos, {
        searchQuery: '',
        quickFilter: 'all',
        sortOption: 'created',
        showCompleted: false,
        highPriorityOnly: false,
        statusFilter: 'all',
        assignedToFilter: 'all',
        customerFilter: 'all',
        hasAttachmentsFilter: null,
        dateRangeFilter: { start: '', end: '' },
      }, 'User1', []);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => !t.completed)).toBe(true);
    });

    it('should include completed todos when showCompleted is true', () => {
      const filtered = selectFilteredTodos(mockTodos, {
        searchQuery: '',
        quickFilter: 'all',
        sortOption: 'created',
        showCompleted: true,
        highPriorityOnly: false,
        statusFilter: 'all',
        assignedToFilter: 'all',
        customerFilter: 'all',
        hasAttachmentsFilter: null,
        dateRangeFilter: { start: '', end: '' },
      }, 'User1', []);

      expect(filtered).toHaveLength(3);
    });

    it('should filter by search query', () => {
      const filtered = selectFilteredTodos(mockTodos, {
        searchQuery: 'Todo 1',
        quickFilter: 'all',
        sortOption: 'created',
        showCompleted: true,
        highPriorityOnly: false,
        statusFilter: 'all',
        assignedToFilter: 'all',
        customerFilter: 'all',
        hasAttachmentsFilter: null,
        dateRangeFilter: { start: '', end: '' },
      }, 'User1', []);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('Todo 1');
    });

    it('should filter by my_tasks', () => {
      const filtered = selectFilteredTodos(mockTodos, {
        searchQuery: '',
        quickFilter: 'my_tasks',
        sortOption: 'created',
        showCompleted: true,
        highPriorityOnly: false,
        statusFilter: 'all',
        assignedToFilter: 'all',
        customerFilter: 'all',
        hasAttachmentsFilter: null,
        dateRangeFilter: { start: '', end: '' },
      }, 'User1', []);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => t.assigned_to === 'User1')).toBe(true);
    });

    it('should filter by high priority only', () => {
      const filtered = selectFilteredTodos(mockTodos, {
        searchQuery: '',
        quickFilter: 'all',
        sortOption: 'created',
        showCompleted: true,
        highPriorityOnly: true,
        statusFilter: 'all',
        assignedToFilter: 'all',
        customerFilter: 'all',
        hasAttachmentsFilter: null,
        dateRangeFilter: { start: '', end: '' },
      }, 'User1', []);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => t.priority === 'urgent' || t.priority === 'high')).toBe(true);
    });

    it('should sort by priority', () => {
      const filtered = selectFilteredTodos(mockTodos, {
        searchQuery: '',
        quickFilter: 'all',
        sortOption: 'priority',
        showCompleted: true,
        highPriorityOnly: false,
        statusFilter: 'all',
        assignedToFilter: 'all',
        customerFilter: 'all',
        hasAttachmentsFilter: null,
        dateRangeFilter: { start: '', end: '' },
      }, 'User1', []);

      expect(filtered[0].priority).toBe('urgent');
      expect(filtered[1].priority).toBe('high');
      expect(filtered[2].priority).toBe('low');
    });

    it('should filter by assigned user', () => {
      const filtered = selectFilteredTodos(mockTodos, {
        searchQuery: '',
        quickFilter: 'all',
        sortOption: 'created',
        showCompleted: true,
        highPriorityOnly: false,
        statusFilter: 'all',
        assignedToFilter: 'User2',
        customerFilter: 'all',
        hasAttachmentsFilter: null,
        dateRangeFilter: { start: '', end: '' },
      }, 'User1', []);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].assigned_to).toBe('User2');
    });
  });

  describe('selectTodoStats', () => {
    it('should calculate correct stats', () => {
      // Use full ISO timestamps for reliable timezone handling
      const today = new Date();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      const todos: Todo[] = [
        createMockTodo({ completed: false, priority: 'urgent' }),
        createMockTodo({ completed: true }),
        createMockTodo({ completed: false, due_date: today.toISOString() }),
        createMockTodo({ completed: false, due_date: pastDate.toISOString() }),
        createMockTodo({ completed: false, priority: 'high' }),
      ];

      const stats = selectTodoStats(todos);

      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(1);
      expect(stats.overdue).toBe(1);
      expect(stats.dueToday).toBe(1);
      expect(stats.urgent).toBe(2); // urgent + high
    });

    it('should return zeros for empty array', () => {
      const stats = selectTodoStats([]);

      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.overdue).toBe(0);
      expect(stats.dueToday).toBe(0);
      expect(stats.urgent).toBe(0);
    });
  });

  describe('UI State Actions', () => {
    it('should set show archive view', () => {
      act(() => {
        useTodoStore.getState().setShowArchiveView(true);
      });
      expect(useTodoStore.getState().ui.showArchiveView).toBe(true);

      act(() => {
        useTodoStore.getState().setShowArchiveView(false);
      });
      expect(useTodoStore.getState().ui.showArchiveView).toBe(false);
    });

    it('should set show merge modal', () => {
      act(() => {
        useTodoStore.getState().setShowMergeModal(true);
      });
      expect(useTodoStore.getState().ui.showMergeModal).toBe(true);
    });

    it('should set show duplicate modal', () => {
      act(() => {
        useTodoStore.getState().setShowDuplicateModal(true);
      });
      expect(useTodoStore.getState().ui.showDuplicateModal).toBe(true);
    });

    it('should set show email modal', () => {
      act(() => {
        useTodoStore.getState().setShowEmailModal(true);
      });
      expect(useTodoStore.getState().ui.showEmailModal).toBe(true);
    });

    it('should set custom order', () => {
      const customOrder = ['id-1', 'id-3', 'id-2'];
      act(() => {
        useTodoStore.getState().setCustomOrder(customOrder);
      });
      expect(useTodoStore.getState().customOrder).toEqual(customOrder);
    });
  });

  describe('selectFilteredTodos - Additional Sorting', () => {
    const baseTodos: Todo[] = [
      createMockTodo({ id: 'todo-1', text: 'Apple', priority: 'low', due_date: '2026-01-15T12:00:00Z', created_at: '2026-01-01T10:00:00Z' }),
      createMockTodo({ id: 'todo-2', text: 'Banana', priority: 'high', due_date: '2026-01-10T12:00:00Z', created_at: '2026-01-02T10:00:00Z' }),
      createMockTodo({ id: 'todo-3', text: 'Cherry', priority: 'urgent', due_date: '2026-01-05T12:00:00Z', created_at: '2026-01-03T10:00:00Z' }),
      createMockTodo({ id: 'todo-4', text: 'Date', priority: 'medium', created_at: '2026-01-04T10:00:00Z' }), // No due date
    ];

    const baseFilters = {
      searchQuery: '',
      quickFilter: 'all' as const,
      sortOption: 'created' as const,
      showCompleted: true,
      highPriorityOnly: false,
      statusFilter: 'all' as const,
      assignedToFilter: 'all',
      customerFilter: 'all',
      hasAttachmentsFilter: null,
      dateRangeFilter: { start: '', end: '' },
    };

    it('should sort by due_date', () => {
      const filtered = selectFilteredTodos(baseTodos, {
        ...baseFilters,
        sortOption: 'due_date',
      }, 'User1', []);

      // Sorted by due_date ascending, todos without due_date at end
      expect(filtered[0].text).toBe('Cherry'); // Jan 5
      expect(filtered[1].text).toBe('Banana'); // Jan 10
      expect(filtered[2].text).toBe('Apple'); // Jan 15
      expect(filtered[3].text).toBe('Date'); // No due date - at end
    });

    it('should sort alphabetically', () => {
      const filtered = selectFilteredTodos(baseTodos, {
        ...baseFilters,
        sortOption: 'alphabetical',
      }, 'User1', []);

      expect(filtered[0].text).toBe('Apple');
      expect(filtered[1].text).toBe('Banana');
      expect(filtered[2].text).toBe('Cherry');
      expect(filtered[3].text).toBe('Date');
    });

    it('should sort by created date (newest first)', () => {
      const filtered = selectFilteredTodos(baseTodos, {
        ...baseFilters,
        sortOption: 'created',
      }, 'User1', []);

      expect(filtered[0].text).toBe('Date'); // Jan 4
      expect(filtered[1].text).toBe('Cherry'); // Jan 3
      expect(filtered[2].text).toBe('Banana'); // Jan 2
      expect(filtered[3].text).toBe('Apple'); // Jan 1
    });

    it('should sort by urgency (overdue first, then priority, then due date)', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const urgencyTodos: Todo[] = [
        createMockTodo({ id: 'todo-1', text: 'Not urgent', priority: 'low', due_date: '2026-02-01T12:00:00Z' }),
        createMockTodo({ id: 'todo-2', text: 'Overdue', priority: 'medium', due_date: pastDate.toISOString() }),
        createMockTodo({ id: 'todo-3', text: 'High priority', priority: 'urgent', due_date: '2026-02-15T12:00:00Z' }),
      ];

      const filtered = selectFilteredTodos(urgencyTodos, {
        ...baseFilters,
        sortOption: 'urgency',
      }, 'User1', []);

      // Overdue comes first
      expect(filtered[0].text).toBe('Overdue');
      // Then by priority (urgent > high > medium > low)
      expect(filtered[1].text).toBe('High priority');
      expect(filtered[2].text).toBe('Not urgent');
    });

    it('should sort by custom order', () => {
      const customOrder = ['todo-3', 'todo-1', 'todo-4', 'todo-2'];

      const filtered = selectFilteredTodos(baseTodos, {
        ...baseFilters,
        sortOption: 'custom',
      }, 'User1', customOrder);

      expect(filtered[0].id).toBe('todo-3');
      expect(filtered[1].id).toBe('todo-1');
      expect(filtered[2].id).toBe('todo-4');
      expect(filtered[3].id).toBe('todo-2');
    });

    it('should handle custom order with missing items', () => {
      // Only specify order for some items
      const customOrder = ['todo-2', 'todo-4'];

      const filtered = selectFilteredTodos(baseTodos, {
        ...baseFilters,
        sortOption: 'custom',
      }, 'User1', customOrder);

      // Specified items come first in order
      expect(filtered[0].id).toBe('todo-2');
      expect(filtered[1].id).toBe('todo-4');
      // Unspecified items come after
      expect(['todo-1', 'todo-3']).toContain(filtered[2].id);
      expect(['todo-1', 'todo-3']).toContain(filtered[3].id);
    });
  });

  describe('selectFilteredTodos - Quick Filters', () => {
    const baseFilters = {
      searchQuery: '',
      quickFilter: 'all' as const,
      sortOption: 'created' as const,
      showCompleted: true,
      highPriorityOnly: false,
      statusFilter: 'all' as const,
      assignedToFilter: 'all',
      customerFilter: 'all',
      hasAttachmentsFilter: null,
      dateRangeFilter: { start: '', end: '' },
    };

    it('should filter by due_today', () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todos: Todo[] = [
        createMockTodo({ text: 'Due today', due_date: today.toISOString() }),
        createMockTodo({ text: 'Due tomorrow', due_date: tomorrow.toISOString() }),
        createMockTodo({ text: 'No due date' }),
      ];

      const filtered = selectFilteredTodos(todos, {
        ...baseFilters,
        quickFilter: 'due_today',
      }, 'User1', []);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('Due today');
    });

    it('should filter by overdue', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const todos: Todo[] = [
        createMockTodo({ text: 'Overdue task', due_date: pastDate.toISOString(), completed: false }),
        createMockTodo({ text: 'Future task', due_date: futureDate.toISOString(), completed: false }),
        createMockTodo({ text: 'Completed overdue', due_date: pastDate.toISOString(), completed: true }),
      ];

      const filtered = selectFilteredTodos(todos, {
        ...baseFilters,
        quickFilter: 'overdue',
      }, 'User1', []);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('Overdue task');
    });
  });

  describe('selectFilteredTodos - Advanced Filters', () => {
    const baseFilters = {
      searchQuery: '',
      quickFilter: 'all' as const,
      sortOption: 'created' as const,
      showCompleted: true,
      highPriorityOnly: false,
      statusFilter: 'all' as const,
      assignedToFilter: 'all',
      customerFilter: 'all',
      hasAttachmentsFilter: null,
      dateRangeFilter: { start: '', end: '' },
    };

    it('should filter by status', () => {
      const todos: Todo[] = [
        createMockTodo({ text: 'Todo', status: 'todo' }),
        createMockTodo({ text: 'In progress', status: 'in_progress' }),
        createMockTodo({ text: 'Done', status: 'done' }),
      ];

      const filtered = selectFilteredTodos(todos, {
        ...baseFilters,
        statusFilter: 'in_progress',
      }, 'User1', []);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('In progress');
    });

    it('should filter by has attachments true', () => {
      const todos: Todo[] = [
        createMockTodo({
          text: 'With attachment',
          attachments: [{ id: 'a1', file_name: 'file.pdf', file_type: 'pdf', file_size: 100, storage_path: 'path', mime_type: 'application/pdf', uploaded_by: 'User', uploaded_at: new Date().toISOString() }]
        }),
        createMockTodo({ text: 'Without attachment', attachments: [] }),
        createMockTodo({ text: 'No attachments field' }),
      ];

      const filtered = selectFilteredTodos(todos, {
        ...baseFilters,
        hasAttachmentsFilter: true,
      }, 'User1', []);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('With attachment');
    });

    it('should filter by has attachments false', () => {
      const todos: Todo[] = [
        createMockTodo({
          text: 'With attachment',
          attachments: [{ id: 'a1', file_name: 'file.pdf', file_type: 'pdf', file_size: 100, storage_path: 'path', mime_type: 'application/pdf', uploaded_by: 'User', uploaded_at: new Date().toISOString() }]
        }),
        createMockTodo({ text: 'Without attachment', attachments: [] }),
        createMockTodo({ text: 'No attachments field' }),
      ];

      const filtered = selectFilteredTodos(todos, {
        ...baseFilters,
        hasAttachmentsFilter: false,
      }, 'User1', []);

      expect(filtered).toHaveLength(2);
      expect(filtered.map(t => t.text)).toContain('Without attachment');
      expect(filtered.map(t => t.text)).toContain('No attachments field');
    });

    it('should filter by search query in notes', () => {
      const todos: Todo[] = [
        createMockTodo({ text: 'Task 1', notes: 'Important meeting notes' }),
        createMockTodo({ text: 'Task 2', notes: 'Regular notes' }),
        createMockTodo({ text: 'Task 3' }),
      ];

      const filtered = selectFilteredTodos(todos, {
        ...baseFilters,
        searchQuery: 'important',
      }, 'User1', []);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('Task 1');
    });

    it('should filter by search query in created_by', () => {
      const todos: Todo[] = [
        createMockTodo({ text: 'Task 1', created_by: 'Derrick' }),
        createMockTodo({ text: 'Task 2', created_by: 'Sefra' }),
      ];

      const filtered = selectFilteredTodos(todos, {
        ...baseFilters,
        searchQuery: 'derrick',
      }, 'User1', []);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('Task 1');
    });
  });
});
