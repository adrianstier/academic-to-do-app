/**
 * Component Integration Tests
 *
 * Tests multiple components working together with the store
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { useTodoStore, selectTodoStats } from '@/store/todoStore';
import TodoStatsCards from '@/components/todo/TodoStatsCards';
import BulkActionBar from '@/components/todo/BulkActionBar';
import ConnectionStatus from '@/components/todo/ConnectionStatus';
import { createMockTodo } from '../factories/todoFactory';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
      update: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
  isSupabaseConfigured: () => true,
}));

// Mock activity logger
vi.mock('@/lib/activityLogger', () => ({
  logActivity: vi.fn(),
}));

describe('Component Integration Tests', () => {
  beforeEach(() => {
    // Reset store state
    const store = useTodoStore.getState();
    store.setTodos([]);
    store.clearSelection();
    store.setSearchQuery('');
    store.setQuickFilter('all');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TodoStatsCards + Store', () => {
    it('should display correct stats from store', () => {
      // Create a due date for today at noon (to avoid timezone issues)
      const todayDate = new Date();
      todayDate.setHours(12, 0, 0, 0);
      const today = todayDate.toISOString();

      // Create a due date for yesterday (clearly in the past)
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      yesterdayDate.setHours(12, 0, 0, 0);
      const yesterday = yesterdayDate.toISOString();

      const todos = [
        createMockTodo({ id: '1', completed: true, status: 'done' }),
        createMockTodo({ id: '2', completed: true, status: 'done' }),
        createMockTodo({ id: '3', completed: false, due_date: today }),
        createMockTodo({ id: '4', completed: false, due_date: yesterday }),
        createMockTodo({ id: '5', completed: false }),
      ];

      act(() => {
        useTodoStore.getState().setTodos(todos);
      });

      const storeStats = selectTodoStats(useTodoStore.getState().todos);
      // Convert store stats to component-expected stats format
      const stats = {
        active: storeStats.total - storeStats.completed,
        completed: storeStats.completed,
        dueToday: storeStats.dueToday,
        overdue: storeStats.overdue,
      };
      const setQuickFilter = vi.fn();
      const setShowCompleted = vi.fn();

      render(
        <TodoStatsCards
          stats={stats}
          quickFilter="all"
          showCompleted={false}
          setQuickFilter={setQuickFilter}
          setShowCompleted={setShowCompleted}
        />
      );

      expect(screen.getByText('3')).toBeInTheDocument(); // Active (5 total - 2 completed = 3)
      // Due today shows 1, Overdue shows 1 (yesterday is overdue)
      // The component shows: To Do (3), Due Today, Overdue
      expect(stats.dueToday).toBe(1);
      expect(stats.overdue).toBe(1);
    });

    it('should update stats when todos change', () => {
      const setQuickFilter = vi.fn();
      const setShowCompleted = vi.fn();

      // Helper to convert store stats to component format
      const toComponentStats = () => {
        const storeStats = selectTodoStats(useTodoStore.getState().todos);
        return {
          active: storeStats.total - storeStats.completed,
          completed: storeStats.completed,
          dueToday: storeStats.dueToday,
          overdue: storeStats.overdue,
        };
      };

      // Initial render with no todos
      act(() => {
        useTodoStore.getState().setTodos([]);
      });

      let stats = toComponentStats();

      const { rerender } = render(
        <TodoStatsCards
          stats={stats}
          quickFilter="all"
          showCompleted={false}
          setQuickFilter={setQuickFilter}
          setShowCompleted={setShowCompleted}
        />
      );

      // Add todos
      act(() => {
        useTodoStore.getState().setTodos([
          createMockTodo({ id: '1', completed: false }),
          createMockTodo({ id: '2', completed: false }),
        ]);
      });

      stats = toComponentStats();

      rerender(
        <TodoStatsCards
          stats={stats}
          quickFilter="all"
          showCompleted={false}
          setQuickFilter={setQuickFilter}
          setShowCompleted={setShowCompleted}
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument(); // Active
    });

    it('should trigger filter change via callback', () => {
      act(() => {
        useTodoStore.getState().setTodos([
          createMockTodo({ id: '1', completed: false }),
        ]);
      });

      const setQuickFilter = vi.fn();
      const setShowCompleted = vi.fn();
      const storeStats = selectTodoStats(useTodoStore.getState().todos);
      const stats = {
        active: storeStats.total - storeStats.completed,
        completed: storeStats.completed,
        dueToday: storeStats.dueToday,
        overdue: storeStats.overdue,
      };

      render(
        <TodoStatsCards
          stats={stats}
          quickFilter="all"
          showCompleted={false}
          setQuickFilter={setQuickFilter}
          setShowCompleted={setShowCompleted}
        />
      );

      // Click on "To Do" card (the first stat card)
      const todoCard = screen.getByText('To Do').closest('button');
      if (todoCard) {
        fireEvent.click(todoCard);
        expect(setQuickFilter).toHaveBeenCalledWith('all');
        expect(setShowCompleted).toHaveBeenCalledWith(false);
      }
    });
  });

  describe('BulkActionBar + Store', () => {
    const defaultProps = {
      selectedCount: 2,
      users: ['Derrick', 'Sefra'],
      onClearSelection: vi.fn(),
      onBulkDelete: vi.fn(),
      onBulkComplete: vi.fn(),
      onBulkAssign: vi.fn(),
      onBulkReschedule: vi.fn(),
      onBulkSetPriority: vi.fn(),
      onInitiateMerge: vi.fn(),
      onGenerateEmail: vi.fn(),
    };

    it('should show selected count from store', () => {
      act(() => {
        useTodoStore.getState().setTodos([
          createMockTodo({ id: 'todo-1' }),
          createMockTodo({ id: 'todo-2' }),
        ]);
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      const selectedCount = useTodoStore.getState().bulkActions.selectedTodos.size;

      render(<BulkActionBar {...defaultProps} selectedCount={selectedCount} />);

      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    it('should call handlers when buttons are clicked', () => {
      render(<BulkActionBar {...defaultProps} />);

      // Click complete button
      const completeButton = screen.getByTitle('Mark all as complete');
      fireEvent.click(completeButton);
      expect(defaultProps.onBulkComplete).toHaveBeenCalled();

      // Click delete button
      const deleteButton = screen.getByTitle('Delete selected');
      fireEvent.click(deleteButton);
      expect(defaultProps.onBulkDelete).toHaveBeenCalled();
    });

    it('should show merge option only when 2+ selected', () => {
      const { rerender } = render(
        <BulkActionBar {...defaultProps} selectedCount={1} />
      );

      // Merge should not be visible with 1 selected
      expect(screen.queryByTitle('Merge selected tasks')).not.toBeInTheDocument();

      rerender(<BulkActionBar {...defaultProps} selectedCount={2} />);

      // Merge should be visible with 2 selected
      expect(screen.getByTitle('Merge selected tasks')).toBeInTheDocument();
    });

    it('should show assign dropdown with users', () => {
      render(<BulkActionBar {...defaultProps} />);

      const assignButton = screen.getByTitle('Assign to user');
      fireEvent.click(assignButton);

      // Users should appear in dropdown
      expect(screen.getByText('Derrick')).toBeInTheDocument();
      expect(screen.getByText('Sefra')).toBeInTheDocument();
    });

    it('should call onBulkAssign when user is selected', () => {
      render(<BulkActionBar {...defaultProps} />);

      // Open dropdown
      const assignButton = screen.getByTitle('Assign to user');
      fireEvent.click(assignButton);

      // Click user
      fireEvent.click(screen.getByText('Derrick'));

      expect(defaultProps.onBulkAssign).toHaveBeenCalledWith('Derrick');
    });
  });

  describe('ConnectionStatus Integration', () => {
    it('should reflect store connection state', () => {
      act(() => {
        useTodoStore.getState().setConnected(true);
      });

      const connected = useTodoStore.getState().connected;

      const { rerender } = render(<ConnectionStatus connected={connected} />);

      expect(screen.getByText('Live')).toBeInTheDocument();

      // Simulate disconnect
      act(() => {
        useTodoStore.getState().setConnected(false);
      });

      const disconnected = useTodoStore.getState().connected;

      rerender(<ConnectionStatus connected={disconnected} />);

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  describe('Multi-Component Workflow', () => {
    it('should simulate complete bulk action workflow', async () => {
      // Setup todos in store
      act(() => {
        useTodoStore.getState().setTodos([
          createMockTodo({ id: 'todo-1', text: 'Task 1', completed: false }),
          createMockTodo({ id: 'todo-2', text: 'Task 2', completed: false }),
          createMockTodo({ id: 'todo-3', text: 'Task 3', completed: true, status: 'done' }),
        ]);
      });

      // Get initial stats - selectTodoStats returns total, not active
      let stats = selectTodoStats(useTodoStore.getState().todos);
      const active = stats.total - stats.completed;
      expect(active).toBe(2);
      expect(stats.completed).toBe(1);

      // Simulate selecting todos
      act(() => {
        useTodoStore.getState().selectAllTodos(['todo-1', 'todo-2']);
      });

      expect(useTodoStore.getState().bulkActions.selectedTodos.size).toBe(2);

      // Simulate bulk complete (would normally go through useBulkActions)
      act(() => {
        useTodoStore.getState().updateTodo('todo-1', { completed: true, status: 'done' });
        useTodoStore.getState().updateTodo('todo-2', { completed: true, status: 'done' });
        useTodoStore.getState().clearSelection();
      });

      // Verify stats updated
      stats = selectTodoStats(useTodoStore.getState().todos);
      const updatedActive = stats.total - stats.completed;
      expect(updatedActive).toBe(0);
      expect(stats.completed).toBe(3);
      expect(useTodoStore.getState().bulkActions.selectedTodos.size).toBe(0);
    });

    it('should filter stats reflect filtered todos', () => {
      // Create a due date for today at noon (to avoid timezone issues)
      const todayDate = new Date();
      todayDate.setHours(12, 0, 0, 0);
      const today = todayDate.toISOString();

      act(() => {
        useTodoStore.getState().setTodos([
          createMockTodo({
            id: 'todo-1',
            text: 'Important meeting',
            priority: 'urgent',
            due_date: today,
          }),
          createMockTodo({
            id: 'todo-2',
            text: 'Low priority task',
            priority: 'low',
          }),
        ]);
      });

      // Get stats from store and convert to component format
      const storeStats = selectTodoStats(useTodoStore.getState().todos);
      const componentStats = {
        active: storeStats.total - storeStats.completed,
        completed: storeStats.completed,
        dueToday: storeStats.dueToday,
        overdue: storeStats.overdue,
      };

      const setQuickFilter = vi.fn();
      const setShowCompleted = vi.fn();

      render(
        <TodoStatsCards
          stats={componentStats}
          quickFilter="all"
          showCompleted={false}
          setQuickFilter={setQuickFilter}
          setShowCompleted={setShowCompleted}
        />
      );

      // Should show due today count
      expect(componentStats.dueToday).toBe(1);
    });
  });

  describe('Store State Persistence Simulation', () => {
    it('should maintain UI state consistency across rerenders', () => {
      act(() => {
        useTodoStore.getState().setTodos([
          createMockTodo({ id: '1', completed: false }),
          createMockTodo({ id: '2', completed: false }),
        ]);
        useTodoStore.getState().setQuickFilter('my_tasks'); // Use a valid QuickFilter value
        useTodoStore.getState().toggleTodoSelection('1');
      });

      // Helper to convert store stats to component format
      const toComponentStats = () => {
        const storeStats = selectTodoStats(useTodoStore.getState().todos);
        return {
          active: storeStats.total - storeStats.completed,
          completed: storeStats.completed,
          dueToday: storeStats.dueToday,
          overdue: storeStats.overdue,
        };
      };

      // First render
      const setQuickFilter = vi.fn();
      const setShowCompleted = vi.fn();

      const { rerender } = render(
        <TodoStatsCards
          stats={toComponentStats()}
          quickFilter={useTodoStore.getState().filters.quickFilter}
          showCompleted={false}
          setQuickFilter={setQuickFilter}
          setShowCompleted={setShowCompleted}
        />
      );

      // Verify state persists
      expect(useTodoStore.getState().filters.quickFilter).toBe('my_tasks');
      expect(useTodoStore.getState().bulkActions.selectedTodos.size).toBe(1);

      // Rerender
      rerender(
        <TodoStatsCards
          stats={toComponentStats()}
          quickFilter={useTodoStore.getState().filters.quickFilter}
          showCompleted={false}
          setQuickFilter={setQuickFilter}
          setShowCompleted={setShowCompleted}
        />
      );

      // State should persist
      expect(useTodoStore.getState().filters.quickFilter).toBe('my_tasks');
      expect(useTodoStore.getState().bulkActions.selectedTodos.size).toBe(1);
    });
  });
});
