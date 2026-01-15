'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { Todo, TodoStatus, TodoPriority, ViewMode, SortOption, QuickFilter, RecurrencePattern, Subtask, Attachment, OWNER_USERNAME } from '@/types/todo';
import TodoItem from './TodoItem';
import SortableTodoItem from './SortableTodoItem';
import AddTodo from './AddTodo';
import KanbanBoard from './KanbanBoard';
import { logger } from '@/lib/logger';
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
  Trash2, X, Sun, Moon, ChevronDown, BarChart2, Activity, Target, GitMerge,
  Paperclip, Filter, RotateCcw, Mail, Check, Clock, Zap, ChevronLeft, Home, Archive
} from 'lucide-react';
import { AuthUser } from '@/types/todo';
import UserSwitcher from './UserSwitcher';
import ChatPanel from './ChatPanel';
import TemplatePicker from './TemplatePicker';
import ActivityFeed from './ActivityFeed';
import StrategicDashboard from './StrategicDashboard';
import SaveTemplateModal from './SaveTemplateModal';
import ArchivedTaskModal from './ArchivedTaskModal';
import { useTheme } from '@/contexts/ThemeContext';
import { logActivity } from '@/lib/activityLogger';
import { findPotentialDuplicates, shouldCheckForDuplicates, DuplicateMatch, extractPotentialNames } from '@/lib/duplicateDetection';
import { sendTaskAssignmentNotification, sendTaskCompletionNotification } from '@/lib/taskNotifications';
import { getNextSuggestedTasks, calculateCompletionStreak, getEncouragementMessage } from '@/lib/taskSuggestions';
import DuplicateDetectionModal from './DuplicateDetectionModal';
import CustomerEmailModal from './CustomerEmailModal';
import { CompletionCelebration } from './CompletionCelebration';
import { TaskCompletionSummary } from './TaskCompletionSummary';
import { CelebrationData, ActivityLogEntry } from '@/types/todo';

interface TodoListProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
  onOpenDashboard?: () => void;
  initialFilter?: QuickFilter | null;
  autoFocusAddTask?: boolean;
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

