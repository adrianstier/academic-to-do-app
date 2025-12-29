'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Todo, TodoStatus, TodoPriority, ViewMode, SortOption, QuickFilter, RecurrencePattern, Subtask, Attachment, OWNER_USERNAME } from '@/types/todo';
import TodoItem from './TodoItem';
import SortableTodoItem from './SortableTodoItem';
import AddTodo from './AddTodo';
import KanbanBoard from './KanbanBoard';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import CelebrationEffect from './CelebrationEffect';
import ProgressSummary from './ProgressSummary';
import WelcomeBackNotification, { shouldShowWelcomeNotification } from './WelcomeBackNotification';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import WeeklyProgressChart from './WeeklyProgressChart';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import PullToRefresh from './PullToRefresh';
import { v4 as uuidv4 } from 'uuid';
import {
  LayoutList, LayoutGrid, Wifi, WifiOff, Search,
  ArrowUpDown, User, Calendar, AlertTriangle, CheckSquare,
  Trash2, X, Sun, Moon, ChevronDown, BarChart2, Activity, Target
} from 'lucide-react';
import { AuthUser } from '@/types/todo';
import UserSwitcher from './UserSwitcher';
import ChatPanel from './ChatPanel';
import TemplatePicker from './TemplatePicker';
import ActivityFeed from './ActivityFeed';
import StrategicDashboard from './StrategicDashboard';
import SaveTemplateModal from './SaveTemplateModal';
import { useTheme } from '@/contexts/ThemeContext';
import { logActivity } from '@/lib/activityLogger';

interface TodoListProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
}

// Helper to check if due today
const isDueToday = (dueDate?: string) => {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
};

// Helper to check if overdue
const isOverdue = (dueDate?: string, completed?: boolean) => {
  if (!dueDate || completed) return false;
  const d = new Date(dueDate);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return d < today;
};

