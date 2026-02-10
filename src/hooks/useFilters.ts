/**
 * useFilters Hook
 *
 * Manages all filter, search, and sort state for todos.
 * Extracted from TodoList.tsx for cleaner separation of concerns.
 */

import { useMemo, useCallback } from 'react';
import { useTodoStore, isDueToday, isOverdue, priorityOrder } from '@/store/todoStore';
import { TodoStatus, SortOption, QuickFilter } from '@/types/todo';
import { extractPotentialNames } from '@/lib/duplicateDetection';

export interface FilterState {
  searchQuery: string;
  sortOption: SortOption;
  quickFilter: QuickFilter;
  showCompleted: boolean;
  highPriorityOnly: boolean;
  statusFilter: TodoStatus | 'all';
  assignedToFilter: string;
  customerFilter: string;
  hasAttachmentsFilter: boolean | null;
  dateRangeFilter: { start: string; end: string };
  showAdvancedFilters: boolean;
  projectFilter: string | null;
  tagFilter: string[];
}

export function useFilters(userName: string) {
  const {
    todos,
    filters,
    setFilters,
    setSearchQuery,
    setQuickFilter,
    setSortOption,
    setShowCompleted,
    setHighPriorityOnly,
    setShowAdvancedFilters,
    resetFilters,
  } = useTodoStore();

  // Get archived todos (completed > 48 hours ago)
  const archivedTodos = useMemo(() => {
    // Using Date.now() here is intentional - we want current time when todos change
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return todos
      .filter((todo) => {
        if (!todo.completed) return false;
        const raw = todo.updated_at || todo.created_at;
        if (!raw) return false;
        const completedAt = new Date(raw).getTime();
        return !Number.isNaN(completedAt) && completedAt <= cutoff;
      })
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at).getTime();
        const bTime = new Date(b.updated_at || b.created_at).getTime();
        return bTime - aTime;
      });
  }, [todos]);

  const archivedIds = useMemo(() => new Set(archivedTodos.map((todo) => todo.id)), [archivedTodos]);

  // Visible todos (excluding archived)
  const visibleTodos = useMemo(() => {
    return todos.filter((todo) => !archivedIds.has(todo.id));
  }, [todos, archivedIds]);

  // Extract unique customer names for filtering
  const uniqueCustomers = useMemo(() => {
    const customers = new Set<string>();
    visibleTodos.forEach(todo => {
      const names = extractPotentialNames(`${todo.text} ${todo.notes || ''}`);
      names.forEach(name => customers.add(name));
    });
    return Array.from(customers).sort();
  }, [visibleTodos]);

  // Filter archived todos by search query
  const filterArchivedTodos = useCallback((query: string) => {
    const searchLower = query.trim().toLowerCase();
    if (!searchLower) return archivedTodos;
    return archivedTodos.filter((todo) =>
      todo.text.toLowerCase().includes(searchLower) ||
      todo.created_by.toLowerCase().includes(searchLower) ||
      (todo.assigned_to && todo.assigned_to.toLowerCase().includes(searchLower)) ||
      (todo.notes && todo.notes.toLowerCase().includes(searchLower)) ||
      (todo.transcription && todo.transcription.toLowerCase().includes(searchLower))
    );
  }, [archivedTodos]);

  // Apply all filters and sorting
  const filteredAndSortedTodos = useMemo(() => {
    let result = [...visibleTodos];

    // Apply search filter (comprehensive search including transcription)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (todo) =>
          todo.text.toLowerCase().includes(query) ||
          todo.created_by.toLowerCase().includes(query) ||
          (todo.assigned_to && todo.assigned_to.toLowerCase().includes(query)) ||
          (todo.notes && todo.notes.toLowerCase().includes(query)) ||
          (todo.transcription && todo.transcription.toLowerCase().includes(query)) ||
          // Search phone numbers in text/notes/transcription
          (query.match(/^\d+$/) && (
            todo.text.includes(query) ||
            (todo.notes && todo.notes.includes(query)) ||
            (todo.transcription && todo.transcription.includes(query))
          ))
      );
    }

    // Apply quick filter
    switch (filters.quickFilter) {
      case 'my_tasks':
        result = result.filter((todo) => todo.assigned_to === userName || todo.created_by === userName);
        break;
      case 'due_today':
        result = result.filter((todo) => isDueToday(todo.due_date) && !todo.completed);
        break;
      case 'overdue':
        result = result.filter((todo) => isOverdue(todo.due_date, todo.completed));
        break;
    }

    // Apply high priority filter
    if (filters.highPriorityOnly) {
      result = result.filter((todo) => todo.priority === 'urgent' || todo.priority === 'high');
    }

    // Apply status filter
    if (filters.statusFilter !== 'all') {
      result = result.filter((todo) => todo.status === filters.statusFilter);
    }

    // Apply assigned to filter
    if (filters.assignedToFilter !== 'all') {
      if (filters.assignedToFilter === 'unassigned') {
        result = result.filter((todo) => !todo.assigned_to);
      } else {
        result = result.filter((todo) => todo.assigned_to === filters.assignedToFilter);
      }
    }

    // Apply customer filter
    if (filters.customerFilter !== 'all') {
      const customerLower = filters.customerFilter.toLowerCase();
      result = result.filter((todo) => {
        const combinedText = `${todo.text} ${todo.notes || ''}`.toLowerCase();
        return combinedText.includes(customerLower);
      });
    }

    // Apply has attachments filter
    if (filters.hasAttachmentsFilter !== null) {
      if (filters.hasAttachmentsFilter) {
        result = result.filter((todo) => todo.attachments && todo.attachments.length > 0);
      } else {
        result = result.filter((todo) => !todo.attachments || todo.attachments.length === 0);
      }
    }

    // Apply date range filter
    if (filters.dateRangeFilter.start) {
      const startDate = new Date(filters.dateRangeFilter.start);
      startDate.setHours(0, 0, 0, 0);
      result = result.filter((todo) => {
        if (!todo.due_date) return false;
        const dueDate = new Date(todo.due_date);
        return dueDate >= startDate;
      });
    }
    if (filters.dateRangeFilter.end) {
      const endDate = new Date(filters.dateRangeFilter.end);
      endDate.setHours(23, 59, 59, 999);
      result = result.filter((todo) => {
        if (!todo.due_date) return false;
        const dueDate = new Date(todo.due_date);
        return dueDate <= endDate;
      });
    }

    // Apply project filter
    if (filters.projectFilter !== null && filters.projectFilter !== undefined) {
      result = result.filter((todo) => todo.project_id === filters.projectFilter);
    }

    // Apply tag filter (todos must have ALL selected tags)
    if (filters.tagFilter && filters.tagFilter.length > 0) {
      result = result.filter((todo) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const todoTagIds: string[] = (todo as any).tag_ids || [];
        return filters.tagFilter.every((tagId) => todoTagIds.includes(tagId));
      });
    }

    // Hide completed unless explicitly shown
    if (!filters.showCompleted) {
      result = result.filter((todo) => !todo.completed);
    }

    // Apply sorting
    switch (filters.sortOption) {
      case 'urgency':
        // Sort by: priority (urgent first), then overdue, then due today, then by due date
        result.sort((a, b) => {
          // Completed items go to bottom
          if (a.completed !== b.completed) return a.completed ? 1 : -1;

          // Priority comparison
          const priorityDiff = priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium'];
          if (priorityDiff !== 0) return priorityDiff;

          // Overdue items come first
          const aOverdue = isOverdue(a.due_date, a.completed);
          const bOverdue = isOverdue(b.due_date, b.completed);
          if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

          // Due today comes next
          const aDueToday = isDueToday(a.due_date);
          const bDueToday = isDueToday(b.due_date);
          if (aDueToday !== bDueToday) return aDueToday ? -1 : 1;

          // Sort by due date (earliest first)
          if (a.due_date && b.due_date) {
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          }
          if (a.due_date) return -1;
          if (b.due_date) return 1;

          // Fall back to created date
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        break;

      case 'priority':
        result.sort((a, b) => {
          const priorityDiff = priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium'];
          if (priorityDiff !== 0) return priorityDiff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        break;

      case 'due_date':
        result.sort((a, b) => {
          if (!a.due_date && !b.due_date) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });
        break;

      case 'created':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;

      case 'alphabetical':
        result.sort((a, b) => a.text.localeCompare(b.text));
        break;

      case 'custom':
        // Custom order is handled separately in the component via customOrder state
        break;
    }

    return result;
  }, [visibleTodos, filters, userName]);

  // Filter counts for UI
  const filterCounts = useMemo(() => {
    const activeTodos = visibleTodos.filter(t => !t.completed);
    return {
      all: visibleTodos.length,
      active: activeTodos.length,
      completed: visibleTodos.filter(t => t.completed).length,
      myTasks: visibleTodos.filter(t => t.assigned_to === userName || t.created_by === userName).length,
      dueToday: visibleTodos.filter(t => isDueToday(t.due_date) && !t.completed).length,
      overdue: visibleTodos.filter(t => isOverdue(t.due_date, t.completed)).length,
      urgent: visibleTodos.filter(t => t.priority === 'urgent' && !t.completed).length,
    };
  }, [visibleTodos, userName]);

  // Check if any advanced filters are active
  const hasActiveAdvancedFilters = useMemo(() => {
    return (
      filters.statusFilter !== 'all' ||
      filters.assignedToFilter !== 'all' ||
      filters.customerFilter !== 'all' ||
      filters.hasAttachmentsFilter !== null ||
      filters.dateRangeFilter.start !== '' ||
      filters.dateRangeFilter.end !== '' ||
      filters.projectFilter !== null ||
      (filters.tagFilter && filters.tagFilter.length > 0)
    );
  }, [filters]);

  // Update advanced filters
  const setStatusFilter = useCallback((value: TodoStatus | 'all') => {
    setFilters({ statusFilter: value });
  }, [setFilters]);

  const setAssignedToFilter = useCallback((value: string) => {
    setFilters({ assignedToFilter: value });
  }, [setFilters]);

  const setCustomerFilter = useCallback((value: string) => {
    setFilters({ customerFilter: value });
  }, [setFilters]);

  const setHasAttachmentsFilter = useCallback((value: boolean | null) => {
    setFilters({ hasAttachmentsFilter: value });
  }, [setFilters]);

  const setDateRangeFilter = useCallback((value: { start: string; end: string }) => {
    setFilters({ dateRangeFilter: value });
  }, [setFilters]);

  const setProjectFilter = useCallback((value: string | null) => {
    setFilters({ projectFilter: value });
  }, [setFilters]);

  const setTagFilter = useCallback((value: string[]) => {
    setFilters({ tagFilter: value });
  }, [setFilters]);

  // Clear all advanced filters
  const clearAdvancedFilters = useCallback(() => {
    setFilters({
      statusFilter: 'all',
      assignedToFilter: 'all',
      customerFilter: 'all',
      hasAttachmentsFilter: null,
      dateRangeFilter: { start: '', end: '' },
      projectFilter: null,
      tagFilter: [],
    });
  }, [setFilters]);

  return {
    // State
    filters,

    // Computed data
    visibleTodos,
    filteredAndSortedTodos,
    archivedTodos,
    archivedIds,
    uniqueCustomers,
    filterCounts,
    hasActiveAdvancedFilters,

    // Filter setters
    setSearchQuery,
    setQuickFilter,
    setSortOption,
    setShowCompleted,
    setHighPriorityOnly,
    setShowAdvancedFilters,
    setStatusFilter,
    setAssignedToFilter,
    setCustomerFilter,
    setHasAttachmentsFilter,
    setDateRangeFilter,
    setProjectFilter,
    setTagFilter,

    // Filter actions
    clearAdvancedFilters,
    resetFilters,
    filterArchivedTodos,
  };
}