export default function TodoList({ currentUser, onUserChange, onOpenDashboard, initialFilter, autoFocusAddTask }: TodoListProps) {
  const userName = currentUser.name;
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';
  const canViewArchive = currentUser.role === 'admin' || ['derrick', 'adrian'].includes(userName.toLowerCase());

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [users, setUsers] = useState<string[]>([]);
  const [usersWithColors, setUsersWithColors] = useState<{ name: string; color: string }[]>([]);

  // Search, sort, and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('urgency');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(initialFilter || 'all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [highPriorityOnly, setHighPriorityOnly] = useState(false);

  // Advanced filter state
  const [statusFilter, setStatusFilter] = useState<TodoStatus | 'all'>('all');
  const [assignedToFilter, setAssignedToFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [hasAttachmentsFilter, setHasAttachmentsFilter] = useState<boolean | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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
  const [showStrategicDashboard, setShowStrategicDashboard] = useState(false);
  const [templateTodo, setTemplateTodo] = useState<Todo | null>(null);
  const [showArchiveView, setShowArchiveView] = useState(false);
  const [selectedArchivedTodo, setSelectedArchivedTodo] = useState<Todo | null>(null);
  const [archiveQuery, setArchiveQuery] = useState('');
  const [archiveTick, setArchiveTick] = useState(0);
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTargets, setMergeTargets] = useState<Todo[]>([]);
  const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  // Duplicate detection state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [pendingTask, setPendingTask] = useState<{
    text: string;
    priority: TodoPriority;
    dueDate?: string;
    assignedTo?: string;
    subtasks?: Subtask[];
    transcription?: string;
    sourceFile?: File;
  } | null>(null);

  // Customer email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTargetTodos, setEmailTargetTodos] = useState<Todo[]>([]);

  // Enhanced celebration state (Features 1 & 3)
  const [showEnhancedCelebration, setShowEnhancedCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null);
  const [showCompletionSummary, setShowCompletionSummary] = useState(false);
  const [completedTaskForSummary, setCompletedTaskForSummary] = useState<Todo | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

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
      if (e.key === '4') { e.preventDefault(); setQuickFilter('overdue'); }

      // '?' - show keyboard shortcuts help
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setArchiveTick((tick) => tick + 1);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTodos = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Please check your environment variables.');
      setLoading(false);
      return;
    }

    const [todosResult, usersResult, activityResult] = await Promise.all([
      supabase.from('todos').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('name, color').order('name'),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    if (todosResult.error) {
      logger.error('Error fetching todos', todosResult.error, { component: 'TodoList' });
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
      // Store activity log for streak calculation
      if (activityResult.data) {
        setActivityLog(activityResult.data as ActivityLogEntry[]);
      }
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

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [fetchTodos, userName, currentUser]);

  // Check for duplicates and either show modal or create task directly
  const addTodo = (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string, subtasks?: Subtask[], transcription?: string, sourceFile?: File) => {
    // Check if we should look for duplicates
    const combinedText = `${text} ${transcription || ''}`;
    if (shouldCheckForDuplicates(combinedText)) {
      const duplicates = findPotentialDuplicates(combinedText, todos);
      if (duplicates.length > 0) {
        // Store pending task and show modal
        setPendingTask({ text, priority, dueDate, assignedTo, subtasks, transcription, sourceFile });
        setDuplicateMatches(duplicates);
        setShowDuplicateModal(true);
        return;
      }
    }
    // No duplicates found, create directly
    createTodoDirectly(text, priority, dueDate, assignedTo, subtasks, transcription, sourceFile);
  };

  // Actually create the todo (called after duplicate check or when user confirms)
  const createTodoDirectly = async (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string, subtasks?: Subtask[], transcription?: string, sourceFile?: File) => {
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
    if (newTodo.transcription) insertData.transcription = newTodo.transcription;

    const { error: insertError } = await supabase.from('todos').insert([insertData]);

    if (insertError) {
      logger.error('Error adding todo', insertError, { component: 'TodoList' });
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
          has_transcription: !!transcription,
        },
      });

      // Send chat notification if task is assigned to someone else (Feature 2)
      if (newTodo.assigned_to && newTodo.assigned_to !== userName) {
        sendTaskAssignmentNotification({
          taskId: newTodo.id,
          taskText: newTodo.text,
          assignedTo: newTodo.assigned_to,
          assignedBy: userName,
          dueDate: newTodo.due_date,
          priority: newTodo.priority,
        });
      }

      // Auto-attach source file if provided
      if (sourceFile) {
        try {
          const formData = new FormData();
          formData.append('file', sourceFile);
          formData.append('todoId', newTodo.id);
          formData.append('userName', userName);

          const response = await fetch('/api/attachments', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const { attachment } = await response.json();
            // Update local state with the attachment
            setTodos((prev) =>
              prev.map((t) =>
                t.id === newTodo.id
                  ? { ...t, attachments: [...(t.attachments || []), attachment] }
                  : t
              )
            );
            // Log attachment activity
            logActivity({
              action: 'attachment_added',
              userName,
              todoId: newTodo.id,
              todoText: newTodo.text,
              details: {
                file_name: sourceFile.name,
                file_type: attachment.file_type,
                auto_attached: true,
              },
            });
          } else {
            logger.error('Failed to auto-attach source file', null, { component: 'TodoList' });
          }
        } catch (err) {
          logger.error('Error auto-attaching source file', err, { component: 'TodoList' });
        }
      }
    }
  };

  // Handle creating task anyway (user chose to ignore duplicates)
  const handleCreateTaskAnyway = () => {
    if (pendingTask) {
      createTodoDirectly(
        pendingTask.text,
        pendingTask.priority,
        pendingTask.dueDate,
        pendingTask.assignedTo,
        pendingTask.subtasks,
        pendingTask.transcription,
        pendingTask.sourceFile
      );
    }
    setShowDuplicateModal(false);
    setPendingTask(null);
    setDuplicateMatches([]);
  };

  // Handle adding to existing task (merge with existing)
  const handleAddToExistingTask = async (existingTodoId: string) => {
    if (!pendingTask) return;

    const existingTodo = todos.find(t => t.id === existingTodoId);
    if (!existingTodo) return;

    // Combine notes with new content
    const combinedNotes = [
      existingTodo.notes,
      `\n--- Added Content (${new Date().toLocaleString()}) ---`,
      pendingTask.text !== existingTodo.text ? pendingTask.text : null,
      pendingTask.transcription ? `\nTranscription:\n${pendingTask.transcription}` : null,
    ].filter(Boolean).join('\n');

    // Combine subtasks
    const combinedSubtasks = [
      ...(existingTodo.subtasks || []),
      ...(pendingTask.subtasks || []),
    ];

    // Keep higher priority
    const priorityRank: Record<TodoPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const higherPriority = priorityRank[pendingTask.priority] < priorityRank[existingTodo.priority || 'medium']
      ? pendingTask.priority
      : existingTodo.priority;

    // Keep earlier due date if both exist
    let finalDueDate = existingTodo.due_date;
    if (pendingTask.dueDate) {
      if (!existingTodo.due_date || new Date(pendingTask.dueDate) < new Date(existingTodo.due_date)) {
        finalDueDate = pendingTask.dueDate;
      }
    }

    // Optimistically update UI
    setTodos(prev => prev.map(t => t.id === existingTodoId ? {
      ...t,
      notes: combinedNotes,
      subtasks: combinedSubtasks,
      priority: higherPriority,
      due_date: finalDueDate,
    } : t));

    // Update in database
    const { error: updateError } = await supabase
      .from('todos')
      .update({
        notes: combinedNotes,
        subtasks: combinedSubtasks,
        priority: higherPriority,
        due_date: finalDueDate,
      })
      .eq('id', existingTodoId);

    if (updateError) {
      logger.error('Error updating existing todo', updateError, { component: 'TodoList' });
      fetchTodos(); // Refresh on error
    } else {
      // Upload source file if present
      if (pendingTask.sourceFile) {
        try {
          const formData = new FormData();
          formData.append('file', pendingTask.sourceFile);
          formData.append('todoId', existingTodoId);
          formData.append('userName', userName);

          const response = await fetch('/api/attachments', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const { attachment } = await response.json();
            setTodos(prev => prev.map(t => t.id === existingTodoId
              ? { ...t, attachments: [...(t.attachments || []), attachment] }
              : t
            ));
          }
        } catch (err) {
          logger.error('Error attaching file to existing task', err, { component: 'TodoList' });
        }
      }

      // Log activity
      logActivity({
        action: 'task_updated',
        userName,
        todoId: existingTodoId,
        todoText: existingTodo.text,
        details: {
          merged_content: true,
          added_subtasks: (pendingTask.subtasks?.length || 0),
          has_transcription: !!pendingTask.transcription,
        },
      });
    }

    setShowDuplicateModal(false);
    setPendingTask(null);
    setDuplicateMatches([]);
  };

  // Cancel duplicate detection
  const handleCancelDuplicateDetection = () => {
    setShowDuplicateModal(false);
    setPendingTask(null);
    setDuplicateMatches([]);
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
      logger.error('Error duplicating todo', insertError, { component: 'TodoList' });
      setTodos((prev) => prev.filter((t) => t.id !== newTodo.id));
    }
  };

  const updateStatus = async (id: string, status: TodoStatus) => {
    const oldTodo = todos.find((t) => t.id === id);
    const completed = status === 'done';
    const updated_at = new Date().toISOString();

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, status, completed, updated_at } : todo))
    );

    if (status === 'done' && oldTodo && !oldTodo.completed) {
      // Calculate streak and get next tasks for enhanced celebration
      const streakCount = calculateCompletionStreak(activityLog, userName) + 1;
      const nextTasks = getNextSuggestedTasks(todos, userName, id);
      const encouragementMessage = getEncouragementMessage(streakCount);

      const updatedTodo = { ...oldTodo, completed: true, status: 'done' as TodoStatus, updated_at };
      setCelebrationData({
        completedTask: updatedTodo,
        nextTasks,
        streakCount,
        encouragementMessage,
      });
      setShowEnhancedCelebration(true);

      // Also keep original celebration for confetti
      setCelebrationText(oldTodo.text);
      setShowCelebration(true);

      // Handle recurring tasks
      if (oldTodo.recurrence) {
        createNextRecurrence(oldTodo);
      }

      // Send notification if task was assigned by someone else
      if (oldTodo.created_by && oldTodo.created_by !== userName) {
        sendTaskCompletionNotification({
          taskId: id,
          taskText: oldTodo.text,
          completedBy: userName,
          assignedBy: oldTodo.created_by,
        });
      }
    }

    const { error: updateError } = await supabase
      .from('todos')
      .update({ status, completed, updated_at })
      .eq('id', id);

    if (updateError) {
      logger.error('Error updating status', updateError, { component: 'TodoList' });
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
    const updated_at = new Date().toISOString();
    // When completing a task, also set status to 'done'; when uncompleting, set to 'todo'
    const newStatus: TodoStatus = completed ? 'done' : 'todo';

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, completed, status: newStatus, updated_at } : todo))
    );

    if (completed && todoItem) {
      // Calculate streak and get next tasks for enhanced celebration
      const streakCount = calculateCompletionStreak(activityLog, userName) + 1;
      const nextTasks = getNextSuggestedTasks(todos, userName, id);
      const encouragementMessage = getEncouragementMessage(streakCount);

      const updatedTodo = { ...todoItem, completed: true, updated_at };
      setCelebrationData({
        completedTask: updatedTodo,
        nextTasks,
        streakCount,
        encouragementMessage,
      });
      setShowEnhancedCelebration(true);

      // Also keep original celebration for confetti
      setCelebrationText(todoItem.text);
      setShowCelebration(true);

      // Handle recurring tasks
      if (todoItem.recurrence) {
        createNextRecurrence(todoItem);
      }

      // Send notification if task was assigned by someone else
      if (todoItem.created_by && todoItem.created_by !== userName) {
        sendTaskCompletionNotification({
          taskId: id,
          taskText: todoItem.text,
          completedBy: userName,
          assignedBy: todoItem.created_by,
        });
      }
    }

    const { error: updateError } = await supabase
      .from('todos')
      .update({ completed, status: newStatus, updated_at })
      .eq('id', id);

    if (updateError) {
      logger.error('Error updating todo', updateError, { component: 'TodoList' });
      // Revert both completed and status on error
      const revertStatus: TodoStatus = completed ? (todoItem?.status || 'todo') : 'done';
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, completed: !completed, status: revertStatus } : todo))
      );
    } else if (completed && todoItem) {
      // Log activity for streak tracking
      logActivity({
        action: 'task_completed',
        userName,
        todoId: id,
        todoText: todoItem.text,
      });
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
      logger.error('Error deleting todo', deleteError, { component: 'TodoList' });
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
      logger.error('Error assigning todo', updateError, { component: 'TodoList' });
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
      logger.error('Error setting due date', updateError, { component: 'TodoList' });
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
      logger.error('Error setting priority', updateError, { component: 'TodoList' });
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
      logger.error('Error updating notes', updateError, { component: 'TodoList' });
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
      logger.error('Error updating text', updateError, { component: 'TodoList' });
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
      logger.error('Error setting recurrence', updateError, { component: 'TodoList' });
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
      logger.error('Error updating subtasks', updateError, { component: 'TodoList' });
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
        logger.error('Error updating attachments', updateError, { component: 'TodoList' });
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
          logger.error('Error bulk deleting', error, { component: 'TodoList' });
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
      logger.error('Error bulk assigning', error, { component: 'TodoList' });
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
      logger.error('Error bulk completing', error, { component: 'TodoList' });
      // Rollback on failure
      setTodos((prev) => {
        const rollbackMap = new Map(originalTodos.map(t => [t.id, t]));
        return prev.map((todo) => rollbackMap.get(todo.id) || todo);
      });
    }
  };

  // Bulk reschedule - set new due date for selected tasks
  const bulkReschedule = async (newDueDate: string) => {
    const idsToUpdate = Array.from(selectedTodos);
    const originalTodos = todos.filter(t => selectedTodos.has(t.id));

    // Optimistic update
    setTodos((prev) =>
      prev.map((todo) =>
        selectedTodos.has(todo.id) ? { ...todo, due_date: newDueDate } : todo
      )
    );
    setSelectedTodos(new Set());
    setShowBulkActions(false);

    const { error } = await supabase
      .from('todos')
      .update({ due_date: newDueDate })
      .in('id', idsToUpdate);

    if (error) {
      logger.error('Error bulk rescheduling', error, { component: 'TodoList' });
      // Rollback on failure
      setTodos((prev) => {
        const rollbackMap = new Map(originalTodos.map(t => [t.id, t]));
        return prev.map((todo) => rollbackMap.get(todo.id) || todo);
      });
    }
  };

  // Helper to get date offset
  const getDateOffset = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  // Merge selected todos into one
  const initiateMerge = () => {
    if (selectedTodos.size < 2) return;
    const todosToMerge = todos.filter(t => selectedTodos.has(t.id));
    setMergeTargets(todosToMerge);
    setShowMergeModal(true);
  };

  const mergeTodos = async (primaryTodoId: string) => {
    if (mergeTargets.length < 2 || isMerging) return;

    const primaryTodo = mergeTargets.find(t => t.id === primaryTodoId);
    const secondaryTodos = mergeTargets.filter(t => t.id !== primaryTodoId);

    if (!primaryTodo) return;

    setIsMerging(true);

    try {
      // Combine data from all todos
      const combinedNotes = [
        primaryTodo.notes,
        ...secondaryTodos.map(t => t.notes),
        // Add merge history
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

      // Combine text (primary text + secondary texts as context)
      const combinedText = secondaryTodos.length > 0
        ? `${primaryTodo.text} [+${secondaryTodos.length} merged]`
        : primaryTodo.text;

      // Keep highest priority
      const priorityRank: Record<TodoPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const highestPriority = [primaryTodo, ...secondaryTodos]
        .reduce((highest, t) => {
          return priorityRank[t.priority || 'medium'] < priorityRank[highest] ? (t.priority || 'medium') : highest;
        }, primaryTodo.priority || 'medium');

      // Update primary todo in database first
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
        logger.error('Error updating merged todo', updateError, { component: 'TodoList' });
        alert('Failed to merge tasks. Please try again.');
        setIsMerging(false);
        return;
      }

      // Delete secondary todos from database
      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .in('id', secondaryTodos.map(t => t.id));

      if (deleteError) {
        logger.error('Error deleting merged todos', deleteError, { component: 'TodoList' });
        alert('Merge partially failed. Refreshing...');
        fetchTodos();
        setIsMerging(false);
        return;
      }

      // Update primary todo with merged data in UI
      const updatedTodo = {
        ...primaryTodo,
        text: combinedText,
        notes: combinedNotes,
        attachments: combinedAttachments,
        subtasks: combinedSubtasks,
        priority: highestPriority,
      };

      // Update UI after successful DB operations
      setTodos(prev => {
        const filtered = prev.filter(t => !secondaryTodos.some(st => st.id === t.id));
        return filtered.map(t => t.id === primaryTodoId ? updatedTodo : t);
      });

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

      // Clear selection and close modal
      setSelectedTodos(new Set());
      setShowBulkActions(false);
      setShowMergeModal(false);
      setMergeTargets([]);
      setSelectedPrimaryId(null);
    } catch (error) {
      logger.error('Error during merge', error, { component: 'TodoList' });
      alert('An unexpected error occurred. Please try again.');
      fetchTodos();
    } finally {
      setIsMerging(false);
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

  const getCompletedAtMs = (todo: Todo) => {
    const raw = todo.updated_at || todo.created_at;
    if (!raw) return null;
    const time = new Date(raw).getTime();
    return Number.isNaN(time) ? null : time;
  };

  const archivedTodos = useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return todos
      .filter((todo) => {
        if (!todo.completed) return false;
        const completedAt = getCompletedAtMs(todo);
        return completedAt !== null && completedAt <= cutoff;
      })
      .sort((a, b) => (getCompletedAtMs(b) || 0) - (getCompletedAtMs(a) || 0));
  }, [todos, archiveTick]);

  const archivedIds = useMemo(() => new Set(archivedTodos.map((todo) => todo.id)), [archivedTodos]);

  // All users can now see all tasks, excluding archived
  const visibleTodos = useMemo(() => {
    return todos.filter((todo) => !archivedIds.has(todo.id));
  }, [todos, archivedIds]);

  // Extract unique customer names from todos for filtering
  const uniqueCustomers = useMemo(() => {
    const customers = new Set<string>();
    visibleTodos.forEach(todo => {
      const names = extractPotentialNames(`${todo.text} ${todo.notes || ''}`);
      names.forEach(name => customers.add(name));
    });
    return Array.from(customers).sort();
  }, [visibleTodos]);

  const filteredArchivedTodos = useMemo(() => {
    const query = archiveQuery.trim().toLowerCase();
    if (!query) return archivedTodos;
    return archivedTodos.filter((todo) =>
      todo.text.toLowerCase().includes(query) ||
      todo.created_by.toLowerCase().includes(query) ||
      (todo.assigned_to && todo.assigned_to.toLowerCase().includes(query)) ||
      (todo.notes && todo.notes.toLowerCase().includes(query)) ||
      (todo.transcription && todo.transcription.toLowerCase().includes(query))
    );
  }, [archivedTodos, archiveQuery]);

  // Filter and sort todos
  const filteredAndSortedTodos = useMemo(() => {
    let result = [...visibleTodos];

    // Apply search filter (comprehensive search including transcription)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
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
    }

    // Apply high priority filter
    if (highPriorityOnly) {
      result = result.filter((todo) => todo.priority === 'urgent' || todo.priority === 'high');
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((todo) => todo.status === statusFilter);
    }

    // Apply assigned to filter
    if (assignedToFilter !== 'all') {
      if (assignedToFilter === 'unassigned') {
        result = result.filter((todo) => !todo.assigned_to);
      } else {
        result = result.filter((todo) => todo.assigned_to === assignedToFilter);
      }
    }

    // Apply has attachments filter
    if (hasAttachmentsFilter !== null) {
      if (hasAttachmentsFilter) {
        result = result.filter((todo) => todo.attachments && todo.attachments.length > 0);
      } else {
        result = result.filter((todo) => !todo.attachments || todo.attachments.length === 0);
      }
    }

    // Apply customer filter
    if (customerFilter !== 'all') {
      result = result.filter((todo) => {
        const names = extractPotentialNames(`${todo.text} ${todo.notes || ''}`);
        return names.includes(customerFilter);
      });
    }

    // Apply date range filter (on due_date)
    if (dateRangeFilter.start) {
      const startDate = new Date(dateRangeFilter.start);
      startDate.setHours(0, 0, 0, 0);
      result = result.filter((todo) => {
        if (!todo.due_date) return false;
        const dueDate = new Date(todo.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate >= startDate;
      });
    }
    if (dateRangeFilter.end) {
      const endDate = new Date(dateRangeFilter.end);
      endDate.setHours(23, 59, 59, 999);
      result = result.filter((todo) => {
        if (!todo.due_date) return false;
        const dueDate = new Date(todo.due_date);
        return dueDate <= endDate;
      });
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
      case 'urgency':
        // Smart urgency sort: combines days overdue with priority
        result.sort((a, b) => {
          const getUrgencyScore = (todo: Todo) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let daysOverdue = 0;
            if (todo.due_date && !todo.completed) {
              const dueDate = new Date(todo.due_date);
              dueDate.setHours(0, 0, 0, 0);
              daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
            }
            const priorityWeight = { urgent: 100, high: 50, medium: 25, low: 0 }[todo.priority || 'medium'];
            return (daysOverdue * 10) + priorityWeight;
          };
          return getUrgencyScore(b) - getUrgencyScore(a);
        });
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
  }, [visibleTodos, searchQuery, quickFilter, showCompleted, sortOption, userName, customOrder, statusFilter, assignedToFilter, customerFilter, hasAttachmentsFilter, dateRangeFilter, highPriorityOnly]);

  // Stats - calculate based on filter context for dynamic counts
  const stats = useMemo(() => {
    // Start with visible todos
    let baseSet = [...visibleTodos];

    // Apply assignment filter (My Tasks dropdown)
    if (quickFilter === 'my_tasks') {
      baseSet = baseSet.filter((t) => t.assigned_to === userName || t.created_by === userName);
    }

    // Apply high priority filter
    if (highPriorityOnly) {
      baseSet = baseSet.filter((t) => t.priority === 'urgent' || t.priority === 'high');
    }

    return {
      total: baseSet.length,
      completed: baseSet.filter((t) => t.completed).length,
      active: baseSet.filter((t) => !t.completed).length,
      dueToday: baseSet.filter((t) => isDueToday(t.due_date) && !t.completed).length,
      overdue: baseSet.filter((t) => isOverdue(t.due_date, t.completed)).length,
    };
  }, [visibleTodos, quickFilter, highPriorityOnly, userName]);

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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] flex items-center justify-center shadow-lg" style={{ boxShadow: '0 8px 24px rgba(0, 51, 160, 0.3)' }}>
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
            </div>
            <div className="absolute -inset-3 bg-[var(--accent)]/20 rounded-3xl blur-xl animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-sky)] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-[var(--accent-sky)] animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-[var(--accent-sky)] animate-bounce" style={{ animationDelay: '300ms' }} />
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

        {/* Header - Theme Responsive */}
        <header className={`sticky top-0 z-40 shadow-[var(--shadow-lg)] border-b ${
          darkMode
            ? 'bg-[var(--gradient-hero)] border-white/5'
            : 'bg-white border-[var(--border)]'
        }`}>
        <div className={`mx-auto px-4 sm:px-6 py-4 ${viewMode === 'kanban' ? 'max-w-6xl' : 'max-w-4xl'}`}>
          <div className="flex items-center justify-between gap-3">
            {/* Logo & Context Info */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Dashboard button */}
              {onOpenDashboard && (
                <button
                  onClick={onOpenDashboard}
                  className={`p-2 rounded-xl transition-all flex-shrink-0 ${
                    darkMode
                      ? 'hover:bg-white/10 text-white/70 hover:text-white'
                      : 'hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)]'
                  }`}
                  title="Daily Summary"
                >
                  <Home className="w-5 h-5" />
                </button>
              )}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] flex items-center justify-center flex-shrink-0 shadow-lg" style={{ boxShadow: '0 4px 12px rgba(0, 51, 160, 0.35)' }}>
                <span className="text-white font-bold text-base">B</span>
              </div>
              <div className="min-w-0">
                <h1 className={`text-base font-bold truncate tracking-tight ${darkMode ? 'text-white' : 'text-[var(--brand-navy)]'}`}>Bealer Agency</h1>
                {/* Show contextual info instead of "Welcome back" */}
                <p className={`text-xs truncate ${darkMode ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>
                  {stats.active} active{stats.dueToday > 0 && ` • ${stats.dueToday} due today`}{stats.overdue > 0 && ` • ${stats.overdue} overdue`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* View toggle with labels */}
              <div className={`flex backdrop-blur-sm rounded-xl p-1 border ${
                darkMode
                  ? 'bg-white/8 border-white/10'
                  : 'bg-[var(--surface-2)] border-[var(--border)]'
              }`}>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    viewMode === 'list'
                      ? 'bg-[var(--brand-sky)] text-[var(--brand-navy)] shadow-md'
                      : darkMode
                        ? 'text-white/70 hover:text-white hover:bg-white/10'
                        : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-3)]'
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
                      ? 'bg-[var(--brand-sky)] text-[var(--brand-navy)] shadow-md'
                      : darkMode
                        ? 'text-white/70 hover:text-white hover:bg-white/10'
                        : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-3)]'
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
                onClick={() => setShowActivityFeed(true)}
                className={`p-2 rounded-xl transition-all duration-200 ${
                  darkMode
                    ? 'text-white/60 hover:text-white hover:bg-white/10'
                    : 'text-[var(--text-muted)] hover:text-[var(--brand-blue)] hover:bg-[var(--surface-2)]'
                }`}
                aria-label="View activity feed"
              >
                <Activity className="w-4 h-4" />
              </button>

              {canViewArchive && (
                <button
                  onClick={() => setShowArchiveView(true)}
                  className={`p-2 rounded-xl transition-all duration-200 ${
                    darkMode
                      ? 'text-white/60 hover:text-white hover:bg-white/10'
                      : 'text-[var(--text-muted)] hover:text-[var(--brand-blue)] hover:bg-[var(--surface-2)]'
                  }`}
                  aria-label="View archive"
                  title="Archived tasks"
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}

              {/* Strategic Dashboard - Owner only */}
              {userName === OWNER_USERNAME && (
                <button
                  onClick={() => setShowStrategicDashboard(true)}
                  className={`p-2 rounded-xl transition-all duration-200 ${
                    darkMode
                      ? 'text-white/60 hover:text-white hover:bg-white/10'
                      : 'text-[var(--text-muted)] hover:text-[var(--brand-blue)] hover:bg-[var(--surface-2)]'
                  }`}
                  aria-label="Strategic Goals Dashboard"
                  title="Strategic Goals"
                >
                  <Target className="w-4 h-4" />
                </button>
              )}

              {/* Weekly progress chart */}
              <button
                onClick={() => setShowWeeklyChart(true)}
                className={`p-2 rounded-xl transition-all duration-200 ${
                  darkMode
                    ? 'text-white/60 hover:text-white hover:bg-white/10'
                    : 'text-[var(--text-muted)] hover:text-[var(--brand-blue)] hover:bg-[var(--surface-2)]'
                }`}
                aria-label="View weekly progress"
              >
                <BarChart2 className="w-4 h-4" />
              </button>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-xl transition-all duration-200 ${
                  darkMode
                    ? 'text-white/60 hover:text-white hover:bg-white/10'
                    : 'text-[var(--text-muted)] hover:text-[var(--brand-blue)] hover:bg-[var(--surface-2)]'
                }`}
                aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <UserSwitcher currentUser={currentUser} onUserChange={onUserChange} />
            </div>
          </div>
        </div>
      </header>

      {/* Connection status - floating indicator (positioned above chat button) */}
      <div className="fixed bottom-24 right-6 z-30">
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
      <main id="main-content" className={`mx-auto px-4 sm:px-6 py-6 ${viewMode === 'kanban' ? 'max-w-6xl' : 'max-w-4xl'}`}>
        {/* Context label when filtered */}
        {(quickFilter !== 'all' || highPriorityOnly) && (
          <div className="text-xs text-[var(--text-muted)] mb-2 flex items-center gap-2">
            <span>Showing:</span>
            {quickFilter === 'my_tasks' && <span className="font-medium text-[var(--accent)]">My Tasks</span>}
            {quickFilter === 'due_today' && <span className="font-medium text-[var(--warning)]">Due Today</span>}
            {quickFilter === 'overdue' && <span className="font-medium text-[var(--danger)]">Overdue</span>}
            {quickFilter === 'all' && highPriorityOnly && <span className="font-medium text-[var(--danger)]">All Tasks</span>}
            {highPriorityOnly && <span className="text-[var(--danger)]">• High Priority Only</span>}
          </div>
        )}

        {/* Actionable Stats Cards - Dynamic counts based on filter context */}
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
          <AddTodo onAdd={addTodo} users={users} darkMode={darkMode} currentUserId={currentUser.id} autoFocus={autoFocusAddTask} />
        </div>

        {/* Unified Filter Bar - Premium */}
        <div className="rounded-[var(--radius-xl)] p-4 mb-4 bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)]">
          {/* Search Row */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-light)] pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
                className="input-refined w-full !pl-10 pr-4 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--text-light)]"
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
                <option value="urgency">Urgency</option>
                <option value="alphabetical">A-Z</option>
                <option value="custom">Manual</option>
              </select>
              <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--text-muted)]" />
            </div>
          </div>

          {/* Simplified Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Assignment dropdown */}
            <div className="relative">
              <select
                value={quickFilter}
                onChange={(e) => setQuickFilter(e.target.value as QuickFilter)}
                className="input-refined appearance-none pl-9 pr-8 py-2 text-sm font-medium cursor-pointer min-w-[140px]"
              >
                <option value="all">All Tasks</option>
                <option value="my_tasks">My Tasks</option>
                <option value="due_today">Due Today</option>
                <option value="overdue">Overdue</option>
              </select>
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--text-muted)]" />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--text-muted)]" />
            </div>

            {/* High Priority toggle */}
            <button
              type="button"
              onClick={() => setHighPriorityOnly(!highPriorityOnly)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-[var(--radius-md)] transition-all duration-200 ${
                highPriorityOnly
                  ? 'bg-[var(--danger)] text-white shadow-sm'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]'
              }`}
              aria-pressed={highPriorityOnly}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              High Priority
            </button>

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
              Show Completed
            </button>

            <div className="w-px h-5 bg-[var(--border)] mx-1" />

            {/* Advanced filters toggle */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-[var(--radius-md)] transition-all duration-200 ${
                showAdvancedFilters || statusFilter !== 'all' || assignedToFilter !== 'all' || customerFilter !== 'all' || hasAttachmentsFilter !== null || dateRangeFilter.start || dateRangeFilter.end
                  ? 'bg-[var(--brand-blue)] text-white shadow-sm'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]'
              }`}
              aria-expanded={showAdvancedFilters}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {(statusFilter !== 'all' || assignedToFilter !== 'all' || customerFilter !== 'all' || hasAttachmentsFilter !== null || dateRangeFilter.start || dateRangeFilter.end) && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                  {[statusFilter !== 'all', assignedToFilter !== 'all', customerFilter !== 'all', hasAttachmentsFilter !== null, dateRangeFilter.start || dateRangeFilter.end].filter(Boolean).length}
                </span>
              )}
            </button>

            {/* Active filter indicator / Clear all */}
            {(quickFilter !== 'all' || highPriorityOnly || showCompleted || statusFilter !== 'all' || assignedToFilter !== 'all' || customerFilter !== 'all' || hasAttachmentsFilter !== null || dateRangeFilter.start || dateRangeFilter.end) && (
              <button
                type="button"
                onClick={() => {
                  setQuickFilter('all');
                  setHighPriorityOnly(false);
                  setShowCompleted(false);
                  setStatusFilter('all');
                  setAssignedToFilter('all');
                  setCustomerFilter('all');
                  setHasAttachmentsFilter(null);
                  setDateRangeFilter({ start: '', end: '' });
                }}
                className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline ml-auto font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Status filter */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TodoStatus | 'all')}
                  className="input-refined w-full text-sm py-2"
                >
                  <option value="all">All Statuses</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

              {/* Assigned to filter */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Assigned To</label>
                <select
                  value={assignedToFilter}
                  onChange={(e) => setAssignedToFilter(e.target.value)}
                  className="input-refined w-full text-sm py-2"
                >
                  <option value="all">Anyone</option>
                  <option value="unassigned">Unassigned</option>
                  {users.map((user) => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
              </div>

              {/* Customer filter */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Customer</label>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="input-refined w-full text-sm py-2"
                >
                  <option value="all">All Customers</option>
                  {uniqueCustomers.map((customer) => (
                    <option key={customer} value={customer}>{customer}</option>
                  ))}
                </select>
              </div>

              {/* Has attachments filter */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Attachments</label>
                <select
                  value={hasAttachmentsFilter === null ? 'all' : hasAttachmentsFilter ? 'yes' : 'no'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHasAttachmentsFilter(val === 'all' ? null : val === 'yes');
                  }}
                  className="input-refined w-full text-sm py-2"
                >
                  <option value="all">Any</option>
                  <option value="yes">Has Attachments</option>
                  <option value="no">No Attachments</option>
                </select>
              </div>

              {/* Date range filter */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Due Date Range</label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={dateRangeFilter.start}
                    onChange={(e) => setDateRangeFilter(prev => ({ ...prev, start: e.target.value }))}
                    className="input-refined flex-1 text-xs py-2"
                    placeholder="From"
                  />
                  <input
                    type="date"
                    value={dateRangeFilter.end}
                    onChange={(e) => setDateRangeFilter(prev => ({ ...prev, end: e.target.value }))}
                    className="input-refined flex-1 text-xs py-2"
                    placeholder="To"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Select Toggle */}
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
                ? 'bg-[var(--brand-sky)] text-[var(--brand-navy)] shadow-sm'
                : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] border border-[var(--border)]'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            {showBulkActions ? 'Cancel' : 'Select'}
          </button>
          {showBulkActions && (
            <span className="text-sm text-[var(--text-muted)]">
              Click tasks to select them
            </span>
          )}
        </div>

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
                      onStatusChange={updateStatus}
                      onUpdateText={updateText}
                      onDuplicate={duplicateTodo}
                      onUpdateNotes={updateNotes}
                      onSetRecurrence={setRecurrence}
                      onUpdateSubtasks={updateSubtasks}
                      onUpdateAttachments={updateAttachments}
                      onSaveAsTemplate={(t) => setTemplateTodo(t)}
                      onEmailCustomer={(todo) => {
                        setEmailTargetTodos([todo]);
                        setShowEmailModal(true);
                      }}
                      isDragEnabled={!showBulkActions && sortOption === 'custom'}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <KanbanBoard
            todos={filteredAndSortedTodos}
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
            onToggle={toggleTodo}
            onDuplicate={duplicateTodo}
            onSetRecurrence={setRecurrence}
            onUpdateAttachments={updateAttachments}
            onSaveAsTemplate={(t) => setTemplateTodo(t)}
            onEmailCustomer={(todo) => {
              setEmailTargetTodos([todo]);
              setShowEmailModal(true);
            }}
            showBulkActions={showBulkActions}
            selectedTodos={selectedTodos}
            onSelectTodo={handleSelectTodo}
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

      {showArchiveView && canViewArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Archived tasks">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowArchiveView(false)}
          />
          <div className="relative w-full max-w-3xl rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Archive</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Tasks completed for 48+ hours ({archivedTodos.length})
                </p>
              </div>
              <button
                onClick={() => setShowArchiveView(false)}
                className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
                aria-label="Close archive"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-light)] pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  value={archiveQuery}
                  onChange={(e) => setArchiveQuery(e.target.value)}
                  placeholder="Search archived tasks..."
                  aria-label="Search archived tasks"
                  className="input-refined w-full !pl-10 pr-4 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--text-light)]"
                />
                {archiveQuery && (
                  <button
                    onClick={() => setArchiveQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                    aria-label="Clear archive search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
                {filteredArchivedTodos.length === 0 ? (
                  <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
                    No archived tasks match your search.
                  </div>
                ) : (
                  filteredArchivedTodos.map((todo) => {
                    const completedAt = getCompletedAtMs(todo);
                    const hasSubtasks = todo.subtasks && todo.subtasks.length > 0;
                    const hasAttachments = todo.attachments && todo.attachments.length > 0;
                    return (
                      <button
                        key={todo.id}
                        onClick={() => setSelectedArchivedTodo(todo)}
                        className="w-full text-left rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-4 hover:bg-[var(--surface-3)] hover:border-[var(--accent)] transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">{todo.text}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                              {todo.assigned_to ? `Assigned to ${todo.assigned_to}` : 'Unassigned'} • created by {todo.created_by}
                            </p>
                            {/* Show indicators for subtasks and attachments */}
                            {(hasSubtasks || hasAttachments) && (
                              <div className="flex items-center gap-2 mt-2">
                                {hasSubtasks && (
                                  <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    {todo.subtasks!.filter(st => st.completed).length}/{todo.subtasks!.length} subtasks
                                  </span>
                                )}
                                {hasAttachments && (
                                  <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                                    <Paperclip className="w-3 h-3" />
                                    {todo.attachments!.length}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {completedAt && (
                            <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                              {new Date(completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {(todo.notes || todo.transcription) && (
                          <p className="text-xs text-[var(--text-light)] mt-2 line-clamp-2">
                            {todo.notes || todo.transcription}
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archived Task Detail Modal */}
      {selectedArchivedTodo && (
        <ArchivedTaskModal
          todo={selectedArchivedTodo}
          onClose={() => setSelectedArchivedTodo(null)}
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

      {/* Merge Tasks Modal */}
      {showMergeModal && mergeTargets.length >= 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Merge Tasks">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!isMerging) {
                setShowMergeModal(false);
                setMergeTargets([]);
                setSelectedPrimaryId(null);
              }
            }}
          />
          <div className={`relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-[var(--surface)]' : 'bg-white'}`}>
            {/* Header */}
            <div className={`px-5 py-4 border-b ${darkMode ? 'border-white/10 bg-[var(--surface-2)]' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--brand-blue)]/15 flex items-center justify-center">
                  <GitMerge className="w-4.5 h-4.5 text-[var(--brand-blue)]" />
                </div>
                <div>
                  <h2 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>Merge {mergeTargets.length} Tasks</h2>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-[var(--text-muted)]'}`}>
                    Select the task to keep
                  </p>
                </div>
              </div>
            </div>

            {/* Task List */}
            <div className="px-4 py-3 max-h-72 overflow-y-auto">
              <div className="space-y-2">
                {mergeTargets.map((todo) => (
                  <button
                    key={todo.id}
                    onClick={() => setSelectedPrimaryId(todo.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedPrimaryId === todo.id
                        ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 ring-1 ring-[var(--brand-blue)]/30'
                        : darkMode
                          ? 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                          : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] hover:border-[var(--border-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedPrimaryId === todo.id
                          ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]'
                          : darkMode
                            ? 'border-slate-500'
                            : 'border-[var(--border)]'
                      }`}>
                        {selectedPrimaryId === todo.id && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                          {todo.text}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-[var(--text-muted)]'}`}>
                            {new Date(todo.created_at).toLocaleDateString()}
                          </span>
                          {todo.attachments && todo.attachments.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              {todo.attachments.length} file{todo.attachments.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {todo.subtasks && todo.subtasks.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              {todo.subtasks.length} subtask{todo.subtasks.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className={`mx-4 mb-3 p-3 rounded-lg text-xs ${darkMode ? 'bg-white/5 text-slate-400' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}>
              <p className="font-medium mb-1.5 text-[var(--text-light)]">When merged:</p>
              <div className="grid grid-cols-2 gap-1">
                <span>• Notes combined</span>
                <span>• Attachments kept</span>
                <span>• Subtasks merged</span>
                <span>• Highest priority</span>
              </div>
            </div>

            {/* Footer */}
            <div className={`px-4 py-3 border-t flex justify-end gap-2 ${darkMode ? 'border-white/10 bg-[var(--surface-2)]' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
              <button
                onClick={() => {
                  if (!isMerging) {
                    setShowMergeModal(false);
                    setMergeTargets([]);
                    setSelectedPrimaryId(null);
                  }
                }}
                disabled={isMerging}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isMerging
                    ? 'opacity-50 cursor-not-allowed'
                    : darkMode
                      ? 'text-slate-300 hover:bg-white/10'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedPrimaryId && !isMerging) {
                    mergeTodos(selectedPrimaryId);
                  }
                }}
                disabled={!selectedPrimaryId || isMerging}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                  selectedPrimaryId && !isMerging
                    ? 'bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue)]/90 shadow-sm'
                    : darkMode
                      ? 'bg-white/10 text-slate-500 cursor-not-allowed'
                      : 'bg-[var(--surface-2)] text-[var(--text-light)] cursor-not-allowed'
                }`}
              >
                {isMerging ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Merging...
                  </>
                ) : (
                  <>
                    <GitMerge className="w-4 h-4" />
                    Merge Tasks
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Detection Modal */}
      {showDuplicateModal && pendingTask && (
        <DuplicateDetectionModal
          isOpen={showDuplicateModal}
          darkMode={darkMode}
          newTaskText={pendingTask.text}
          newTaskPriority={pendingTask.priority}
          newTaskDueDate={pendingTask.dueDate}
          newTaskAssignedTo={pendingTask.assignedTo}
          newTaskSubtasks={pendingTask.subtasks}
          newTaskTranscription={pendingTask.transcription}
          newTaskSourceFile={pendingTask.sourceFile}
          duplicates={duplicateMatches}
          onCreateAnyway={handleCreateTaskAnyway}
          onAddToExisting={handleAddToExistingTask}
          onCancel={handleCancelDuplicateDetection}
        />
      )}

      {/* Customer Email Modal */}
      {showEmailModal && emailTargetTodos.length > 0 && (
        <CustomerEmailModal
          todos={emailTargetTodos}
          currentUser={currentUser}
          onClose={() => {
            setShowEmailModal(false);
            setEmailTargetTodos([]);
          }}
          darkMode={darkMode}
        />
      )}

      {/* Enhanced Celebration Modal (Feature 3) */}
      {showEnhancedCelebration && celebrationData && (
        <CompletionCelebration
          celebrationData={celebrationData}
          onDismiss={() => {
            setShowEnhancedCelebration(false);
            setCelebrationData(null);
          }}
          onNextTaskClick={(taskId) => {
            setShowEnhancedCelebration(false);
            setCelebrationData(null);
            // Scroll to task - highlight it briefly
            const taskElement = document.getElementById(`todo-${taskId}`);
            if (taskElement) {
              taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              taskElement.classList.add('ring-2', 'ring-blue-500');
              setTimeout(() => {
                taskElement.classList.remove('ring-2', 'ring-blue-500');
              }, 2000);
            }
          }}
          onShowSummary={() => {
            setCompletedTaskForSummary(celebrationData.completedTask);
            setShowCompletionSummary(true);
          }}
        />
      )}

      {/* Task Completion Summary Modal (Feature 1) */}
      {showCompletionSummary && completedTaskForSummary && (
        <TaskCompletionSummary
          todo={completedTaskForSummary}
          completedBy={userName}
          onClose={() => {
            setShowCompletionSummary(false);
            setCompletedTaskForSummary(null);
          }}
        />
      )}

      {/* Floating Bulk Action Bar - Sticky at bottom */}
      {showBulkActions && selectedTodos.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 animate-in slide-in-from-bottom duration-300">
          <div className="bg-[var(--surface)] border-t border-[var(--border)] shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
            <div className={`mx-auto px-4 sm:px-6 py-3 ${viewMode === 'kanban' ? 'max-w-6xl' : 'max-w-4xl'}`}>
              <div className="flex items-center justify-between gap-4">
                {/* Left side - selection info with dismiss button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={clearSelection}
                    className="p-1.5 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                    title="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--foreground)]">{selectedTodos.size}</span>
                    <span className="text-sm text-[var(--text-muted)]">selected</span>
                  </div>
                  <div className="hidden sm:block w-px h-5 bg-[var(--border)]" />
                </div>

                {/* Action buttons - horizontal inline */}
                <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
                  {/* Mark Complete */}
                  <button
                    onClick={bulkComplete}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--success)] text-white hover:opacity-90 transition-all text-sm font-medium whitespace-nowrap"
                  >
                    <Check className="w-4 h-4" />
                    <span className="hidden sm:inline">Mark Complete</span>
                  </button>

                  {/* Reassign dropdown */}
                  <div className="relative">
                    <select
                      onChange={(e) => { if (e.target.value) bulkAssign(e.target.value); e.target.value = ''; }}
                      className="appearance-none px-3 py-2 pr-7 rounded-lg bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--surface-3)] transition-colors cursor-pointer text-sm font-medium border border-[var(--border)]"
                      aria-label="Reassign"
                    >
                      <option value="">Reassign</option>
                      {users.map((user) => (
                        <option key={user} value={user}>{user}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-[var(--text-muted)]" />
                  </div>

                  {/* Change Date dropdown */}
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        if (e.target.value) bulkReschedule(e.target.value);
                        e.target.value = '';
                      }}
                      className="appearance-none px-3 py-2 pr-7 rounded-lg bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--surface-3)] transition-colors cursor-pointer text-sm font-medium border border-[var(--border)]"
                      aria-label="Change Date"
                    >
                      <option value="">Change Date</option>
                      <option value={getDateOffset(0)}>Today</option>
                      <option value={getDateOffset(1)}>Tomorrow</option>
                      <option value={getDateOffset(7)}>Next Week</option>
                      <option value={getDateOffset(30)}>Next Month</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-[var(--text-muted)]" />
                  </div>

                  {/* Merge - only show when 2+ selected */}
                  {selectedTodos.size >= 2 && (
                    <button
                      onClick={initiateMerge}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--brand-blue)] text-white hover:opacity-90 transition-all text-sm font-medium whitespace-nowrap"
                    >
                      <GitMerge className="w-4 h-4" />
                      Merge
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={bulkDelete}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--danger)] text-white hover:opacity-90 transition-all text-sm font-medium whitespace-nowrap"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ChatPanel
        currentUser={currentUser}
        users={usersWithColors}
        onTaskLinkClick={(taskId) => {
          // Navigate to task from chat link (Feature 2)
          const taskElement = document.getElementById(`todo-${taskId}`);
          if (taskElement) {
            taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            taskElement.classList.add('ring-2', 'ring-blue-500');
            setTimeout(() => {
              taskElement.classList.remove('ring-2', 'ring-blue-500');
            }, 2000);
          }
        }}
      />
      </div>
    </PullToRefresh>
  );
}