// Priority sort order
const priorityOrder: Record<TodoPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function TodoList({ currentUser, onUserChange }: TodoListProps) {
  const userName = currentUser.name;
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [users, setUsers] = useState<string[]>([]);
  const [usersWithColors, setUsersWithColors] = useState<{ name: string; color: string }[]>([]);

  // Search, sort, and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('created');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [showCompleted, setShowCompleted] = useState(false);

  // Bulk actions state
  const [selectedTodos, setSelectedTodos] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Celebration and notifications
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationText, setCelebrationText] = useState('');
  const [showProgressSummary, setShowProgressSummary] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [showWeeklyChart, setShowWeeklyChart] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);
  const [showStrategicDashboard, setShowStrategicDashboard] = useState(false);
  const [templateTodo, setTemplateTodo] = useState<Todo | null>(null);
  const [customOrder, setCustomOrder] = useState<string[]>([]);

  // DnD sensors for drag-and-drop reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activating
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // 'n' - focus new task input
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const input = document.querySelector('textarea[placeholder*="task"]') as HTMLTextAreaElement;
        if (input) input.focus();
      }

      // '/' - focus search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const search = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (search) search.focus();
      }

      // 'Escape' - clear selection
      if (e.key === 'Escape') {
        setSelectedTodos(new Set());
        setSearchQuery('');
        setShowBulkActions(false);
      }

      // '1-4' - quick filter shortcuts
      if (e.key === '1') { e.preventDefault(); setQuickFilter('all'); }
      if (e.key === '2') { e.preventDefault(); setQuickFilter('my_tasks'); }
      if (e.key === '3') { e.preventDefault(); setQuickFilter('due_today'); }
      if (e.key === '4') { e.preventDefault(); setQuickFilter('urgent'); }

      // '?' - show keyboard shortcuts help
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      console.error('Error fetching todos:', todosResult.error);
      setError('Failed to connect to database. Please check your Supabase configuration.');
    } else {
      setTodos(todosResult.data || []);
      const registeredUsers = (usersResult.data || []).map((u: { name: string }) => u.name);
      const todoUsers = [...new Set((todosResult.data || []).map((t: Todo) => t.created_by).filter(Boolean))];
      setUsers([...new Set([...registeredUsers, ...todoUsers])]);
      // Store users with colors for chat
      setUsersWithColors((usersResult.data || []).map((u: { name: string; color: string }) => ({
        name: u.name,
        color: u.color || '#0033A0'
      })));
      setError(null);
    }
    setLoading(false);
  }, []);

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
            setTodos((prev) => {
              const exists = prev.some((t) => t.id === (payload.new as Todo).id);
              if (exists) return prev;
              return [payload.new as Todo, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setTodos((prev) =>
              prev.map((todo) =>
                todo.id === payload.new.id ? (payload.new as Todo) : todo
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setTodos((prev) => prev.filter((todo) => todo.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        if (isMounted) setConnected(status === 'SUBSCRIBED');
      });

    // Subscribe to activity_log for unread badge notifications
    const activityChannel = supabase
      .channel('activity-badge-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          if (!isMounted) return;
          const newActivity = payload.new as { user_name: string };
          // Only increment for activities from other users
          if (newActivity.user_name !== userName) {
            setUnreadActivityCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(activityChannel);
    };
  }, [fetchTodos, userName, currentUser]);

  const addTodo = async (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string, subtasks?: Subtask[]) => {
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
    };

    setTodos((prev) => [newTodo, ...prev]);

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

    const { error: insertError } = await supabase.from('todos').insert([insertData]);

    if (insertError) {
      console.error('Error adding todo:', insertError);
      setTodos((prev) => prev.filter((t) => t.id !== newTodo.id));
    } else {
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
        },
      });
    }
  };

  const duplicateTodo = async (todo: Todo) => {
    const newTodo: Todo = {
      ...todo,
      id: uuidv4(),
      text: `${todo.text} (copy)`,
      completed: false,
      status: 'todo',
      created_at: new Date().toISOString(),
      created_by: userName,
    };

    setTodos((prev) => [newTodo, ...prev]);

    const insertData: Record<string, unknown> = {
      id: newTodo.id,
      text: newTodo.text,
      completed: false,
      created_at: newTodo.created_at,
      created_by: newTodo.created_by,
    };

    if (newTodo.priority && newTodo.priority !== 'medium') insertData.priority = newTodo.priority;
    if (newTodo.due_date) insertData.due_date = newTodo.due_date;
    if (newTodo.assigned_to) insertData.assigned_to = newTodo.assigned_to;
    if (newTodo.notes) insertData.notes = newTodo.notes;
    if (newTodo.recurrence) insertData.recurrence = newTodo.recurrence;

    const { error: insertError } = await supabase.from('todos').insert([insertData]);

    if (insertError) {
      console.error('Error duplicating todo:', insertError);
      setTodos((prev) => prev.filter((t) => t.id !== newTodo.id));
    }
  };

  const updateStatus = async (id: string, status: TodoStatus) => {
    const oldTodo = todos.find((t) => t.id === id);
    const completed = status === 'done';

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, status, completed } : todo))
    );

    if (status === 'done' && oldTodo && !oldTodo.completed) {
      setCelebrationText(oldTodo.text);
      setShowCelebration(true);

      // Handle recurring tasks
      if (oldTodo.recurrence) {
        createNextRecurrence(oldTodo);
      }
    }

    const { error: updateError } = await supabase
      .from('todos')
      .update({ status, completed })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating status:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    } else if (oldTodo) {
      // Log activity
      if (status === 'done' && oldTodo.status !== 'done') {
        logActivity({
          action: 'task_completed',
          userName,
          todoId: id,
          todoText: oldTodo.text,
        });
      } else if (oldTodo.status === 'done' && status !== 'done') {
        logActivity({
          action: 'task_reopened',
          userName,
          todoId: id,
          todoText: oldTodo.text,
        });
      } else {
        logActivity({
          action: 'status_changed',
          userName,
          todoId: id,
          todoText: oldTodo.text,
          details: { from: oldTodo.status, to: status },
        });
      }
    }
  };

  const createNextRecurrence = async (completedTodo: Todo) => {
    if (!completedTodo.recurrence || !completedTodo.due_date) return;

    const currentDue = new Date(completedTodo.due_date);
    const nextDue = new Date(currentDue);

    switch (completedTodo.recurrence) {
      case 'daily':
        nextDue.setDate(nextDue.getDate() + 1);
        break;
      case 'weekly':
        nextDue.setDate(nextDue.getDate() + 7);
        break;
      case 'monthly':
        nextDue.setMonth(nextDue.getMonth() + 1);
        break;
    }

    const newTodo: Todo = {
      ...completedTodo,
      id: uuidv4(),
      completed: false,
      status: 'todo',
      due_date: nextDue.toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };

    setTodos((prev) => [newTodo, ...prev]);

    const insertData: Record<string, unknown> = {
      id: newTodo.id,
      text: newTodo.text,
      completed: false,
      status: 'todo',
      created_at: newTodo.created_at,
      created_by: newTodo.created_by,
      due_date: newTodo.due_date,
      recurrence: newTodo.recurrence,
    };

    if (newTodo.priority && newTodo.priority !== 'medium') insertData.priority = newTodo.priority;
    if (newTodo.assigned_to) insertData.assigned_to = newTodo.assigned_to;
    if (newTodo.notes) insertData.notes = newTodo.notes;

    await supabase.from('todos').insert([insertData]);
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const todoItem = todos.find(t => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, completed } : todo))
    );

    if (completed && todoItem) {
      setCelebrationText(todoItem.text);
      setShowCelebration(true);

      // Handle recurring tasks
      if (todoItem.recurrence) {
        createNextRecurrence(todoItem);
      }
    }

    const { error: updateError } = await supabase
      .from('todos')
      .update({ completed })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating todo:', updateError);
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, completed: !completed } : todo))
      );
    }
  };

  const deleteTodo = async (id: string) => {
    const todoToDelete = todos.find((t) => t.id === id);
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
    setSelectedTodos((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    const { error: deleteError } = await supabase.from('todos').delete().eq('id', id);

    if (deleteError) {
      console.error('Error deleting todo:', deleteError);
      if (todoToDelete) {
        setTodos((prev) => [...prev, todoToDelete]);
      }
    } else if (todoToDelete) {
      logActivity({
        action: 'task_deleted',
        userName,
        todoId: id,
        todoText: todoToDelete.text,
      });
    }
  };

  const confirmDeleteTodo = (id: string) => {
    const todo = todos.find(t => t.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Task',
      message: `Are you sure you want to delete "${todo?.text}"? This cannot be undone.`,
      onConfirm: () => {
        deleteTodo(id);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const assignTodo = async (id: string, assignedTo: string | null) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, assigned_to: assignedTo || undefined } : todo
      )
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ assigned_to: assignedTo })
      .eq('id', id);

    if (updateError) {
      console.error('Error assigning todo:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    } else if (oldTodo && oldTodo.assigned_to !== assignedTo) {
      logActivity({
        action: 'assigned_to_changed',
        userName,
        todoId: id,
        todoText: oldTodo.text,
        details: { from: oldTodo.assigned_to || null, to: assignedTo },
      });
    }
  };

  const setDueDate = async (id: string, dueDate: string | null) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, due_date: dueDate || undefined } : todo
      )
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ due_date: dueDate })
      .eq('id', id);

    if (updateError) {
      console.error('Error setting due date:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    } else if (oldTodo && oldTodo.due_date !== dueDate) {
      logActivity({
        action: 'due_date_changed',
        userName,
        todoId: id,
        todoText: oldTodo.text,
        details: { from: oldTodo.due_date || null, to: dueDate },
      });
    }
  };

  const setPriority = async (id: string, priority: TodoPriority) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, priority } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ priority })
      .eq('id', id);

    if (updateError) {
      console.error('Error setting priority:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    } else if (oldTodo && oldTodo.priority !== priority) {
      logActivity({
        action: 'priority_changed',
        userName,
        todoId: id,
        todoText: oldTodo.text,
        details: { from: oldTodo.priority, to: priority },
      });
    }
  };

  const updateNotes = async (id: string, notes: string) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, notes } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ notes })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating notes:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    } else if (oldTodo) {
      logActivity({
        action: 'notes_updated',
        userName,
        todoId: id,
        todoText: oldTodo.text,
      });
    }
  };

  const updateText = async (id: string, text: string) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, text } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ text })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating text:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    }
  };

  const setRecurrence = async (id: string, recurrence: RecurrencePattern) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, recurrence } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ recurrence })
      .eq('id', id);

    if (updateError) {
      console.error('Error setting recurrence:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    }
  };

  const updateSubtasks = async (id: string, subtasks: Subtask[]) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, subtasks } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ subtasks })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating subtasks:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    }
  };

  const updateAttachments = async (id: string, attachments: Attachment[], skipDbUpdate = false) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, attachments } : todo))
    );

    // Skip database update if the API already handled it (e.g., after delete or upload)
    if (!skipDbUpdate) {
      const { error: updateError } = await supabase
        .from('todos')
        .update({ attachments })
        .eq('id', id);

      if (updateError) {
        console.error('Error updating attachments:', updateError);
        if (oldTodo) {
          setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
        }
        return; // Don't log activity if update failed
      }
    }

    // Log activity for attachment changes
    if (oldTodo) {
      const oldCount = oldTodo.attachments?.length || 0;
      const newCount = attachments.length;
      if (newCount > oldCount) {
        logActivity({
          action: 'attachment_added',
          userName,
          todoId: id,
          todoText: oldTodo.text,
          details: { count: newCount - oldCount },
        });
      } else if (newCount < oldCount) {
        logActivity({
          action: 'attachment_removed',
          userName,
          todoId: id,
          todoText: oldTodo.text,
          details: { count: oldCount - newCount },
        });
      }
    }
  };

  // Save task as template
  const saveAsTemplate = async (name: string, isShared: boolean) => {
    if (!templateTodo) return;

    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: templateTodo.text,
        default_priority: templateTodo.priority || 'medium',
        default_assigned_to: templateTodo.assigned_to || null,
        subtasks: (templateTodo.subtasks || []).map(st => ({
          text: st.text,
          priority: st.priority,
          estimatedMinutes: st.estimatedMinutes,
        })),
        created_by: userName,
        is_shared: isShared,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save template');
    }
  };

  // Bulk actions with confirmation
  const bulkDelete = async () => {
    const count = selectedTodos.size;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Tasks',
      message: `Are you sure you want to delete ${count} task${count > 1 ? 's' : ''}? This cannot be undone.`,
      onConfirm: async () => {
        const idsToDelete = Array.from(selectedTodos);
        const todosToDelete = todos.filter(t => selectedTodos.has(t.id));

        setTodos((prev) => prev.filter((todo) => !selectedTodos.has(todo.id)));
        setSelectedTodos(new Set());
        setShowBulkActions(false);

        const { error } = await supabase
          .from('todos')
          .delete()
          .in('id', idsToDelete);

        if (error) {
          console.error('Error bulk deleting:', error);
          setTodos((prev) => [...prev, ...todosToDelete]);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const bulkAssign = async (assignedTo: string) => {
    const idsToUpdate = Array.from(selectedTodos);
    const originalTodos = todos.filter(t => selectedTodos.has(t.id));

    setTodos((prev) =>
      prev.map((todo) =>
        selectedTodos.has(todo.id) ? { ...todo, assigned_to: assignedTo } : todo
      )
    );
    setSelectedTodos(new Set());
    setShowBulkActions(false);

    const { error } = await supabase
      .from('todos')
      .update({ assigned_to: assignedTo })
      .in('id', idsToUpdate);

    if (error) {
      console.error('Error bulk assigning:', error);
      // Rollback on failure
      setTodos((prev) => {
        const rollbackMap = new Map(originalTodos.map(t => [t.id, t]));
        return prev.map((todo) => rollbackMap.get(todo.id) || todo);
      });
    }
  };

  const bulkComplete = async () => {
    const idsToUpdate = Array.from(selectedTodos);
    const originalTodos = todos.filter(t => selectedTodos.has(t.id));

    setTodos((prev) =>
      prev.map((todo) =>
        selectedTodos.has(todo.id) ? { ...todo, completed: true, status: 'done' as TodoStatus } : todo
      )
    );
    setSelectedTodos(new Set());
    setShowBulkActions(false);

    const { error } = await supabase
      .from('todos')
      .update({ completed: true, status: 'done' })
      .in('id', idsToUpdate);

    if (error) {
      console.error('Error bulk completing:', error);
      // Rollback on failure
      setTodos((prev) => {
        const rollbackMap = new Map(originalTodos.map(t => [t.id, t]));
        return prev.map((todo) => rollbackMap.get(todo.id) || todo);
      });
    }
  };

  const handleSelectTodo = (id: string, selected: boolean) => {
    setSelectedTodos((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTodos(new Set(filteredAndSortedTodos.map(t => t.id)));
  };

  const clearSelection = () => {
    setSelectedTodos(new Set());
  };

  // All users can now see all tasks
  const visibleTodos = useMemo(() => {
    return todos;
  }, [todos]);

  // Filter and sort todos
  const filteredAndSortedTodos = useMemo(() => {
    let result = [...visibleTodos];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (todo) =>
          todo.text.toLowerCase().includes(query) ||
          todo.created_by.toLowerCase().includes(query) ||
          (todo.assigned_to && todo.assigned_to.toLowerCase().includes(query)) ||
          (todo.notes && todo.notes.toLowerCase().includes(query))
      );
    }

    // Apply quick filter
    switch (quickFilter) {
      case 'my_tasks':
        result = result.filter((todo) => todo.assigned_to === userName || todo.created_by === userName);
        break;
      case 'due_today':
        result = result.filter((todo) => isDueToday(todo.due_date) && !todo.completed);
        break;
      case 'overdue':
        result = result.filter((todo) => isOverdue(todo.due_date, todo.completed));
        break;
      case 'urgent':
        result = result.filter((todo) => todo.priority === 'urgent' && !todo.completed);
        break;
    }

    // Apply completed filter
    if (!showCompleted) {
      result = result.filter((todo) => !todo.completed);
    }

    // Apply sort
    switch (sortOption) {
      case 'due_date':
        result.sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });
        break;
      case 'priority':
        result.sort((a, b) => priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium']);
        break;
      case 'alphabetical':
        result.sort((a, b) => a.text.localeCompare(b.text));
        break;
      case 'custom':
        // Sort by custom order if available
        if (customOrder.length > 0) {
          result.sort((a, b) => {
            const aIndex = customOrder.indexOf(a.id);
            const bIndex = customOrder.indexOf(b.id);
            // Items not in custom order go to the end
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          });
        }
        break;
      case 'created':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return result;
  }, [visibleTodos, searchQuery, quickFilter, showCompleted, sortOption, userName, customOrder]);

  // Stats should be based on visible todos only
  const stats = {
    total: visibleTodos.length,
    completed: visibleTodos.filter((t) => t.completed).length,
    active: visibleTodos.filter((t) => !t.completed).length,
    dueToday: visibleTodos.filter((t) => isDueToday(t.due_date) && !t.completed).length,
    overdue: visibleTodos.filter((t) => isOverdue(t.due_date, t.completed)).length,
  };

  // Handle drag end for manual reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = filteredAndSortedTodos.findIndex((t) => t.id === active.id);
      const newIndex = filteredAndSortedTodos.findIndex((t) => t.id === over.id);

      const newOrder = arrayMove(
        filteredAndSortedTodos.map((t) => t.id),
        oldIndex,
        newIndex
      );

      setCustomOrder(newOrder);
      // Auto-switch to custom sort when reordering
      if (sortOption !== 'custom') {
        setSortOption('custom');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] relative overflow-hidden">
        {/* Ambient gradient orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/3 w-[500px] h-[500px] bg-[var(--accent-gold)]/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-[var(--accent)]/10 rounded-full blur-[100px]" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent-gold)] to-[#E5B936] flex items-center justify-center shadow-lg" style={{ boxShadow: '0 8px 24px rgba(201, 162, 39, 0.3)' }}>
              <svg className="w-7 h-7 text-[#0A1628]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
            </div>
            <div className="absolute -inset-3 bg-[var(--accent-gold)]/20 rounded-3xl blur-xl animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-gold)] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-[var(--accent-gold)] animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-[var(--accent-gold)] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--background)]">
        <div className="p-8 rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] border border-[var(--border)] bg-[var(--surface)] max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[var(--danger-light)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-[var(--danger)]" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-[var(--foreground)]">Setup Required</h2>
          <p className="text-sm mb-4 text-[var(--text-muted)]">{error}</p>
          <p className="text-xs text-[var(--text-light)]">See SETUP.md for instructions</p>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={fetchTodos} darkMode={darkMode}>
      <div className="min-h-screen transition-colors bg-[var(--background)]">
        {/* Skip link for accessibility */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:z-50">
          Skip to main content
        </a>

        {/* Header - Refined Industrial */}
        <header className="sticky top-0 z-40 bg-[var(--gradient-hero)] shadow-[var(--shadow-lg)] border-b border-white/5">
        <div className={`mx-auto px-4 sm:px-6 py-4 ${viewMode === 'kanban' ? 'max-w-6xl' : 'max-w-2xl'}`}>
          <div className="flex items-center justify-between gap-3">
            {/* Logo & Context Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-gold)] to-[#E5B936] flex items-center justify-center flex-shrink-0 shadow-lg" style={{ boxShadow: '0 4px 12px rgba(201, 162, 39, 0.35)' }}>
                <span className="text-[#0A1628] font-bold text-base">B</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-white truncate tracking-tight">Bealer Agency</h1>
                {/* Show contextual info instead of "Welcome back" */}
                <p className="text-xs text-white/60 truncate">
                  {stats.active} active{stats.dueToday > 0 && ` • ${stats.dueToday} due today`}{stats.overdue > 0 && ` • ${stats.overdue} overdue`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* View toggle with labels */}
              <div className="flex bg-white/8 backdrop-blur-sm rounded-xl p-1 border border-white/10">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    viewMode === 'list'
                      ? 'bg-[var(--accent-gold)] text-[#0A1628] shadow-md'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                  aria-pressed={viewMode === 'list'}
                  aria-label="List view"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    viewMode === 'kanban'
                      ? 'bg-[var(--accent-gold)] text-[#0A1628] shadow-md'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                  aria-pressed={viewMode === 'kanban'}
                  aria-label="Board view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Board</span>
                </button>
              </div>

              {/* Activity Feed - accessible to all users */}
              <button
                onClick={() => {
                  setShowActivityFeed(true);
                  setUnreadActivityCount(0);
                }}
                className="relative p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
                aria-label="View activity feed"
              >
                <Activity className="w-4 h-4" />
                {unreadActivityCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-lg animate-pulse">
                    {unreadActivityCount > 99 ? '99+' : unreadActivityCount}
                  </span>
                )}
              </button>

              {/* Strategic Dashboard - Owner only */}
              {userName === OWNER_USERNAME && (
                <button
                  onClick={() => setShowStrategicDashboard(true)}
                  className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
                  aria-label="Strategic Goals Dashboard"
                  title="Strategic Goals"
                >
                  <Target className="w-4 h-4" />
                </button>
              )}

              {/* Weekly progress chart */}
              <button
                onClick={() => setShowWeeklyChart(true)}
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
                aria-label="View weekly progress"
              >
                <BarChart2 className="w-4 h-4" />
              </button>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
                aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <UserSwitcher currentUser={currentUser} onUserChange={onUserChange} />
            </div>
          </div>
        </div>
      </header>

      {/* Connection status - floating indicator */}
      <div className="fixed bottom-4 right-4 z-30">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-[var(--shadow-md)] backdrop-blur-sm ${
          connected
            ? 'bg-[var(--success-light)] text-[var(--success)] border border-[var(--success)]/20'
            : 'bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/20'
        }`}>
          {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>

      {/* Main */}
      <main id="main-content" className={`mx-auto px-4 sm:px-6 py-6 ${viewMode === 'kanban' ? 'max-w-6xl' : 'max-w-2xl'}`}>
        {/* Actionable Stats Cards - Premium Design */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            type="button"
            onClick={() => { setQuickFilter('all'); setShowCompleted(false); }}
            className={`group relative rounded-[var(--radius-lg)] p-4 border text-left transition-all duration-300 hover:shadow-[var(--shadow-md)] overflow-hidden ${
              quickFilter === 'all' && !showCompleted
                ? 'ring-2 ring-[var(--accent)] border-[var(--accent)] bg-[var(--accent-light)]'
                : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-hover)]'
            }`}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-[var(--accent)]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <p className="text-2xl sm:text-3xl font-bold text-[var(--accent)] relative">{stats.active}</p>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium mt-0.5 relative">To Do</p>
          </button>
          <button
            type="button"
            onClick={() => setQuickFilter('due_today')}
            className={`group relative rounded-[var(--radius-lg)] p-4 border text-left transition-all duration-300 hover:shadow-[var(--shadow-md)] overflow-hidden ${
              quickFilter === 'due_today'
                ? 'ring-2 ring-[var(--warning)] border-[var(--warning)] bg-[var(--warning-light)]'
                : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-hover)]'
            }`}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-[var(--warning)]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <p className="text-2xl sm:text-3xl font-bold text-[var(--warning)] relative">{stats.dueToday}</p>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium mt-0.5 relative">Due Today</p>
          </button>
          <button
            type="button"
            onClick={() => setQuickFilter('overdue')}
            className={`group relative rounded-[var(--radius-lg)] p-4 border text-left transition-all duration-300 hover:shadow-[var(--shadow-md)] overflow-hidden ${
              quickFilter === 'overdue'
                ? 'ring-2 ring-[var(--danger)] border-[var(--danger)] bg-[var(--danger-light)]'
                : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-hover)]'
            }`}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-[var(--danger)]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <p className="text-2xl sm:text-3xl font-bold text-[var(--danger)] relative">{stats.overdue}</p>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium mt-0.5 relative">Overdue</p>
          </button>
        </div>

        {/* Add todo with template picker */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <TemplatePicker
              currentUserName={userName}
              users={users}
              darkMode={darkMode}
              onSelectTemplate={(text, priority, assignedTo, subtasks) => {
                addTodo(text, priority, undefined, assignedTo, subtasks);
              }}
            />
          </div>
          <AddTodo onAdd={addTodo} users={users} darkMode={darkMode} currentUserId={currentUser.id} />
        </div>

        {/* Unified Filter Bar - Premium */}
        <div className="rounded-[var(--radius-xl)] p-4 mb-4 bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)]">
          {/* Search Row */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-light)]" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
                className="input-refined w-full pl-10 pr-4 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--text-light)]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                aria-label="Sort tasks"
                className="input-refined appearance-none pl-3 pr-9 py-2.5 text-sm text-[var(--foreground)] cursor-pointer"
              >
                <option value="created">Newest</option>
                <option value="due_date">Due Date</option>
                <option value="priority">Priority</option>
                <option value="alphabetical">A-Z</option>
                <option value="custom">Manual</option>
              </select>
              <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--text-muted)]" />
            </div>
          </div>

          {/* Filter Chips - Single Row */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all' as QuickFilter, label: 'All', icon: LayoutList },
              { id: 'my_tasks' as QuickFilter, label: 'My Tasks', icon: User },
              { id: 'urgent' as QuickFilter, label: 'Urgent', icon: AlertTriangle },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setQuickFilter(f.id);
                  if (f.id === 'all') {
                    setShowCompleted(false);
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-[var(--radius-md)] transition-all duration-200 ${
                  quickFilter === f.id
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]'
                }`}
                aria-pressed={quickFilter === f.id}
              >
                <f.icon className="w-3.5 h-3.5" />
                {f.label}
              </button>
            ))}

            <div className="w-px h-5 bg-[var(--border)] mx-1" />

            {/* Show completed toggle */}
            <button
              type="button"
              onClick={() => setShowCompleted(!showCompleted)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-[var(--radius-md)] transition-all duration-200 ${
                showCompleted
                  ? 'bg-[var(--success)] text-white shadow-sm'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]'
              }`}
              aria-pressed={showCompleted}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Done ({stats.completed})
            </button>

            {/* Active filter indicator */}
            {quickFilter !== 'all' && (
              <button
                type="button"
                onClick={() => { setQuickFilter('all'); setShowCompleted(false); }}
                className="text-xs text-[var(--accent)] hover:underline ml-auto font-medium"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* Bulk Actions - Always visible checkbox in list view */}
        {viewMode === 'list' && (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                if (showBulkActions) {
                  clearSelection();
                }
                setShowBulkActions(!showBulkActions);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-[var(--radius-md)] transition-all duration-200 ${
                showBulkActions
                  ? 'bg-[var(--accent-gold)] text-[#0A1628] shadow-sm'
                  : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] border border-[var(--border)]'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {showBulkActions ? 'Cancel' : 'Select'}
            </button>

            {/* Bulk actions bar */}
            {showBulkActions && selectedTodos.size > 0 && (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {selectedTodos.size} selected
                </span>
                <button
                  onClick={selectAll}
                  className="px-2.5 py-1 text-xs rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-colors"
                >
                  All
                </button>
                <button
                  onClick={clearSelection}
                  className="px-2.5 py-1 text-xs rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-colors"
                >
                  Clear
                </button>
                <div className="flex-1" />
                <button
                  onClick={bulkComplete}
                  className="px-3.5 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--success)] text-white hover:opacity-90 flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Complete</span>
                </button>
                <div className="relative">
                  <select
                    onChange={(e) => { if (e.target.value) bulkAssign(e.target.value); e.target.value = ''; }}
                    className="input-refined appearance-none px-3 py-2 pr-8 text-sm cursor-pointer"
                    aria-label="Assign to"
                  >
                    <option value="">Assign...</option>
                    {users.map((user) => (
                      <option key={user} value={user}>{user}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--text-muted)]" />
                </div>
                <button
                  onClick={bulkDelete}
                  className="px-3.5 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--danger)] text-white hover:opacity-90 flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* List or Kanban */}
        {viewMode === 'list' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredAndSortedTodos.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2" role="list" aria-label="Task list">
                {filteredAndSortedTodos.length === 0 ? (
                  <EmptyState
                    variant={
                      searchQuery
                        ? 'no-results'
                        : quickFilter === 'due_today'
                          ? 'no-due-today'
                          : quickFilter === 'overdue'
                            ? 'no-overdue'
                            : stats.total === 0
                              ? 'no-tasks'
                              : stats.completed === stats.total && stats.total > 0
                                ? 'all-done'
                                : 'no-tasks'
                    }
                    darkMode={darkMode}
                    searchQuery={searchQuery}
                    onAddTask={() => {
                      const input = document.querySelector('textarea[placeholder*="task"]') as HTMLTextAreaElement;
                      if (input) input.focus();
                    }}
                    onClearSearch={() => setSearchQuery('')}
                    userName={userName}
                  />
                ) : (
                  filteredAndSortedTodos.map((todo) => (
                    <SortableTodoItem
                      key={todo.id}
                      todo={todo}
                      users={users}
                      currentUserName={userName}
                      darkMode={darkMode}
                      selected={selectedTodos.has(todo.id)}
                      onSelect={showBulkActions ? handleSelectTodo : undefined}
                      onToggle={toggleTodo}
                      onDelete={confirmDeleteTodo}
                      onAssign={assignTodo}
                      onSetDueDate={setDueDate}
                      onSetPriority={setPriority}
                      onDuplicate={duplicateTodo}
                      onUpdateNotes={updateNotes}
                      onSetRecurrence={setRecurrence}
                      onUpdateSubtasks={updateSubtasks}
                      onUpdateAttachments={updateAttachments}
                      onSaveAsTemplate={(t) => setTemplateTodo(t)}
                      isDragEnabled={!showBulkActions && sortOption === 'custom'}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <KanbanBoard
            todos={visibleTodos}
            users={users}
            darkMode={darkMode}
            onStatusChange={updateStatus}
            onDelete={confirmDeleteTodo}
            onAssign={assignTodo}
            onSetDueDate={setDueDate}
            onSetPriority={setPriority}
            onUpdateNotes={updateNotes}
            onUpdateText={updateText}
            onUpdateSubtasks={updateSubtasks}
          />
        )}

        {/* Keyboard shortcuts hint */}
        <button
          onClick={() => setShowShortcuts(true)}
          className={`mt-8 w-full text-center text-xs py-2 rounded-lg transition-colors ${
            darkMode
              ? 'text-slate-500 hover:text-slate-400 hover:bg-slate-800'
              : 'text-slate-400 hover:text-slate-500 hover:bg-slate-100'
          }`}
        >
          <span className="hidden sm:inline">
            <kbd className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>N</kbd> new
            <span className="mx-2">|</span>
            <kbd className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>/</kbd> search
            <span className="mx-2">|</span>
            <kbd className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>?</kbd> all shortcuts
          </span>
          <span className="sm:hidden">Tap for keyboard shortcuts</span>
        </button>
      </main>

      <CelebrationEffect
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
        taskText={celebrationText}
      />

      <ProgressSummary
        show={showProgressSummary}
        onClose={() => setShowProgressSummary(false)}
        todos={todos}
        currentUser={currentUser}
        onUserUpdate={onUserChange}
      />

      <WelcomeBackNotification
        show={showWelcomeBack}
        onClose={() => setShowWelcomeBack(false)}
        onViewProgress={() => setShowProgressSummary(true)}
        todos={todos}
        currentUser={currentUser}
        onUserUpdate={onUserChange}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Delete"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      <WeeklyProgressChart
        todos={visibleTodos}
        darkMode={darkMode}
        show={showWeeklyChart}
        onClose={() => setShowWeeklyChart(false)}
      />

      <KeyboardShortcutsModal
        show={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        darkMode={darkMode}
      />

      {/* Activity Feed Slide-over */}
      {showActivityFeed && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Activity Feed">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowActivityFeed(false)}
          />
          <div className={`relative ml-auto w-full max-w-md h-full shadow-xl ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <ActivityFeed
              currentUserName={userName}
              darkMode={darkMode}
              onClose={() => setShowActivityFeed(false)}
            />
          </div>
        </div>
      )}

      {/* Strategic Dashboard - Owner only */}
      {showStrategicDashboard && userName === OWNER_USERNAME && (
        <StrategicDashboard
          userName={userName}
          darkMode={darkMode}
          onClose={() => setShowStrategicDashboard(false)}
        />
      )}

      {/* Save Template Modal */}
      {templateTodo && (
        <SaveTemplateModal
          todo={templateTodo}
          currentUserName={userName}
          darkMode={darkMode}
          onClose={() => setTemplateTodo(null)}
          onSave={saveAsTemplate}
        />
      )}

      <ChatPanel currentUser={currentUser} users={usersWithColors} />
      </div>
    </PullToRefresh>
  );
}
