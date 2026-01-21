/**
 * useTodoData Hook
 *
 * Handles fetching todos, real-time subscriptions, and CRUD operations.
 * Encapsulates all Supabase interactions for todos.
 */

import { useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useTodoStore } from '@/store/todoStore';
import { Todo, TodoPriority, Subtask } from '@/types/todo';
import { AuthUser } from '@/types/todo';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '@/lib/activityLogger';
import { shouldShowWelcomeNotification } from '@/components/WelcomeBackNotification';
import { logger } from '@/lib/logger';
import { fetchWithCsrf } from '@/lib/csrf';
import { sendTaskAssignmentNotification } from '@/lib/taskNotifications';
import { createAutoReminders, updateAutoReminders } from '@/lib/reminderService';

export function useTodoData(currentUser: AuthUser) {
  const {
    setTodos,
    addTodo: addTodoToStore,
    updateTodo: updateTodoInStore,
    deleteTodo: deleteTodoFromStore,
    setUsers,
    setUsersWithColors,
    setLoading,
    setConnected,
    setError,
    setShowWelcomeBack,
    todos,
  } = useTodoStore();

  const userName = currentUser.name;

  // Fetch todos and users
  const fetchTodos = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Please check your environment variables.');
      setLoading(false);
      return;
    }

    const [todosResult, usersResult] = await Promise.all([
      supabase.from('todos').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('name, color').order('name'),
    ]);

    if (todosResult.error) {
      logger.error('Error fetching todos', todosResult.error, { component: 'useTodoData' });
      setError('Failed to connect to database. Please check your Supabase configuration.');
    } else {
      setTodos(todosResult.data || []);
      const registeredUsers = (usersResult.data || []).map((u: { name: string }) => u.name);
      const todoUsers = [...new Set((todosResult.data || []).map((t: Todo) => t.created_by).filter(Boolean))];
      setUsers([...new Set([...registeredUsers, ...todoUsers])]);
      setUsersWithColors((usersResult.data || []).map((u: { name: string; color: string }) => ({
        name: u.name,
        color: u.color || '#0033A0'
      })));
      setError(null);
    }
    setLoading(false);
  }, [setTodos, setUsers, setUsersWithColors, setLoading, setError]);

  // Setup real-time subscription
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Please check your environment variables.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const init = async () => {
      await fetchTodos();
      if (isMounted) {
        if (shouldShowWelcomeNotification(currentUser)) {
          setShowWelcomeBack(true);
        }
      }
    };

    init();

    const channel = supabase
      .channel('todos-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos' },
        (payload) => {
          if (!isMounted) return;
          if (payload.eventType === 'INSERT') {
            const newTodo = payload.new as Todo;
            // Check if todo already exists (to avoid duplicates from optimistic updates)
            const store = useTodoStore.getState();
            const exists = store.todos.some((t) => t.id === newTodo.id);
            if (!exists) {
              addTodoToStore(newTodo);
            }
          } else if (payload.eventType === 'UPDATE') {
            updateTodoInStore(payload.new.id, payload.new as Todo);
          } else if (payload.eventType === 'DELETE') {
            deleteTodoFromStore(payload.old.id);
          }
        }
      )
      .subscribe((status) => {
        if (isMounted) setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [fetchTodos, currentUser, setShowWelcomeBack, setConnected, setError, setLoading, addTodoToStore, updateTodoInStore, deleteTodoFromStore]);

  // Create a new todo
  const createTodo = useCallback(async (
    text: string,
    priority: TodoPriority,
    dueDate?: string,
    assignedTo?: string,
    subtasks?: Subtask[],
    transcription?: string,
    sourceFile?: File
  ) => {
    const newTodo: Todo = {
      id: uuidv4(),
      text,
      completed: false,
      status: 'todo',
      priority,
      created_at: new Date().toISOString(),
      created_by: userName,
      due_date: dueDate,
      assigned_to: assignedTo,
      subtasks: subtasks,
      transcription: transcription,
    };

    // Optimistic update
    addTodoToStore(newTodo);

    const insertData: Record<string, unknown> = {
      id: newTodo.id,
      text: newTodo.text,
      completed: newTodo.completed,
      created_at: newTodo.created_at,
      created_by: newTodo.created_by,
    };

    if (newTodo.status && newTodo.status !== 'todo') insertData.status = newTodo.status;
    if (newTodo.priority && newTodo.priority !== 'medium') insertData.priority = newTodo.priority;
    if (newTodo.due_date) insertData.due_date = newTodo.due_date;
    if (newTodo.assigned_to) insertData.assigned_to = newTodo.assigned_to;
    if (newTodo.subtasks && newTodo.subtasks.length > 0) insertData.subtasks = newTodo.subtasks;
    if (newTodo.transcription) insertData.transcription = newTodo.transcription;

    const { error: insertError } = await supabase.from('todos').insert([insertData]);

    if (insertError) {
      logger.error('Error adding todo', insertError, { component: 'useTodoData' });
      // Rollback optimistic update
      deleteTodoFromStore(newTodo.id);
      return null;
    }

    // Log activity
    logActivity({
      action: 'task_created',
      userName,
      todoId: newTodo.id,
      todoText: newTodo.text,
      details: {
        priority: newTodo.priority,
        assigned_to: newTodo.assigned_to,
        due_date: newTodo.due_date,
        has_subtasks: (subtasks?.length || 0) > 0,
        has_transcription: !!transcription,
      },
    });

    // Send notification if task is assigned to someone else
    if (newTodo.assigned_to && newTodo.assigned_to !== userName) {
      sendTaskAssignmentNotification({
        taskId: newTodo.id,
        taskText: newTodo.text,
        assignedTo: newTodo.assigned_to,
        assignedBy: userName,
        dueDate: newTodo.due_date,
        priority: newTodo.priority,
        subtasks: newTodo.subtasks,
      });
    }

    // Auto-attach source file if provided
    if (sourceFile) {
      try {
        const formData = new FormData();
        formData.append('file', sourceFile);
        formData.append('todoId', newTodo.id);
        formData.append('userName', userName);

        await fetchWithCsrf('/api/attachments', {
          method: 'POST',
          body: formData,
        });
      } catch (err) {
        logger.error('Failed to attach source file', err, { component: 'useTodoData' });
      }
    }

    // Create auto-reminders for tasks with due dates
    if (newTodo.due_date && newTodo.assigned_to) {
      // Get the user ID for the assignee to send push notifications
      const { data: assigneeData } = await supabase
        .from('users')
        .select('id')
        .eq('name', newTodo.assigned_to)
        .single();

      if (assigneeData?.id) {
        const reminderResult = await createAutoReminders(
          newTodo.id,
          newTodo.due_date,
          assigneeData.id,
          userName
        );
        if (!reminderResult.success) {
          logger.warn('Failed to create auto-reminders', {
            component: 'useTodoData',
            error: reminderResult.error,
          });
        } else if (reminderResult.created > 0) {
          logger.info(`Created ${reminderResult.created} auto-reminders for task`, {
            component: 'useTodoData',
            taskId: newTodo.id,
          });
        }
      }
    }

    return newTodo;
  }, [userName, addTodoToStore, deleteTodoFromStore]);

  // Update an existing todo
  const updateTodo = useCallback(async (id: string, updates: Partial<Todo>) => {
    // Get current todo for rollback
    const currentTodo = todos.find((t) => t.id === id);
    if (!currentTodo) return false;

    // Optimistic update
    updateTodoInStore(id, {
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: userName,
    });

    const { error } = await supabase
      .from('todos')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: userName,
      })
      .eq('id', id);

    if (error) {
      logger.error('Error updating todo', error, { component: 'useTodoData' });
      // Rollback
      updateTodoInStore(id, currentTodo);
      return false;
    }

    // Update auto-reminders if due_date changed
    const dueDateChanged = 'due_date' in updates && updates.due_date !== currentTodo.due_date;
    const assignedToChanged = 'assigned_to' in updates && updates.assigned_to !== currentTodo.assigned_to;

    if (dueDateChanged || assignedToChanged) {
      const assignedTo = updates.assigned_to ?? currentTodo.assigned_to;
      const newDueDate = updates.due_date ?? currentTodo.due_date;

      if (assignedTo) {
        // Get user ID for the assignee
        const { data: assigneeData } = await supabase
          .from('users')
          .select('id')
          .eq('name', assignedTo)
          .single();

        if (assigneeData?.id) {
          const reminderResult = await updateAutoReminders(
            id,
            newDueDate || null,
            assigneeData.id,
            userName
          );
          if (!reminderResult.success) {
            logger.warn('Failed to update auto-reminders', {
              component: 'useTodoData',
              error: reminderResult.error,
            });
          }
        }
      }
    }

    return true;
  }, [todos, userName, updateTodoInStore]);

  // Delete a todo
  const deleteTodo = useCallback(async (id: string) => {
    // Get current todo for rollback
    const currentTodo = todos.find((t) => t.id === id);
    if (!currentTodo) return false;

    // Optimistic delete
    deleteTodoFromStore(id);

    const { error } = await supabase.from('todos').delete().eq('id', id);

    if (error) {
      logger.error('Error deleting todo', error, { component: 'useTodoData' });
      // Rollback
      addTodoToStore(currentTodo);
      return false;
    }

    // Log activity
    logActivity({
      action: 'task_deleted',
      userName,
      todoId: id,
      todoText: currentTodo.text,
    });

    return true;
  }, [todos, userName, deleteTodoFromStore, addTodoToStore]);

  // Toggle todo completion
  const toggleComplete = useCallback(async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return false;

    const newCompleted = !todo.completed;
    const newStatus = newCompleted ? 'done' : 'todo';

    const success = await updateTodo(id, {
      completed: newCompleted,
      status: newStatus,
    });

    if (success) {
      logActivity({
        action: newCompleted ? 'task_completed' : 'task_reopened',
        userName,
        todoId: id,
        todoText: todo.text,
      });
    }

    return success;
  }, [todos, userName, updateTodo]);

  // Refresh data
  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchTodos();
  }, [fetchTodos, setLoading]);

  return {
    createTodo,
    updateTodo,
    deleteTodo,
    toggleComplete,
    refresh,
  };
}
