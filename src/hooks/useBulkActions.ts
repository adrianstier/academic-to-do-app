/**
 * useBulkActions Hook
 *
 * Manages bulk selection and operations on multiple todos.
 * Extracted from TodoList.tsx for cleaner separation of concerns.
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useTodoStore } from '@/store/todoStore';
import { TodoStatus, TodoPriority } from '@/types/todo';
import { logActivity } from '@/lib/activityLogger';
import { logger } from '@/lib/logger';

export function useBulkActions(userName: string) {
  const {
    todos,
    bulkActions,
    toggleTodoSelection,
    selectAllTodos,
    clearSelection,
    setShowBulkActions,
    updateTodo: updateTodoInStore,
    deleteTodo: deleteTodoFromStore,
    addTodo: addTodoToStore,
  } = useTodoStore();

  const { selectedTodos, showBulkActions } = bulkActions;

  // Get selected todo objects
  const getSelectedTodos = useCallback(() => {
    return todos.filter(t => selectedTodos.has(t.id));
  }, [todos, selectedTodos]);

  // Select/deselect individual todo
  const handleSelectTodo = useCallback((id: string, _selected: boolean) => {
    toggleTodoSelection(id);
  }, [toggleTodoSelection]);

  // Select all visible todos
  const selectAll = useCallback((visibleTodoIds: string[]) => {
    selectAllTodos(visibleTodoIds);
  }, [selectAllTodos]);

  // Bulk delete selected todos
  const bulkDelete = useCallback(async (onConfirm: (count: number, action: () => Promise<void>) => void) => {
    const count = selectedTodos.size;
    if (count === 0) return;

    onConfirm(count, async () => {
      const idsToDelete = Array.from(selectedTodos);
      const todosToDelete = todos.filter(t => selectedTodos.has(t.id));

      // Optimistic delete
      idsToDelete.forEach(id => deleteTodoFromStore(id));
      clearSelection();
      setShowBulkActions(false);

      const { error } = await supabase
        .from('todos')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        logger.error('Error bulk deleting', error, { component: 'useBulkActions' });
        // Rollback
        todosToDelete.forEach(todo => addTodoToStore(todo));
      } else {
        // Log activity for each deleted todo
        todosToDelete.forEach(todo => {
          logActivity({
            action: 'task_deleted',
            userName,
            todoId: todo.id,
            todoText: todo.text,
            details: { bulk_action: true },
          });
        });
      }
    });
  }, [selectedTodos, todos, userName, deleteTodoFromStore, addTodoToStore, clearSelection, setShowBulkActions]);

  // Bulk assign selected todos
  const bulkAssign = useCallback(async (assignedTo: string) => {
    const idsToUpdate = Array.from(selectedTodos);
    const originalTodos = todos.filter(t => selectedTodos.has(t.id));

    // Optimistic update
    idsToUpdate.forEach(id => {
      updateTodoInStore(id, { assigned_to: assignedTo });
    });
    clearSelection();
    setShowBulkActions(false);

    const { error } = await supabase
      .from('todos')
      .update({ assigned_to: assignedTo })
      .in('id', idsToUpdate);

    if (error) {
      logger.error('Error bulk assigning', error, { component: 'useBulkActions' });
      // Rollback
      originalTodos.forEach(todo => {
        updateTodoInStore(todo.id, { assigned_to: todo.assigned_to });
      });
    } else {
      // Log activity
      originalTodos.forEach(todo => {
        logActivity({
          action: 'assigned_to_changed',
          userName,
          todoId: todo.id,
          todoText: todo.text,
          details: { from: todo.assigned_to || null, to: assignedTo, bulk_action: true },
        });
      });
    }
  }, [selectedTodos, todos, userName, updateTodoInStore, clearSelection, setShowBulkActions]);

  // Bulk complete selected todos
  const bulkComplete = useCallback(async () => {
    const idsToUpdate = Array.from(selectedTodos);
    const originalTodos = todos.filter(t => selectedTodos.has(t.id));

    // Optimistic update
    idsToUpdate.forEach(id => {
      updateTodoInStore(id, { completed: true, status: 'done' as TodoStatus });
    });
    clearSelection();
    setShowBulkActions(false);

    const { error } = await supabase
      .from('todos')
      .update({ completed: true, status: 'done' })
      .in('id', idsToUpdate);

    if (error) {
      logger.error('Error bulk completing', error, { component: 'useBulkActions' });
      // Rollback
      originalTodos.forEach(todo => {
        updateTodoInStore(todo.id, { completed: todo.completed, status: todo.status });
      });
    } else {
      // Log activity
      originalTodos.forEach(todo => {
        if (!todo.completed) {
          logActivity({
            action: 'task_completed',
            userName,
            todoId: todo.id,
            todoText: todo.text,
            details: { bulk_action: true },
          });
        }
      });
    }
  }, [selectedTodos, todos, userName, updateTodoInStore, clearSelection, setShowBulkActions]);

  // Bulk reschedule - set new due date for selected tasks
  const bulkReschedule = useCallback(async (newDueDate: string) => {
    const idsToUpdate = Array.from(selectedTodos);
    const originalTodos = todos.filter(t => selectedTodos.has(t.id));

    // Optimistic update
    idsToUpdate.forEach(id => {
      updateTodoInStore(id, { due_date: newDueDate });
    });
    clearSelection();
    setShowBulkActions(false);

    const { error } = await supabase
      .from('todos')
      .update({ due_date: newDueDate })
      .in('id', idsToUpdate);

    if (error) {
      logger.error('Error bulk rescheduling', error, { component: 'useBulkActions' });
      // Rollback
      originalTodos.forEach(todo => {
        updateTodoInStore(todo.id, { due_date: todo.due_date });
      });
    } else {
      // Log activity
      originalTodos.forEach(todo => {
        logActivity({
          action: 'due_date_changed',
          userName,
          todoId: todo.id,
          todoText: todo.text,
          details: { from: todo.due_date || null, to: newDueDate, bulk_action: true },
        });
      });
    }
  }, [selectedTodos, todos, userName, updateTodoInStore, clearSelection, setShowBulkActions]);

  // Bulk set priority
  const bulkSetPriority = useCallback(async (priority: TodoPriority) => {
    const idsToUpdate = Array.from(selectedTodos);
    const originalTodos = todos.filter(t => selectedTodos.has(t.id));

    // Optimistic update
    idsToUpdate.forEach(id => {
      updateTodoInStore(id, { priority });
    });
    clearSelection();
    setShowBulkActions(false);

    const { error } = await supabase
      .from('todos')
      .update({ priority })
      .in('id', idsToUpdate);

    if (error) {
      logger.error('Error bulk setting priority', error, { component: 'useBulkActions' });
      // Rollback
      originalTodos.forEach(todo => {
        updateTodoInStore(todo.id, { priority: todo.priority });
      });
    } else {
      // Log activity
      originalTodos.forEach(todo => {
        logActivity({
          action: 'priority_changed',
          userName,
          todoId: todo.id,
          todoText: todo.text,
          details: { from: todo.priority, to: priority, bulk_action: true },
        });
      });
    }
  }, [selectedTodos, todos, userName, updateTodoInStore, clearSelection, setShowBulkActions]);

  // Merge selected todos into one
  const mergeTodos = useCallback(async (primaryTodoId: string) => {
    const todosToMerge = todos.filter(t => selectedTodos.has(t.id));
    if (todosToMerge.length < 2) return false;

    const primaryTodo = todosToMerge.find(t => t.id === primaryTodoId);
    const secondaryTodos = todosToMerge.filter(t => t.id !== primaryTodoId);

    if (!primaryTodo) return false;

    try {
      // Combine data from all todos
      const combinedNotes = [
        primaryTodo.notes,
        ...secondaryTodos.map(t => t.notes),
        `\n--- Merged Tasks (${new Date().toLocaleString()}) ---`,
        ...secondaryTodos.map(t => `• "${t.text}" (created ${new Date(t.created_at).toLocaleDateString()})`)
      ].filter(Boolean).join('\n');

      // Combine all attachments
      const combinedAttachments = [
        ...(primaryTodo.attachments || []),
        ...secondaryTodos.flatMap(t => t.attachments || [])
      ];

      // Combine all subtasks
      const combinedSubtasks = [
        ...(primaryTodo.subtasks || []),
        ...secondaryTodos.flatMap(t => t.subtasks || [])
      ];

      // Combine text
      const combinedText = secondaryTodos.length > 0
        ? `${primaryTodo.text} [+${secondaryTodos.length} merged]`
        : primaryTodo.text;

      // Keep highest priority
      const priorityRank: Record<TodoPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const highestPriority = [primaryTodo, ...secondaryTodos]
        .reduce((highest, t) => {
          return priorityRank[t.priority || 'medium'] < priorityRank[highest] ? (t.priority || 'medium') : highest;
        }, primaryTodo.priority || 'medium');

      // Update primary todo in database
      const { error: updateError } = await supabase
        .from('todos')
        .update({
          text: combinedText,
          notes: combinedNotes,
          attachments: combinedAttachments,
          subtasks: combinedSubtasks,
          priority: highestPriority,
        })
        .eq('id', primaryTodoId);

      if (updateError) {
        logger.error('Error updating merged todo', updateError, { component: 'useBulkActions' });
        return false;
      }

      // Delete secondary todos
      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .in('id', secondaryTodos.map(t => t.id));

      if (deleteError) {
        logger.error('Error deleting merged todos', deleteError, { component: 'useBulkActions' });
        return false;
      }

      // Update store
      updateTodoInStore(primaryTodoId, {
        text: combinedText,
        notes: combinedNotes,
        attachments: combinedAttachments,
        subtasks: combinedSubtasks,
        priority: highestPriority,
      });

      secondaryTodos.forEach(t => deleteTodoFromStore(t.id));

      // Log activity
      logActivity({
        action: 'tasks_merged',
        userName,
        todoId: primaryTodoId,
        todoText: combinedText,
        details: {
          merged_count: secondaryTodos.length,
          merged_ids: secondaryTodos.map(t => t.id),
        },
      });

      // Clear selection
      clearSelection();
      setShowBulkActions(false);

      return true;
    } catch (error) {
      logger.error('Error during merge', error, { component: 'useBulkActions' });
      return false;
    }
  }, [selectedTodos, todos, userName, updateTodoInStore, deleteTodoFromStore, clearSelection, setShowBulkActions]);

  // Helper to get date offset
  const getDateOffset = useCallback((days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }, []);

  return {
    // State
    selectedTodos,
    showBulkActions,
    selectedCount: selectedTodos.size,

    // Selection actions
    handleSelectTodo,
    selectAll,
    clearSelection,
    setShowBulkActions,
    getSelectedTodos,

    // Bulk operations
    bulkDelete,
    bulkAssign,
    bulkComplete,
    bulkReschedule,
    bulkSetPriority,
    mergeTodos,

    // Utilities
    getDateOffset,
  };
}
