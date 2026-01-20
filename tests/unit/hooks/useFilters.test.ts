/**
 * useFilters Hook Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFilters } from '@/hooks/useFilters';
import { useTodoStore } from '@/store/todoStore';
import { Todo } from '@/types/todo';

// Mock the store
vi.mock('@/store/todoStore', async () => {
  const actual = await vi.importActual('@/store/todoStore');
  return {
    ...actual,
  };
});

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

describe('useFilters', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useTodoStore.getState();
    store.setTodos([]);
    store.resetFilters();
  });

  describe('Initial State', () => {
    it('should return empty filtered todos when store is empty', () => {
      const { result } = renderHook(() => useFilters('TestUser'));

      expect(result.current.filteredAndSortedTodos).toHaveLength(0);
      expect(result.current.visibleTodos).toHaveLength(0);
    });

    it('should return default filter state', () => {
      const { result } = renderHook(() => useFilters('TestUser'));

      expect(result.current.filters.searchQuery).toBe('');
      expect(result.current.filters.quickFilter).toBe('all');
      expect(result.current.filters.sortOption).toBe('urgency');
      expect(result.current.filters.showCompleted).toBe(false);
    });
  });

  describe('Filtering', () => {
    it('should filter todos by search query', () => {
      const todos = [
        createMockTodo({ text: 'Buy groceries' }),
        createMockTodo({ text: 'Call doctor' }),
        createMockTodo({ text: 'Buy milk' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setSearchQuery('Buy');
      });

      expect(result.current.filteredAndSortedTodos).toHaveLength(2);
      expect(result.current.filteredAndSortedTodos.every(t => t.text.includes('Buy'))).toBe(true);
    });

    it('should filter by quick filter - my_tasks', () => {
      // my_tasks filter checks assigned_to === userName OR created_by === userName
      const todos = [
        createMockTodo({ text: 'Assigned to me', assigned_to: 'TestUser', created_by: 'OtherUser' }),
        createMockTodo({ text: 'Other task', assigned_to: 'OtherUser', created_by: 'OtherUser' }),
        createMockTodo({ text: 'Created by me', assigned_to: undefined, created_by: 'TestUser' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setQuickFilter('my_tasks');
      });

      // 2 tasks: one assigned to TestUser, one created by TestUser
      expect(result.current.filteredAndSortedTodos).toHaveLength(2);
    });

    it('should filter by quick filter - due_today', () => {
      // Use full ISO timestamps for reliable timezone handling
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const todos = [
        createMockTodo({ text: 'Due today', due_date: today.toISOString() }),
        createMockTodo({ text: 'Due future', due_date: futureDate.toISOString() }),
        createMockTodo({ text: 'No due date' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setQuickFilter('due_today');
      });

      expect(result.current.filteredAndSortedTodos).toHaveLength(1);
      expect(result.current.filteredAndSortedTodos[0].text).toBe('Due today');
    });

    it('should filter by quick filter - overdue', () => {
      // Use full ISO timestamps for reliable timezone handling
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const todos = [
        createMockTodo({ text: 'Overdue', due_date: pastDate.toISOString() }),
        createMockTodo({ text: 'Future', due_date: futureDate.toISOString() }),
        createMockTodo({ text: 'Completed overdue', due_date: pastDate.toISOString(), completed: true }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setQuickFilter('overdue');
      });

      expect(result.current.filteredAndSortedTodos).toHaveLength(1);
      expect(result.current.filteredAndSortedTodos[0].text).toBe('Overdue');
    });

    it('should filter by high priority only', () => {
      const todos = [
        createMockTodo({ text: 'Urgent', priority: 'urgent' }),
        createMockTodo({ text: 'High', priority: 'high' }),
        createMockTodo({ text: 'Medium', priority: 'medium' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setHighPriorityOnly(true);
      });

      expect(result.current.filteredAndSortedTodos).toHaveLength(2);
    });

    it('should show completed todos when enabled', () => {
      const todos = [
        createMockTodo({ text: 'Active', completed: false }),
        createMockTodo({ text: 'Completed', completed: true }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      // Default: hide completed
      expect(result.current.filteredAndSortedTodos).toHaveLength(1);

      act(() => {
        result.current.setShowCompleted(true);
      });

      expect(result.current.filteredAndSortedTodos).toHaveLength(2);
    });
  });

  describe('Sorting', () => {
    it('should sort by priority', () => {
      const todos = [
        createMockTodo({ text: 'Low', priority: 'low' }),
        createMockTodo({ text: 'Urgent', priority: 'urgent' }),
        createMockTodo({ text: 'Medium', priority: 'medium' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setSortOption('priority');
      });

      expect(result.current.filteredAndSortedTodos[0].priority).toBe('urgent');
      expect(result.current.filteredAndSortedTodos[2].priority).toBe('low');
    });

    it('should sort by due date', () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const todos = [
        createMockTodo({ text: 'Next week', due_date: nextWeek.toISOString().split('T')[0] }),
        createMockTodo({ text: 'Today', due_date: today }),
        createMockTodo({ text: 'Tomorrow', due_date: tomorrow.toISOString().split('T')[0] }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setSortOption('due_date');
      });

      expect(result.current.filteredAndSortedTodos[0].text).toBe('Today');
      expect(result.current.filteredAndSortedTodos[2].text).toBe('Next week');
    });

    it('should sort alphabetically', () => {
      const todos = [
        createMockTodo({ text: 'Zebra task' }),
        createMockTodo({ text: 'Alpha task' }),
        createMockTodo({ text: 'Beta task' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setSortOption('alphabetical');
      });

      expect(result.current.filteredAndSortedTodos[0].text).toBe('Alpha task');
      expect(result.current.filteredAndSortedTodos[2].text).toBe('Zebra task');
    });
  });

  describe('Filter Counts', () => {
    it('should calculate correct filter counts', () => {
      // Use full ISO timestamps for reliable timezone handling
      const today = new Date();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      const todos = [
        createMockTodo({ text: 'Active 1', completed: false, assigned_to: 'TestUser', created_by: 'OtherUser' }),
        createMockTodo({ text: 'Active 2', completed: false, created_by: 'TestUser' }),
        createMockTodo({ text: 'Completed', completed: true, created_by: 'OtherUser' }),
        createMockTodo({ text: 'Due today', due_date: today.toISOString(), completed: false, created_by: 'OtherUser' }),
        createMockTodo({ text: 'Overdue', due_date: pastDate.toISOString(), completed: false, created_by: 'OtherUser' }),
        createMockTodo({ text: 'Urgent', priority: 'urgent', completed: false, created_by: 'OtherUser' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      expect(result.current.filterCounts.all).toBe(6);
      expect(result.current.filterCounts.active).toBe(5);
      expect(result.current.filterCounts.completed).toBe(1);
      // myTasks: assigned_to=TestUser (1) + created_by=TestUser (1) = 2
      expect(result.current.filterCounts.myTasks).toBe(2);
      expect(result.current.filterCounts.dueToday).toBe(1);
      expect(result.current.filterCounts.overdue).toBe(1);
      expect(result.current.filterCounts.urgent).toBe(1);
    });
  });

  describe('Archived Todos', () => {
    it('should exclude archived todos from visible todos', () => {
      const recentCompletion = new Date();
      const oldCompletion = new Date();
      oldCompletion.setHours(oldCompletion.getHours() - 49); // More than 48 hours ago

      const todos = [
        createMockTodo({ text: 'Recent completed', completed: true, updated_at: recentCompletion.toISOString() }),
        createMockTodo({ text: 'Old completed', completed: true, updated_at: oldCompletion.toISOString() }),
        createMockTodo({ text: 'Active', completed: false }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      // Old completed should be in archived, not visible
      expect(result.current.archivedTodos).toHaveLength(1);
      expect(result.current.archivedTodos[0].text).toBe('Old completed');
      expect(result.current.visibleTodos).toHaveLength(2);
    });
  });

  describe('Advanced Filters', () => {
    it('should detect active advanced filters', () => {
      const { result } = renderHook(() => useFilters('TestUser'));

      expect(result.current.hasActiveAdvancedFilters).toBe(false);

      act(() => {
        result.current.setStatusFilter('in_progress');
      });

      expect(result.current.hasActiveAdvancedFilters).toBe(true);
    });

    it('should clear all advanced filters', () => {
      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setStatusFilter('in_progress');
        result.current.setAssignedToFilter('User1');
        result.current.setHasAttachmentsFilter(true);
      });

      expect(result.current.hasActiveAdvancedFilters).toBe(true);

      act(() => {
        result.current.clearAdvancedFilters();
      });

      expect(result.current.hasActiveAdvancedFilters).toBe(false);
    });
  });

  describe('Filter Archived Todos', () => {
    it('should filter archived todos by query', () => {
      const oldCompletion = new Date();
      oldCompletion.setHours(oldCompletion.getHours() - 49);

      const todos = [
        createMockTodo({ text: 'Archived groceries', completed: true, updated_at: oldCompletion.toISOString() }),
        createMockTodo({ text: 'Archived call', completed: true, updated_at: oldCompletion.toISOString() }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      const filtered = result.current.filterArchivedTodos('groceries');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('Archived groceries');
    });

    it('should return all archived todos when query is empty', () => {
      const oldCompletion = new Date();
      oldCompletion.setHours(oldCompletion.getHours() - 49);

      const todos = [
        createMockTodo({ text: 'Archived 1', completed: true, updated_at: oldCompletion.toISOString() }),
        createMockTodo({ text: 'Archived 2', completed: true, updated_at: oldCompletion.toISOString() }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      const filtered = result.current.filterArchivedTodos('');

      expect(filtered).toHaveLength(2);
    });
  });

  describe('Customer Filter', () => {
    it('should filter by customer name in text or notes', () => {
      const todos = [
        createMockTodo({ text: 'Call John Smith about policy' }),
        createMockTodo({ text: 'Review documents', notes: 'For John Smith' }),
        createMockTodo({ text: 'Other task' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setCustomerFilter('John Smith');
      });

      expect(result.current.filteredAndSortedTodos).toHaveLength(2);
    });
  });

  describe('Date Range Filter', () => {
    it('should filter by start date', () => {
      // The start date filter excludes todos without due_date and includes those >= start
      // Note: Date parsing has timezone considerations - using well-separated dates
      const todos = [
        createMockTodo({ text: 'Due in future', due_date: '2026-02-15T12:00:00Z' }),
        createMockTodo({ text: 'Due mid month', due_date: '2026-01-15T12:00:00Z' }),
        createMockTodo({ text: 'Due early', due_date: '2026-01-05T12:00:00Z' }),
        createMockTodo({ text: 'No due date' }), // Should be excluded
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      // Filter: start = Jan 10, should exclude early due date and no due date
      act(() => {
        result.current.setDateRangeFilter({
          start: '2026-01-10',
          end: '',
        });
      });

      // Should include future and mid-month (>= start), exclude early and no due date
      expect(result.current.filteredAndSortedTodos).toHaveLength(2);
      const texts = result.current.filteredAndSortedTodos.map(t => t.text);
      expect(texts).toContain('Due in future');
      expect(texts).toContain('Due mid month');
      expect(texts).not.toContain('Due early');
      expect(texts).not.toContain('No due date');
    });

    it('should filter by end date', () => {
      const todos = [
        createMockTodo({ text: 'Due early', due_date: '2026-01-05T12:00:00Z' }),
        createMockTodo({ text: 'Due mid month', due_date: '2026-01-15T12:00:00Z' }),
        createMockTodo({ text: 'Due late', due_date: '2026-01-25T12:00:00Z' }),
        createMockTodo({ text: 'No due date' }), // Should be excluded
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      // Filter: end = Jan 18, should exclude late due date and no due date
      act(() => {
        result.current.setDateRangeFilter({
          start: '',
          end: '2026-01-18',
        });
      });

      // Should include early and mid-month (<= end), exclude late and no due date
      expect(result.current.filteredAndSortedTodos).toHaveLength(2);
      const texts = result.current.filteredAndSortedTodos.map(t => t.text);
      expect(texts).toContain('Due early');
      expect(texts).toContain('Due mid month');
      expect(texts).not.toContain('Due late');
      expect(texts).not.toContain('No due date');
    });
  });

  describe('Has Attachments Filter', () => {
    it('should filter todos with attachments', () => {
      const todos = [
        createMockTodo({
          text: 'With attachment',
          attachments: [{ id: 'a1', file_name: 'doc.pdf', file_type: 'pdf', file_size: 100, storage_path: 'path', mime_type: 'application/pdf', uploaded_by: 'User', uploaded_at: new Date().toISOString() }],
        }),
        createMockTodo({ text: 'Without attachment' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setHasAttachmentsFilter(true);
      });

      expect(result.current.filteredAndSortedTodos).toHaveLength(1);
      expect(result.current.filteredAndSortedTodos[0].text).toBe('With attachment');
    });

    it('should filter todos without attachments', () => {
      const todos = [
        createMockTodo({
          text: 'With attachment',
          attachments: [{ id: 'a1', file_name: 'doc.pdf', file_type: 'pdf', file_size: 100, storage_path: 'path', mime_type: 'application/pdf', uploaded_by: 'User', uploaded_at: new Date().toISOString() }],
        }),
        createMockTodo({ text: 'Without attachment' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setHasAttachmentsFilter(false);
      });

      expect(result.current.filteredAndSortedTodos).toHaveLength(1);
      expect(result.current.filteredAndSortedTodos[0].text).toBe('Without attachment');
    });
  });

  describe('Assigned To Filter', () => {
    it('should filter by specific assignee', () => {
      const todos = [
        createMockTodo({ text: 'Assigned to Derrick', assigned_to: 'Derrick' }),
        createMockTodo({ text: 'Assigned to Sefra', assigned_to: 'Sefra' }),
        createMockTodo({ text: 'Unassigned' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setAssignedToFilter('Derrick');
      });

      expect(result.current.filteredAndSortedTodos).toHaveLength(1);
      expect(result.current.filteredAndSortedTodos[0].assigned_to).toBe('Derrick');
    });

    it('should filter for unassigned todos', () => {
      const todos = [
        createMockTodo({ text: 'Assigned to Derrick', assigned_to: 'Derrick' }),
        createMockTodo({ text: 'Unassigned' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setAssignedToFilter('unassigned');
      });

      expect(result.current.filteredAndSortedTodos).toHaveLength(1);
      expect(result.current.filteredAndSortedTodos[0].text).toBe('Unassigned');
    });
  });

  describe('Search Query with Special Characters', () => {
    it('should search phone numbers', () => {
      // The hook's phone number search looks for digit-only queries in text/notes
      // For this to work, the digits must appear consecutively in the text
      const todos = [
        createMockTodo({ text: 'Call 5551234 about policy' }), // Digits without dashes
        createMockTodo({ text: 'Regular task', notes: 'Number is 5551234' }), // Digits in notes
        createMockTodo({ text: 'Other task' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setSearchQuery('5551234');
      });

      expect(result.current.filteredAndSortedTodos).toHaveLength(2);
    });

    it('should search in transcription', () => {
      const todos = [
        createMockTodo({ text: 'Voicemail task', transcription: 'Customer mentioned renewal' }),
        createMockTodo({ text: 'Regular task' }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const { result } = renderHook(() => useFilters('TestUser'));

      act(() => {
        result.current.setSearchQuery('renewal');
      });

      expect(result.current.filteredAndSortedTodos).toHaveLength(1);
      expect(result.current.filteredAndSortedTodos[0].text).toBe('Voicemail task');
    });
  });
});
