'use client';

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { listItemVariants, prefersReducedMotion, DURATION } from '@/lib/animations';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { Todo, TodoStatus, TodoPriority, ViewMode, SortOption, QuickFilter, RecurrencePattern, Subtask, Attachment, isOwner } from '@/types/todo';
import SortableTodoItem from './SortableTodoItem';
import AddTodo from './AddTodo';
import AddTaskModal from './AddTaskModal';
import KanbanBoard from './KanbanBoard';
import { logger } from '@/lib/logger';
import { useTodoStore, isDueToday, isOverdue, priorityOrder as _priorityOrder, hydrateFocusMode } from '@/store/todoStore';
import { useTodoData, useFilters, useBulkActions, useIsDesktopWide, useEscapeKey, useTodoModals, useFocusTrap } from '@/hooks';
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
import WelcomeBackNotification from './WelcomeBackNotification';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
// Note: KeyboardShortcutsModal moved to MainApp.tsx
import PullToRefresh from './PullToRefresh';
import StatusLine from './StatusLine';
import BottomTabs from './BottomTabs';
import { ExitFocusModeButton } from './FocusModeToggle';
import { LoadingState, ErrorState, ConnectionStatus, TodoHeader, TodoModals } from './todo';
import TaskSections, { useShouldUseSections } from './TaskSections';
import { v4 as uuidv4 } from 'uuid';
import {
  Search, AlertTriangle,
  ArrowUpDown, User, CheckSquare,
  Trash2, X, ChevronDown, GitMerge, Layers,
  Paperclip, Filter, RotateCcw, Check, FileText, MoreHorizontal
} from 'lucide-react';
import { AuthUser } from '@/types/todo';
import SaveTemplateModal from './SaveTemplateModal';
import TemplatePicker from './TemplatePicker';
import ArchivedTaskModal from './ArchivedTaskModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppShell } from './layout/AppShell';
import { logActivity } from '@/lib/activityLogger';
import { findPotentialDuplicates, shouldCheckForDuplicates, DuplicateMatch } from '@/lib/duplicateDetection';
import { sendTaskAssignmentNotification, sendTaskCompletionNotification, sendTaskReassignmentNotification } from '@/lib/taskNotifications';
import { fetchWithCsrf } from '@/lib/csrf';
import { getNextSuggestedTasks, calculateCompletionStreak, getEncouragementMessage } from '@/lib/taskSuggestions';
import DuplicateDetectionModal from './DuplicateDetectionModal';
import CustomerEmailModal from './CustomerEmailModal';
import { CompletionCelebration } from './CompletionCelebration';
import { TaskCompletionSummary } from './TaskCompletionSummary';
import { CelebrationData, ActivityLogEntry } from '@/types/todo';
import {
  ChatPanelSkeleton,
  StrategicDashboardSkeleton,
  ActivityFeedSkeleton,
  // Note: WeeklyProgressChartSkeleton moved to MainApp.tsx
} from './LoadingSkeletons';

// Lazy load secondary features for better initial load performance
// These components are not needed immediately on page load
// NOTE: FloatingChat removed - Chat is now accessible via navigation sidebar
// const FloatingChat = dynamic(() => import('./FloatingChat'), {
//   ssr: false,
//   loading: () => null,
// });

// NOTE: UtilitySidebar removed - navigation now in AppShell sidebar
// const UtilitySidebar = dynamic(() => import('./UtilitySidebar'), {
//   ssr: false,
//   loading: () => <div className="w-[280px] bg-[var(--surface)] animate-pulse" />,
// });

const ChatPanel = dynamic(() => import('./ChatPanel'), {
  ssr: false,
  loading: () => <ChatPanelSkeleton />,
});

const StrategicDashboard = dynamic(() => import('./StrategicDashboard'), {
  ssr: false,
  loading: () => <StrategicDashboardSkeleton />,
});

const ActivityFeed = dynamic(() => import('./ActivityFeed'), {
  ssr: false,
  loading: () => <ActivityFeedSkeleton />,
});

// Note: WeeklyProgressChart moved to MainApp.tsx

interface TodoListProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
  onOpenDashboard?: () => void;
  initialFilter?: QuickFilter | null;
  autoFocusAddTask?: boolean;
  onAddTaskModalOpened?: () => void;
  onInitialFilterApplied?: () => void;
  selectedTaskId?: string | null;
  onSelectedTaskHandled?: () => void;
}

// Helper to get completion timestamp in ms
const getCompletedAtMs = (todo: Todo): number | null => {
  // Try updated_at first if task is completed
  if (todo.completed && todo.updated_at) {
    const updatedMs = new Date(todo.updated_at).getTime();
    if (!isNaN(updatedMs)) return updatedMs;
  }
  // Fallback to created_at
  if (todo.created_at) {
    const createdMs = new Date(todo.created_at).getTime();
    if (!isNaN(createdMs)) return createdMs;
  }
  return null;
};

export default function TodoList({ currentUser, onUserChange, onOpenDashboard, initialFilter, autoFocusAddTask, onAddTaskModalOpened, onInitialFilterApplied, selectedTaskId, onSelectedTaskHandled }: TodoListProps) {
  const userName = currentUser.name;
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const canViewArchive = currentUser.role === 'admin' || ['derrick', 'adrian'].includes(userName.toLowerCase());

  // Get navigation state from AppShell context
  const { activeView, setActiveView } = useAppShell();

  // NOTE: isWideDesktop removed - no longer using UtilitySidebar or conditional chat layouts
  // const isWideDesktop = useIsDesktopWide(1280);

  // Core data from Zustand store (managed by useTodoData hook)
  const {
    todos,
    users,
    usersWithColors,
    loading,
    connected,
    error,
    // Store actions for direct state manipulation (used by component handlers)
    addTodo: addTodoToStore,
    updateTodo: updateTodoInStore,
    deleteTodo: deleteTodoFromStore,
    // Bulk action helpers from store
    toggleTodoSelection,
  } = useTodoStore();

  void _priorityOrder; // Re-exported for external use

  // useTodoData handles fetching, real-time subscriptions, and basic CRUD
  // We use the store state above but keep local handlers for enhanced features
  const { refresh: refreshTodos } = useTodoData(currentUser);

  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Sectioned view toggle (Overdue/Today/Upcoming/No Date grouping)
  const [useSectionedView, setUseSectionedView] = useState(true);

  // "More" dropdown state for overflow menu in filter bar
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);

  // Separate state to control showing TemplatePicker (opened from More dropdown)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // Close "More" dropdown on Escape key
  useEscapeKey(() => setShowMoreDropdown(false), { enabled: showMoreDropdown });

  // Filter state from useFilters hook (manages search, sort, quick filters, and advanced filters)
  const {
    filters,
    visibleTodos,
    filteredAndSortedTodos: hookFilteredTodos,
    archivedTodos,
    uniqueCustomers,
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
    filterArchivedTodos,
  } = useFilters(userName);

  // Destructure filter values for easier access (backwards compatibility with existing code)
  const {
    searchQuery,
    sortOption,
    quickFilter,
    showCompleted,
    highPriorityOnly,
    statusFilter,
    assignedToFilter,
    customerFilter,
    hasAttachmentsFilter,
    dateRangeFilter,
  } = filters;

  // Determine if sections should be used (disabled for custom sort/drag-drop)
  const shouldUseSections = useShouldUseSections(sortOption);

  // Get showAdvancedFilters and focusMode from UI state (not part of filters in store)
  const { showAdvancedFilters, focusMode } = useTodoStore((state) => state.ui);
  const toggleFocusMode = useTodoStore((state) => state.toggleFocusMode);
  const setFocusMode = useTodoStore((state) => state.setFocusMode);

  // Apply initial filter from props
  useEffect(() => {
    if (initialFilter) {
      setQuickFilter(initialFilter);
      // Notify parent so it can reset the trigger state
      onInitialFilterApplied?.();
    }
  }, [initialFilter, setQuickFilter, onInitialFilterApplied]);

  // Open add task modal when autoFocusAddTask is true
  useEffect(() => {
    if (autoFocusAddTask) {
      setShowAddTaskModal(true);
      // Notify parent so it can reset the trigger state
      onAddTaskModalOpened?.();
    }
  }, [autoFocusAddTask, onAddTaskModalOpened]);

  // Bulk actions from hook
  const {
    selectedTodos,
    showBulkActions,
    handleSelectTodo: hookHandleSelectTodo,
    selectAll,
    clearSelection,
    setShowBulkActions,
    bulkDelete: hookBulkDelete,
    bulkAssign: hookBulkAssign,
    bulkComplete: hookBulkComplete,
    bulkReschedule: hookBulkReschedule,
    getDateOffset,
  } = useBulkActions(userName);

  // Modal state management via useTodoModals hook
  const {
    // Celebration state
    showCelebration,
    celebrationText,
    showEnhancedCelebration,
    celebrationData,
    // Progress & welcome state
    showProgressSummary,
    showWelcomeBack,
    showWeeklyChart,
    // Utility modals state
    showShortcuts,
    showActivityFeed,
    showStrategicDashboard,
    // Template state
    templateTodo,
    // Confirm dialog state
    confirmDialog,
    // Completion summary state
    showCompletionSummary,
    completedTaskForSummary,
    // Duplicate detection state
    showDuplicateModal,
    duplicateMatches,
    pendingTask,
    // Email modal state
    showEmailModal,
    emailTargetTodos,
    // Archive state
    showArchiveView,
    selectedArchivedTodo,
    archiveQuery,
    // Merge modal state
    showMergeModal,
    mergeTargets,
    selectedPrimaryId,
    isMerging,
    // Activity log state
    activityLog,
    // Actions - Celebration
    triggerCelebration,
    dismissCelebration,
    triggerEnhancedCelebration,
    dismissEnhancedCelebration,
    // Actions - Progress & welcome
    openProgressSummary,
    closeProgressSummary,
    closeWelcomeBack,
    openWeeklyChart,
    closeWeeklyChart,
    // Actions - Utility modals
    openShortcuts,
    closeShortcuts,
    openActivityFeed,
    closeActivityFeed,
    openStrategicDashboard,
    closeStrategicDashboard,
    // Actions - Template
    openTemplateModal,
    closeTemplateModal,
    // Actions - Confirm dialog
    openConfirmDialog,
    closeConfirmDialog,
    // Actions - Completion summary
    openCompletionSummary,
    closeCompletionSummary,
    // Actions - Duplicate detection
    openDuplicateModal,
    clearDuplicateState,
    // Actions - Email
    openEmailModal,
    closeEmailModal,
    // Actions - Archive
    openArchiveView,
    closeArchiveView,
    selectArchivedTodo,
    setArchiveQuery,
    incrementArchiveTick,
    // Actions - Merge
    openMergeModal,
    closeMergeModal,
    setMergePrimaryId,
    setMergingState,
    // Actions - Activity log
    setActivityLog,
  } = useTodoModals();

  // Focus traps for inline modals (BUG-TM-13, BUG-TM-14)
  const { containerRef: activityFeedRef } = useFocusTrap<HTMLDivElement>({
    onEscape: () => { closeActivityFeed(); setActiveView('tasks'); },
    enabled: showActivityFeed,
  });

  const { containerRef: archiveModalRef } = useFocusTrap<HTMLDivElement>({
    onEscape: () => { closeArchiveView(); setActiveView('tasks'); },
    enabled: showArchiveView && canViewArchive,
  });

  const { containerRef: mergeModalRef } = useFocusTrap<HTMLDivElement>({
    onEscape: () => { if (!isMerging) closeMergeModal(); },
    enabled: showMergeModal && mergeTargets.length >= 2,
  });

  // Sync navigation activeView with internal panel states
  // This connects the sidebar navigation to the view panels
  useEffect(() => {
    if (activeView === 'activity') {
      openActivityFeed();
      closeStrategicDashboard();
      closeArchiveView();
    } else if (activeView === 'goals') {
      closeActivityFeed();
      openStrategicDashboard();
      closeArchiveView();
    } else if (activeView === 'archive') {
      // Archive is now handled by MainApp with dedicated ArchiveView component
      // This case should not render TodoList, but close overlays just in case
      closeActivityFeed();
      closeStrategicDashboard();
      closeArchiveView();
    } else if (activeView === 'tasks') {
      // Close all overlay panels when returning to tasks view
      closeActivityFeed();
      closeStrategicDashboard();
      closeArchiveView();
    }
  }, [activeView, openActivityFeed, closeActivityFeed, openStrategicDashboard, closeStrategicDashboard, openArchiveView, closeArchiveView]);

  // Custom order for drag-and-drop sorting (component-specific, not in modal hook)
  const [customOrder, setCustomOrder] = useState<string[]>([]);

  // Add Task modal state (separate from useTodoModals as it's a different concern)
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

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

      // Cmd/Ctrl + A - select all visible todos
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const visibleIds = visibleTodos.map(t => t.id);
        selectAll(visibleIds);
        if (visibleIds.length > 0) {
          setShowBulkActions(true);
        }
        return;
      }

      // 'Escape' - clear selection or exit focus mode
      if (e.key === 'Escape') {
        // Priority 1: Exit focus mode if active
        const currentFocusMode = useTodoStore.getState().ui.focusMode;
        if (currentFocusMode) {
          setFocusMode(false);
          return;
        }
        // Priority 2: Clear bulk selection if active
        if (showBulkActions && selectedTodos.size > 0) {
          clearSelection();
          setShowBulkActions(false);
          return;
        }
        // Priority 3: Clear search query
        setSearchQuery('');
      }

      // Cmd/Ctrl + Shift + F - toggle focus mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFocusMode();
      }

      // '1-4' - quick filter shortcuts
      if (e.key === '1') { e.preventDefault(); setQuickFilter('all'); }
      if (e.key === '2') { e.preventDefault(); setQuickFilter('my_tasks'); }
      if (e.key === '3') { e.preventDefault(); setQuickFilter('due_today'); }
      if (e.key === '4') { e.preventDefault(); setQuickFilter('overdue'); }

      // '?' - show keyboard shortcuts help
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        openShortcuts();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleTodos, showBulkActions, selectedTodos, selectAll, clearSelection, setShowBulkActions, setSearchQuery, setFocusMode, toggleFocusMode, setQuickFilter, openShortcuts]);

  useEffect(() => {
    const interval = setInterval(() => {
      incrementArchiveTick();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [incrementArchiveTick]);

  // Hydrate focus mode from localStorage on mount
  useEffect(() => {
    hydrateFocusMode();
  }, []);

  // Note: WeeklyProgressChart and KeyboardShortcutsModal are now rendered in MainApp.tsx
  // using AppShell context state, so they're accessible from any view (not just tasks)

  // Fetch activity log for streak calculation (useTodoData handles todos/users/real-time)
  const fetchActivityLog = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) {
      setActivityLog(data as ActivityLogEntry[]);
    }
  }, [setActivityLog]);

  // Fetch activity log on mount
  useEffect(() => {
    fetchActivityLog();
  }, [fetchActivityLog]);

  // Check for duplicates and either show modal or create task directly
  const addTodo = (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string, subtasks?: Subtask[], transcription?: string, sourceFile?: File, reminderAt?: string, notes?: string, recurrence?: 'daily' | 'weekly' | 'monthly' | null) => {
    // Check if we should look for duplicates
    const combinedText = `${text} ${transcription || ''}`;
    if (shouldCheckForDuplicates(combinedText)) {
      const duplicates = findPotentialDuplicates(combinedText, todos);
      if (duplicates.length > 0) {
        // Store pending task and show modal
        openDuplicateModal({ text, priority, dueDate, assignedTo, subtasks, transcription, sourceFile, reminderAt, notes, recurrence }, duplicates);
        return;
      }
    }
    // No duplicates found, create directly
    createTodoDirectly(text, priority, dueDate, assignedTo, subtasks, transcription, sourceFile, reminderAt, notes, recurrence);
  };

  // Actually create the todo (called after duplicate check or when user confirms)
  const createTodoDirectly = async (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string, subtasks?: Subtask[], transcription?: string, sourceFile?: File, reminderAt?: string, notes?: string, recurrence?: 'daily' | 'weekly' | 'monthly' | null) => {
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
      reminder_at: reminderAt,
      reminder_sent: false,
      notes: notes,
      recurrence: recurrence || undefined,
    };

    // Optimistic update using store action
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
    if (newTodo.notes) insertData.notes = newTodo.notes;
    if (newTodo.recurrence) insertData.recurrence = newTodo.recurrence;
    if (newTodo.reminder_at) {
      insertData.reminder_at = newTodo.reminder_at;
      insertData.reminder_sent = false;
    }

    const { error: insertError } = await supabase.from('todos').insert([insertData]);

    if (insertError) {
      logger.error('Error adding todo', insertError, { component: 'TodoList' });
      // Rollback optimistic update
      deleteTodoFromStore(newTodo.id);
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

      // Send rich task card notification if task is assigned to someone else (Feature 2)
      if (newTodo.assigned_to && newTodo.assigned_to !== userName) {
        sendTaskAssignmentNotification({
          taskId: newTodo.id,
          taskText: newTodo.text,
          assignedTo: newTodo.assigned_to,
          assignedBy: userName,
          dueDate: newTodo.due_date,
          priority: newTodo.priority,
          subtasks: newTodo.subtasks,
          notes: newTodo.notes,
        });
      }

      // Auto-attach source file if provided
      if (sourceFile) {
        try {
          const formData = new FormData();
          formData.append('file', sourceFile);
          formData.append('todoId', newTodo.id);
          formData.append('userName', userName);

          const response = await fetchWithCsrf('/api/attachments', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const { attachment } = await response.json();
            // Update store with the attachment
            const currentTodo = useTodoStore.getState().todos.find(t => t.id === newTodo.id);
            if (currentTodo) {
              updateTodoInStore(newTodo.id, {
                attachments: [...(currentTodo.attachments || []), attachment]
              });
            }
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
        pendingTask.sourceFile,
        pendingTask.reminderAt,
        pendingTask.notes,
        pendingTask.recurrence
      );
    }
    clearDuplicateState();
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

    // Optimistically update UI using store action
    updateTodoInStore(existingTodoId, {
      notes: combinedNotes,
      subtasks: combinedSubtasks,
      priority: higherPriority,
      due_date: finalDueDate,
    });

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
      // Rollback by restoring original values
      updateTodoInStore(existingTodoId, {
        notes: existingTodo.notes,
        subtasks: existingTodo.subtasks,
        priority: existingTodo.priority,
        due_date: existingTodo.due_date,
      });
    } else {
      // Upload source file if present
      if (pendingTask.sourceFile) {
        try {
          const formData = new FormData();
          formData.append('file', pendingTask.sourceFile);
          formData.append('todoId', existingTodoId);
          formData.append('userName', userName);

          const response = await fetchWithCsrf('/api/attachments', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const { attachment } = await response.json();
            const currentTodo = useTodoStore.getState().todos.find(t => t.id === existingTodoId);
            if (currentTodo) {
              updateTodoInStore(existingTodoId, {
                attachments: [...(currentTodo.attachments || []), attachment]
              });
            }
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

    clearDuplicateState();
  };

  // Cancel duplicate detection
  const handleCancelDuplicateDetection = () => {
    clearDuplicateState();
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

    // Optimistic update using store action
    addTodoToStore(newTodo);

    const insertData: Record<string, unknown> = {
      id: newTodo.id,
      text: newTodo.text,
      completed: false,
      status: 'todo',
      created_at: newTodo.created_at,
      created_by: newTodo.created_by,
    };

    if (newTodo.priority && newTodo.priority !== 'medium') insertData.priority = newTodo.priority;
    if (newTodo.due_date) insertData.due_date = newTodo.due_date;
    if (newTodo.assigned_to) insertData.assigned_to = newTodo.assigned_to;
    if (newTodo.notes) insertData.notes = newTodo.notes;
    if (newTodo.recurrence) insertData.recurrence = newTodo.recurrence;
    if (newTodo.subtasks && newTodo.subtasks.length > 0) insertData.subtasks = newTodo.subtasks;
    if (newTodo.transcription) insertData.transcription = newTodo.transcription;
    if (newTodo.reminder_at) insertData.reminder_at = newTodo.reminder_at;
    // Persist attachments to the duplicate's database record.
    // Note: attachment files are shared (not duplicated in storage), so deleting
    // the original task's storage files will break the duplicate's attachment links.
    if (newTodo.attachments && newTodo.attachments.length > 0) insertData.attachments = newTodo.attachments;

    const { error: insertError } = await supabase.from('todos').insert([insertData]);

    if (insertError) {
      logger.error('Error duplicating todo', insertError, { component: 'TodoList' });
      // Rollback optimistic update
      deleteTodoFromStore(newTodo.id);
    } else {
      // Send notification if the duplicated task is assigned to someone else
      if (newTodo.assigned_to && newTodo.assigned_to !== userName) {
        sendTaskAssignmentNotification({
          taskId: newTodo.id,
          taskText: newTodo.text,
          assignedTo: newTodo.assigned_to,
          assignedBy: userName,
          dueDate: newTodo.due_date,
          priority: newTodo.priority,
          notes: newTodo.notes,
        });
      }
    }
  };

  const updateStatus = async (id: string, status: TodoStatus) => {
    const oldTodo = todos.find((t) => t.id === id);
    const completed = status === 'done';
    const updated_at = new Date().toISOString();

    // Optimistic update using store action
    updateTodoInStore(id, { status, completed, updated_at });

    if (status === 'done' && oldTodo && !oldTodo.completed) {
      // Calculate streak and get next tasks for enhanced celebration
      const streakCount = calculateCompletionStreak(activityLog, userName) + 1;
      const nextTasks = getNextSuggestedTasks(todos, userName, id);
      const encouragementMessage = getEncouragementMessage(streakCount);

      const updatedTodo = { ...oldTodo, completed: true, status: 'done' as TodoStatus, updated_at };
      triggerEnhancedCelebration({
        completedTask: updatedTodo,
        nextTasks,
        streakCount,
        encouragementMessage,
      });

      // Also keep original celebration for confetti
      triggerCelebration(oldTodo.text);

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
        // Rollback optimistic update
        updateTodoInStore(id, oldTodo);
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
      subtasks: completedTodo.subtasks?.map(st => ({ ...st, completed: false })),
    };

    // Optimistic update using store action
    addTodoToStore(newTodo);

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
    if (newTodo.subtasks && newTodo.subtasks.length > 0) insertData.subtasks = newTodo.subtasks;

    const { error: insertError } = await supabase.from('todos').insert([insertData]);

    if (!insertError) {
      // Send notification for recurring task if assigned to someone else
      if (newTodo.assigned_to && newTodo.assigned_to !== userName) {
        sendTaskAssignmentNotification({
          taskId: newTodo.id,
          taskText: newTodo.text,
          assignedTo: newTodo.assigned_to,
          assignedBy: userName,
          dueDate: newTodo.due_date,
          priority: newTodo.priority,
          notes: newTodo.notes,
        });
      }
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const todoItem = todos.find(t => t.id === id);
    const updated_at = new Date().toISOString();
    // When completing a task, also set status to 'done'; when uncompleting, set to 'todo'
    const newStatus: TodoStatus = completed ? 'done' : 'todo';

    // Optimistic update using store action
    updateTodoInStore(id, { completed, status: newStatus, updated_at });

    if (completed && todoItem) {
      // Calculate streak and get next tasks for enhanced celebration
      const streakCount = calculateCompletionStreak(activityLog, userName) + 1;
      const nextTasks = getNextSuggestedTasks(todos, userName, id);
      const encouragementMessage = getEncouragementMessage(streakCount);

      const updatedTodo = { ...todoItem, completed: true, updated_at };
      triggerEnhancedCelebration({
        completedTask: updatedTodo,
        nextTasks,
        streakCount,
        encouragementMessage,
      });

      // Also keep original celebration for confetti
      triggerCelebration(todoItem.text);

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
      updateTodoInStore(id, { completed: !completed, status: revertStatus });
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
    // Optimistic delete using store action
    deleteTodoFromStore(id);
    // Remove from selection if selected
    if (selectedTodos.has(id)) {
      toggleTodoSelection(id);
    }

    const { error: deleteError } = await supabase.from('todos').delete().eq('id', id);

    if (deleteError) {
      logger.error('Error deleting todo', deleteError, { component: 'TodoList' });
      if (todoToDelete) {
        // Rollback optimistic delete
        addTodoToStore(todoToDelete);
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
    openConfirmDialog(
      'Delete Task',
      `Are you sure you want to delete "${todo?.text}"? This cannot be undone.`,
      () => {
        deleteTodo(id);
        closeConfirmDialog();
      }
    );
  };

  const assignTodo = async (id: string, assignedTo: string | null) => {
    const oldTodo = todos.find((t) => t.id === id);

    // Optimistic update using store action
    updateTodoInStore(id, { assigned_to: assignedTo || undefined });

    const { error: updateError } = await supabase
      .from('todos')
      .update({ assigned_to: assignedTo })
      .eq('id', id);

    if (updateError) {
      logger.error('Error assigning todo', updateError, { component: 'TodoList' });
      if (oldTodo) {
        // Rollback optimistic update
        updateTodoInStore(id, { assigned_to: oldTodo.assigned_to });
      }
    } else if (oldTodo && oldTodo.assigned_to !== assignedTo) {
      logActivity({
        action: 'assigned_to_changed',
        userName,
        todoId: id,
        todoText: oldTodo.text,
        details: { from: oldTodo.assigned_to || null, to: assignedTo },
      });

      // Send notification for task assignment/reassignment
      if (assignedTo) {
        // If there was a previous assignee, use reassignment notification
        if (oldTodo.assigned_to) {
          sendTaskReassignmentNotification(
            id,
            oldTodo.text,
            oldTodo.assigned_to,
            assignedTo,
            userName,
            oldTodo.priority,
            oldTodo.due_date || undefined
          );
        } else {
          // First-time assignment, use assignment notification
          sendTaskAssignmentNotification({
            taskId: id,
            taskText: oldTodo.text,
            assignedTo,
            assignedBy: userName,
            dueDate: oldTodo.due_date || undefined,
            priority: oldTodo.priority || 'medium',
            subtasks: oldTodo.subtasks,
            notes: oldTodo.notes,
          });
        }
      }
    }
  };

  const setDueDate = async (id: string, dueDate: string | null) => {
    const oldTodo = todos.find((t) => t.id === id);

    // Optimistic update using store action
    updateTodoInStore(id, { due_date: dueDate || undefined });

    const { error: updateError } = await supabase
      .from('todos')
      .update({ due_date: dueDate })
      .eq('id', id);

    if (updateError) {
      logger.error('Error setting due date', updateError, { component: 'TodoList' });
      if (oldTodo) {
        // Rollback optimistic update
        updateTodoInStore(id, { due_date: oldTodo.due_date });
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

  const setReminder = async (id: string, reminderAt: string | null) => {
    const oldTodo = todos.find((t) => t.id === id);

    // Optimistic update using store action
    updateTodoInStore(id, { reminder_at: reminderAt || undefined, reminder_sent: false });

    const { error: updateError } = await supabase
      .from('todos')
      .update({ reminder_at: reminderAt, reminder_sent: false })
      .eq('id', id);

    if (updateError) {
      logger.error('Error setting reminder', updateError, { component: 'TodoList' });
      if (oldTodo) {
        // Rollback optimistic update
        updateTodoInStore(id, { reminder_at: oldTodo.reminder_at, reminder_sent: oldTodo.reminder_sent });
      }
    } else if (oldTodo && oldTodo.reminder_at !== reminderAt) {
      logActivity({
        action: reminderAt ? 'reminder_added' : 'reminder_removed',
        userName,
        todoId: id,
        todoText: oldTodo.text,
        details: { from: oldTodo.reminder_at || null, to: reminderAt },
      });
    }
  };

  const setPriority = async (id: string, priority: TodoPriority) => {
    const oldTodo = todos.find((t) => t.id === id);

    // Optimistic update using store action
    updateTodoInStore(id, { priority });

    const { error: updateError } = await supabase
      .from('todos')
      .update({ priority })
      .eq('id', id);

    if (updateError) {
      logger.error('Error setting priority', updateError, { component: 'TodoList' });
      if (oldTodo) {
        // Rollback optimistic update
        updateTodoInStore(id, { priority: oldTodo.priority });
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

    // Optimistic update using store action
    updateTodoInStore(id, { notes });

    const { error: updateError } = await supabase
      .from('todos')
      .update({ notes })
      .eq('id', id);

    if (updateError) {
      logger.error('Error updating notes', updateError, { component: 'TodoList' });
      if (oldTodo) {
        // Rollback optimistic update
        updateTodoInStore(id, { notes: oldTodo.notes });
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

    // Optimistic update using store action
    updateTodoInStore(id, { text });

    const { error: updateError } = await supabase
      .from('todos')
      .update({ text })
      .eq('id', id);

    if (updateError) {
      logger.error('Error updating text', updateError, { component: 'TodoList' });
      if (oldTodo) {
        // Rollback optimistic update
        updateTodoInStore(id, { text: oldTodo.text });
      }
    }
  };

  const setRecurrence = async (id: string, recurrence: RecurrencePattern) => {
    const oldTodo = todos.find((t) => t.id === id);

    // Optimistic update using store action
    updateTodoInStore(id, { recurrence });

    const { error: updateError } = await supabase
      .from('todos')
      .update({ recurrence })
      .eq('id', id);

    if (updateError) {
      logger.error('Error setting recurrence', updateError, { component: 'TodoList' });
      if (oldTodo) {
        // Rollback optimistic update
        updateTodoInStore(id, { recurrence: oldTodo.recurrence });
      }
    }
  };

  const updateSubtasks = async (id: string, subtasks: Subtask[]) => {
    const oldTodo = todos.find((t) => t.id === id);

    // Optimistic update using store action
    updateTodoInStore(id, { subtasks });

    const { error: updateError } = await supabase
      .from('todos')
      .update({ subtasks })
      .eq('id', id);

    if (updateError) {
      logger.error('Error updating subtasks', updateError, { component: 'TodoList' });
      if (oldTodo) {
        // Rollback optimistic update
        updateTodoInStore(id, { subtasks: oldTodo.subtasks });
      }
    }
  };

  const updateAttachments = async (id: string, attachments: Attachment[], skipDbUpdate = false) => {
    const oldTodo = todos.find((t) => t.id === id);

    // Optimistic update using store action
    updateTodoInStore(id, { attachments });

    // Skip database update if the API already handled it (e.g., after delete or upload)
    if (!skipDbUpdate) {
      const { error: updateError } = await supabase
        .from('todos')
        .update({ attachments })
        .eq('id', id);

      if (updateError) {
        logger.error('Error updating attachments', updateError, { component: 'TodoList' });
        if (oldTodo) {
          // Rollback optimistic update
          updateTodoInStore(id, { attachments: oldTodo.attachments });
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

    const response = await fetchWithCsrf('/api/templates', {
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

  // Bulk action wrappers (use hook functions with confirmation dialog integration)
  const bulkDelete = () => {
    hookBulkDelete((count, action) => {
      openConfirmDialog(
        'Delete Tasks',
        `Are you sure you want to delete ${count} task${count > 1 ? 's' : ''}? This cannot be undone.`,
        async () => {
          await action();
          closeConfirmDialog();
        }
      );
    });
  };

  // Direct wrappers for hook bulk actions
  const bulkAssign = hookBulkAssign;
  const bulkComplete = hookBulkComplete;
  const bulkReschedule = hookBulkReschedule;

  // Merge selected todos into one
  const initiateMerge = () => {
    if (selectedTodos.size < 2) return;
    const todosToMerge = todos.filter(t => selectedTodos.has(t.id));
    openMergeModal(todosToMerge);
  };

  const mergeTodos = async (primaryTodoId: string) => {
    if (mergeTargets.length < 2 || isMerging) return;

    const primaryTodo = mergeTargets.find(t => t.id === primaryTodoId);
    const secondaryTodos = mergeTargets.filter(t => t.id !== primaryTodoId);

    if (!primaryTodo) return;

    setMergingState(true);

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
        setMergingState(false);
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
        refreshTodos();
        setMergingState(false);
        return;
      }

      // Update UI after successful DB operations using store actions
      // First update the primary todo
      updateTodoInStore(primaryTodoId, {
        text: combinedText,
        notes: combinedNotes,
        attachments: combinedAttachments,
        subtasks: combinedSubtasks,
        priority: highestPriority,
      });
      // Then delete the secondary todos
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

      // Clear selection and close modal
      clearSelection();
      setShowBulkActions(false);
      closeMergeModal();
    } catch (error) {
      logger.error('Error during merge', error, { component: 'TodoList' });
      alert('An unexpected error occurred. Please try again.');
      refreshTodos();
    } finally {
      setMergingState(false);
    }
  };

  // Selection handlers that adapt hook functions to component usage
  const handleSelectTodo = hookHandleSelectTodo;

  // Archived todos filtering (uses filterArchivedTodos from useFilters hook)
  const filteredArchivedTodos = useMemo(() => {
    return filterArchivedTodos(archiveQuery);
  }, [filterArchivedTodos, archiveQuery]);

  // Final filtered and sorted todos (uses hook result, applies custom order if needed)
  const filteredAndSortedTodos = useMemo(() => {
    // Custom order sorting is handled separately since it's component-specific state
    if (sortOption === 'custom' && customOrder.length > 0) {
      const result = [...hookFilteredTodos];
      result.sort((a, b) => {
        const aIndex = customOrder.indexOf(a.id);
        const bIndex = customOrder.indexOf(b.id);
        // Items not in custom order go to the end
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
      return result;
    }
    return hookFilteredTodos;
  }, [hookFilteredTodos, sortOption, customOrder]);

  // Stats - calculate based on filter context for dynamic counts
  // Create a Map of todos by ID for efficient lookup (used by ChatPanel for TaskAssignmentCards)
  const todosMap = useMemo(() => new Map(todos.map(t => [t.id, t])), [todos]);

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
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  return (
    <PullToRefresh onRefresh={refreshTodos} darkMode={darkMode}>
      <div className="min-h-screen transition-colors bg-[var(--background)]">
        {/* Skip link for accessibility */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:z-50">
          Skip to main content
        </a>

        {/* Unified Header - single row with integrated search */}
        {/* NOTE: Activity, Archive, Strategic Goals now in NavigationSidebar */}
        <TodoHeader
          currentUser={currentUser}
          onUserChange={onUserChange}
          viewMode={viewMode}
          setViewMode={setViewMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showAdvancedFilters={showAdvancedFilters}
          setShowAdvancedFilters={setShowAdvancedFilters}
          onResetFilters={() => {
            setQuickFilter('all');
            setShowCompleted(false);
            setHighPriorityOnly(false);
            setSearchQuery('');
            setStatusFilter('all');
            setAssignedToFilter('all');
            setCustomerFilter('all');
            setHasAttachmentsFilter(null);
            setDateRangeFilter({ start: '', end: '' });
          }}
        />

      {/* Connection status - floating indicator (bottom right) - hidden in focus mode */}
      {!focusMode && <ConnectionStatus connected={connected} />}

      {/* Exit Focus Mode button - shown only in focus mode */}
      <ExitFocusModeButton />

      {/* Content Layout - Single column, calm layout */}
      <div className={`
        flex transition-all duration-300 ease-out min-h-[calc(100vh-72px)]
        ${focusMode ? '' : ''}
      `}>
        {/* NOTE: UtilitySidebar removed - navigation now via AppShell sidebar
            The left sidebar in NavigationSidebar handles quick filters and navigation */}

      {/* Main */}
      <main id="main-content" className="flex-1 min-w-0 mx-auto px-4 sm:px-6 py-6 w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl">
        {/* Context label when filtered - hidden in focus mode */}
        {!focusMode && (quickFilter !== 'all' || highPriorityOnly) && (
          <div className="text-xs text-[var(--text-muted)] mb-2 flex items-center gap-2">
            <span>Showing:</span>
            {quickFilter === 'my_tasks' && <span className="font-medium text-[var(--accent)]">My Tasks</span>}
            {quickFilter === 'due_today' && <span className="font-medium text-[var(--warning)]">Due Today</span>}
            {quickFilter === 'overdue' && <span className="font-medium text-[var(--danger)]">Overdue</span>}
            {quickFilter === 'all' && highPriorityOnly && <span className="font-medium text-[var(--danger)]">All Tasks</span>}
            {highPriorityOnly && <span className="text-[var(--danger)]">• High Priority Only</span>}
          </div>
        )}

        {/* Compact Status Line - hidden in focus mode */}
        {!focusMode && (
          <div className="mb-4">
            <StatusLine
              stats={stats}
              quickFilter={quickFilter}
              highPriorityOnly={highPriorityOnly}
              showCompleted={showCompleted}
              onFilterAll={() => { setQuickFilter('all'); setShowCompleted(false); }}
              onFilterDueToday={() => setQuickFilter('due_today')}
              onFilterOverdue={() => setQuickFilter('overdue')}
            />
          </div>
        )}

        {/* Add Task Button - opens modal */}
        <div className="mb-4">
          <button
            onClick={() => setShowAddTaskModal(true)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm
              bg-[var(--accent)] text-white
              hover:bg-[var(--accent)]/90 active:scale-[0.98]
              transition-all duration-150 shadow-sm hover:shadow
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        </div>

        {/* Compact Filter Bar - hidden in focus mode */}
        {!focusMode && (
        <div className="mb-4">
          {/* Single Row: All filters, sort, select (search moved to header) */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Quick filter dropdown - compact */}
            <div className="relative">
              <select
                value={quickFilter}
                onChange={(e) => setQuickFilter(e.target.value as QuickFilter)}
                className="appearance-none pl-2 pr-6 py-1.5 text-xs font-medium rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] cursor-pointer hover:bg-[var(--surface-3)] transition-colors"
              >
                <option value="all">All</option>
                <option value="my_tasks">Mine</option>
                <option value="due_today">Today</option>
                <option value="overdue">Overdue</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-[var(--text-muted)]" />
            </div>

            {/* High Priority toggle - icon only on mobile */}
            <button
              type="button"
              onClick={() => setHighPriorityOnly(!highPriorityOnly)}
              className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                highPriorityOnly
                  ? 'bg-[var(--danger)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] border border-[var(--border)]'
              }`}
              aria-pressed={highPriorityOnly}
              title="High Priority"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Urgent</span>
            </button>

            {/* Show completed toggle - icon only on mobile */}
            <button
              type="button"
              onClick={() => setShowCompleted(!showCompleted)}
              className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                showCompleted
                  ? 'bg-[var(--success)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] border border-[var(--border)]'
              }`}
              aria-pressed={showCompleted}
              title="Show Completed"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Done</span>
            </button>

            {/* More filters button */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                showAdvancedFilters || statusFilter !== 'all' || assignedToFilter !== 'all' || customerFilter !== 'all' || hasAttachmentsFilter !== null || dateRangeFilter.start || dateRangeFilter.end
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] border border-[var(--border)]'
              }`}
              aria-expanded={showAdvancedFilters}
              title="More Filters"
            >
              <Filter className="w-3.5 h-3.5" />
              {(statusFilter !== 'all' || assignedToFilter !== 'all' || customerFilter !== 'all' || hasAttachmentsFilter !== null || dateRangeFilter.start || dateRangeFilter.end) && (
                <span className="px-1 py-0.5 text-[10px] rounded-full bg-white/20 leading-none">
                  {[statusFilter !== 'all', assignedToFilter !== 'all', customerFilter !== 'all', hasAttachmentsFilter !== null, dateRangeFilter.start || dateRangeFilter.end].filter(Boolean).length}
                </span>
              )}
            </button>

            {/* Sort dropdown - compact */}
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                aria-label="Sort tasks"
                className="appearance-none pl-2 pr-6 py-1.5 text-xs font-medium rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] cursor-pointer hover:bg-[var(--surface-3)] transition-colors"
              >
                <option value="created">New</option>
                <option value="due_date">Due</option>
                <option value="priority">Priority</option>
                <option value="urgency">Urgency</option>
                <option value="alphabetical">A-Z</option>
                <option value="custom">Manual</option>
              </select>
              <ArrowUpDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-[var(--text-muted)]" />
            </div>

            {/* More dropdown - contains Templates, Select, and Sections */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreDropdown(!showMoreDropdown)}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                  showMoreDropdown || showBulkActions || useSectionedView
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] border border-[var(--border)]'
                }`}
                aria-expanded={showMoreDropdown}
                aria-haspopup="menu"
                title="More options"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">More</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showMoreDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showMoreDropdown && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreDropdown(false)} />

                  {/* Dropdown */}
                  <div className={`absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg border z-50 overflow-hidden ${
                    darkMode ? 'bg-[var(--surface)] border-[var(--border)]' : 'bg-white border-slate-200'
                  }`}>
                    {/* Templates button */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreDropdown(false);
                        setShowTemplatePicker(true);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                        darkMode ? 'hover:bg-[var(--surface-2)] text-[var(--foreground)]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                      <span>Templates</span>
                    </button>

                    {/* Select/Bulk actions button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (showBulkActions) {
                          clearSelection();
                        }
                        setShowBulkActions(!showBulkActions);
                        setShowMoreDropdown(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                        showBulkActions
                          ? 'bg-[var(--brand-sky)]/10 text-[var(--brand-sky)]'
                          : darkMode ? 'hover:bg-[var(--surface-2)] text-[var(--foreground)]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <CheckSquare className="w-4 h-4 text-[var(--text-muted)]" />
                      <span>{showBulkActions ? 'Cancel Selection' : 'Select Tasks'}</span>
                    </button>

                    {/* Sections Toggle - Show in both list and board views when not using custom sort */}
                    {shouldUseSections && (
                      <button
                        type="button"
                        onClick={() => {
                          setUseSectionedView(!useSectionedView);
                          setShowMoreDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                          useSectionedView
                            ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                            : darkMode ? 'hover:bg-[var(--surface-2)] text-[var(--foreground)]' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                        aria-pressed={useSectionedView}
                      >
                        <Layers className="w-4 h-4 text-[var(--text-muted)]" />
                        <span>Sections</span>
                        {useSectionedView && <Check className="w-3.5 h-3.5 ml-auto" />}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Template Picker - controlled from More dropdown */}
            <div className="relative">
              <TemplatePicker
                currentUserName={userName}
                users={users}
                darkMode={darkMode}
                isOpen={showTemplatePicker}
                onOpenChange={setShowTemplatePicker}
                hideTrigger={true}
                onSelectTemplate={(text, priority, assignedTo, subtasks) => {
                  addTodo(text, priority, undefined, assignedTo, subtasks);
                  setShowTemplatePicker(false);
                }}
              />
            </div>

            {/* Clear all - only when filters active */}
            {(quickFilter !== 'all' || highPriorityOnly || showCompleted || searchQuery || statusFilter !== 'all' || assignedToFilter !== 'all' || customerFilter !== 'all' || hasAttachmentsFilter !== null || dateRangeFilter.start || dateRangeFilter.end) && (
              <button
                type="button"
                onClick={() => {
                  setQuickFilter('all');
                  setHighPriorityOnly(false);
                  setShowCompleted(false);
                  setSearchQuery('');
                  setStatusFilter('all');
                  setAssignedToFilter('all');
                  setCustomerFilter('all');
                  setHasAttachmentsFilter(null);
                  setDateRangeFilter({ start: '', end: '' });
                }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-[var(--accent)] hover:text-[var(--accent-dark)] font-medium"
                title="Clear all filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>

          {/* Selection mode hint */}
          {showBulkActions && (
            <div className="mt-2 text-xs text-[var(--text-muted)]">
              Click tasks to select them
            </div>
          )}

          {/* Advanced Filters Panel - expandable */}
          <AnimatePresence>
            {showAdvancedFilters && (
              <motion.div
                initial={prefersReducedMotion() ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DURATION.normal }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {/* Status filter */}
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--text-light)] mb-1">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as TodoStatus | 'all')}
                      className="w-full text-xs py-1.5 px-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)]"
                    >
                      <option value="all">All</option>
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>

                  {/* Assigned to filter */}
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--text-light)] mb-1">Assigned</label>
                    <select
                      value={assignedToFilter}
                      onChange={(e) => setAssignedToFilter(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)]"
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
                    <label className="block text-[10px] font-medium text-[var(--text-light)] mb-1">Customer</label>
                    <select
                      value={customerFilter}
                      onChange={(e) => setCustomerFilter(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)]"
                    >
                      <option value="all">All</option>
                      {uniqueCustomers.map((customer) => (
                        <option key={customer} value={customer}>{customer}</option>
                      ))}
                    </select>
                  </div>

                  {/* Has attachments filter */}
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--text-light)] mb-1">Attachments</label>
                    <select
                      value={hasAttachmentsFilter === null ? 'all' : hasAttachmentsFilter ? 'yes' : 'no'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHasAttachmentsFilter(val === 'all' ? null : val === 'yes');
                      }}
                      className="w-full text-xs py-1.5 px-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)]"
                    >
                      <option value="all">Any</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  {/* Date range filter */}
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--text-light)] mb-1">Due Range</label>
                    <div className="flex gap-1">
                      <input
                        type="date"
                        value={dateRangeFilter.start}
                        onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, start: e.target.value })}
                        className="flex-1 text-xs py-1.5 px-1 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] min-w-0"
                      />
                      <input
                        type="date"
                        value={dateRangeFilter.end}
                        onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, end: e.target.value })}
                        className="flex-1 text-xs py-1.5 px-1 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] min-w-0"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* List or Kanban - with smooth view transition */}
        <AnimatePresence mode="wait" initial={false}>
          {viewMode === 'list' ? (
            <motion.div
              key="list-view"
              initial={prefersReducedMotion() ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion() ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: DURATION.fast }}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredAndSortedTodos.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {/* Render sectioned view or flat list based on toggle */}
                  {useSectionedView && shouldUseSections ? (
                    <TaskSections
                      todos={filteredAndSortedTodos}
                      users={users}
                      currentUserName={userName}
                      selectedTodos={selectedTodos}
                      showBulkActions={showBulkActions}
                      onSelectTodo={showBulkActions ? handleSelectTodo : undefined}
                      onToggle={toggleTodo}
                      onDelete={confirmDeleteTodo}
                      onAssign={assignTodo}
                      onSetDueDate={setDueDate}
                      onSetReminder={setReminder}
                      onSetPriority={setPriority}
                      onStatusChange={updateStatus}
                      onUpdateText={updateText}
                      onDuplicate={duplicateTodo}
                      onUpdateNotes={updateNotes}
                      onSetRecurrence={setRecurrence}
                      onUpdateSubtasks={updateSubtasks}
                      onUpdateAttachments={updateAttachments}
                      onSaveAsTemplate={(t) => openTemplateModal(t)}
                      onEmailCustomer={(todo) => {
                        openEmailModal([todo]);
                      }}
                      isDragEnabled={!showBulkActions && sortOption === 'custom'}
                      renderTodoItem={(todo, index) => (
                        <motion.div
                          key={todo.id}
                          layout={!prefersReducedMotion()}
                          variants={prefersReducedMotion() ? undefined : listItemVariants}
                          initial={prefersReducedMotion() ? false : 'hidden'}
                          animate="visible"
                          exit="exit"
                          transition={{
                            layout: { type: 'spring', stiffness: 350, damping: 25 },
                            delay: Math.min(index * 0.02, 0.1),
                          }}
                        >
                          <SortableTodoItem
                            todo={todo}
                            users={users}
                            currentUserName={userName}
                            selected={selectedTodos.has(todo.id)}
                            autoExpand={todo.id === selectedTaskId}
                            onAutoExpandHandled={onSelectedTaskHandled}
                            onSelect={showBulkActions ? handleSelectTodo : undefined}
                            onToggle={toggleTodo}
                            onDelete={confirmDeleteTodo}
                            onAssign={assignTodo}
                            onSetDueDate={setDueDate}
                            onSetReminder={setReminder}
                            onSetPriority={setPriority}
                            onStatusChange={updateStatus}
                            onUpdateText={updateText}
                            onDuplicate={duplicateTodo}
                            onUpdateNotes={updateNotes}
                            onSetRecurrence={setRecurrence}
                            onUpdateSubtasks={updateSubtasks}
                            onUpdateAttachments={updateAttachments}
                            onSaveAsTemplate={(t) => openTemplateModal(t)}
                            onEmailCustomer={(todo) => {
                              openEmailModal([todo]);
                            }}
                            isDragEnabled={!showBulkActions && sortOption === 'custom'}
                          />
                        </motion.div>
                      )}
                      emptyState={
                        <motion.div
                          key="empty-state"
                          initial={prefersReducedMotion() ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: DURATION.fast }}
                        >
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
                        </motion.div>
                      }
                    />
                  ) : (
                    /* Flat list view (original behavior) */
                    <div className="space-y-2" role="list" aria-label="Task list">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {filteredAndSortedTodos.length === 0 ? (
                          <motion.div
                            key="empty-state"
                            initial={prefersReducedMotion() ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: DURATION.fast }}
                          >
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
                          </motion.div>
                        ) : (
                          filteredAndSortedTodos.map((todo, index) => (
                            <motion.div
                              key={todo.id}
                              layout={!prefersReducedMotion()}
                              variants={prefersReducedMotion() ? undefined : listItemVariants}
                              initial={prefersReducedMotion() ? false : 'hidden'}
                              animate="visible"
                              exit="exit"
                              transition={{
                                layout: { type: 'spring', stiffness: 350, damping: 25 },
                                delay: Math.min(index * 0.02, 0.1),
                              }}
                            >
                              <SortableTodoItem
                                todo={todo}
                                users={users}
                                currentUserName={userName}
                                selected={selectedTodos.has(todo.id)}
                                autoExpand={todo.id === selectedTaskId}
                                onAutoExpandHandled={onSelectedTaskHandled}
                                onSelect={showBulkActions ? handleSelectTodo : undefined}
                                onToggle={toggleTodo}
                                onDelete={confirmDeleteTodo}
                                onAssign={assignTodo}
                                onSetDueDate={setDueDate}
                                onSetReminder={setReminder}
                                onSetPriority={setPriority}
                                onStatusChange={updateStatus}
                                onUpdateText={updateText}
                                onDuplicate={duplicateTodo}
                                onUpdateNotes={updateNotes}
                                onSetRecurrence={setRecurrence}
                                onUpdateSubtasks={updateSubtasks}
                                onUpdateAttachments={updateAttachments}
                                onSaveAsTemplate={(t) => openTemplateModal(t)}
                                onEmailCustomer={(todo) => {
                                  openEmailModal([todo]);
                                }}
                                isDragEnabled={!showBulkActions && sortOption === 'custom'}
                              />
                            </motion.div>
                          ))
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </SortableContext>
              </DndContext>
            </motion.div>
          ) : (
            <motion.div
              key="kanban-view"
              initial={prefersReducedMotion() ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion() ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: DURATION.fast }}
            >
              <KanbanBoard
                todos={filteredAndSortedTodos}
                users={users}
                darkMode={darkMode}
                currentUserName={userName}
                onStatusChange={updateStatus}
                onDelete={confirmDeleteTodo}
                onAssign={assignTodo}
                onSetDueDate={setDueDate}
                onSetReminder={setReminder}
                onSetPriority={setPriority}
                onUpdateNotes={updateNotes}
                onUpdateText={updateText}
                onUpdateSubtasks={updateSubtasks}
                onToggle={toggleTodo}
                onDuplicate={duplicateTodo}
                onSetRecurrence={setRecurrence}
                onUpdateAttachments={updateAttachments}
                onSaveAsTemplate={(t) => openTemplateModal(t)}
                onEmailCustomer={(todo) => {
                  openEmailModal([todo]);
                }}
                showBulkActions={showBulkActions}
                selectedTodos={selectedTodos}
                onSelectTodo={handleSelectTodo}
                useSectionedView={useSectionedView}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keyboard shortcuts hint - hidden in focus mode */}
        {!focusMode && (
          <button
            onClick={() => openShortcuts()}
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
        )}
      </main>

      </div>{/* End content layout flex container */}

      {/* NOTE: Chat moved to dedicated navigation view - no longer floating widget
          Access chat via the "Messages" item in the navigation sidebar */}

      <CelebrationEffect
        show={showCelebration}
        onComplete={() => dismissCelebration()}
        taskText={celebrationText}
      />

      <ProgressSummary
        show={showProgressSummary}
        onClose={() => closeProgressSummary()}
        todos={todos}
        currentUser={currentUser}
        onUserUpdate={onUserChange}
      />

      <WelcomeBackNotification
        show={showWelcomeBack}
        onClose={() => closeWelcomeBack()}
        onViewProgress={() => openProgressSummary()}
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
        onCancel={() => closeConfirmDialog()}
      />

      {/* Note: WeeklyProgressChart and KeyboardShortcutsModal are rendered in MainApp.tsx
          using AppShell context state, so they're accessible from any view */}

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onAdd={addTodo}
        users={users}
        darkMode={darkMode}
        currentUserId={currentUser.id}
      />

      {/* Activity Feed - Full Page View */}
      {showActivityFeed && (
        <div ref={activityFeedRef} className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-label="Activity Feed">
          {/* Full-page container with proper spacing for navigation */}
          <div className={`flex-1 flex flex-col ${darkMode ? 'bg-[var(--background)]' : 'bg-[var(--background)]'}`}>
            {/* Header with back button */}
            <div className={`px-4 sm:px-6 py-4 border-b flex items-center gap-4 ${darkMode ? 'border-[var(--border)] bg-[var(--surface)]' : 'border-[var(--border)] bg-white'}`}>
              <button
                onClick={() => { closeActivityFeed(); setActiveView('tasks'); }}
                className={`p-2 -ml-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-[var(--surface-2)] text-[var(--text-muted)]' : 'hover:bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                aria-label="Back to tasks"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                  Activity Monitor
                </h1>
                <p className={`text-sm ${darkMode ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]'}`}>
                  Track all changes across your tasks
                </p>
              </div>
            </div>
            
            {/* Activity Feed Content - Centered container for readability */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full max-w-4xl mx-auto">
                <ActivityFeed
                  currentUserName={userName}
                  darkMode={darkMode}
                  onClose={() => { closeActivityFeed(); setActiveView('tasks'); }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Strategic Dashboard - Owner only */}
      {showStrategicDashboard && isOwner({ name: userName, role: currentUser?.role }) && (
        <StrategicDashboard
          userName={userName}
          darkMode={darkMode}
          onClose={() => { closeStrategicDashboard(); setActiveView('tasks'); }}
        />
      )}

      {showArchiveView && canViewArchive && (
        <div ref={archiveModalRef} className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Archived tasks">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { closeArchiveView(); setActiveView('tasks'); }}
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
                onClick={() => { closeArchiveView(); setActiveView('tasks'); }}
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
                        onClick={() => selectArchivedTodo(todo)}
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
          onClose={() => selectArchivedTodo(null)}
        />
      )}

      {/* Save Template Modal */}
      <AnimatePresence>
        {templateTodo && (
          <SaveTemplateModal
            todo={templateTodo}
            darkMode={darkMode}
            onClose={() => closeTemplateModal()}
            onSave={saveAsTemplate}
          />
        )}
      </AnimatePresence>

      {/* Merge Tasks Modal */}
      {showMergeModal && mergeTargets.length >= 2 && (
        <div ref={mergeModalRef} className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Merge Tasks">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!isMerging) {
                closeMergeModal();
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
                    onClick={() => setMergePrimaryId(todo.id)}
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
                    closeMergeModal();
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
          duplicates={duplicateMatches}
          onCreateAnyway={handleCreateTaskAnyway}
          onAddToExisting={handleAddToExistingTask}
          onCancel={handleCancelDuplicateDetection}
        />
      )}

      {/* Customer Email Modal */}
      <AnimatePresence>
        {showEmailModal && emailTargetTodos.length > 0 && (
          <CustomerEmailModal
            todos={emailTargetTodos}
            currentUser={currentUser}
            onClose={() => {
              closeEmailModal();
            }}
            darkMode={darkMode}
          />
        )}
      </AnimatePresence>

      {/* Enhanced Celebration Modal (Feature 3) */}
      {showEnhancedCelebration && celebrationData && (
        <CompletionCelebration
          celebrationData={celebrationData}
          onDismiss={() => {
            dismissEnhancedCelebration();
          }}
          onNextTaskClick={(taskId) => {
            dismissEnhancedCelebration();
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
            openCompletionSummary(celebrationData.completedTask);
          }}
        />
      )}

      {/* Task Completion Summary Modal (Feature 1) */}
      {showCompletionSummary && completedTaskForSummary && (
        <TaskCompletionSummary
          todo={completedTaskForSummary}
          completedBy={userName}
          onClose={() => {
            closeCompletionSummary();
          }}
        />
      )}

      {/* Floating Bulk Action Bar - Sticky at bottom */}
      {showBulkActions && selectedTodos.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 animate-in slide-in-from-bottom duration-300">
          <div className="bg-[var(--surface)] border-t border-[var(--border)] shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
            <div className={`mx-auto px-4 sm:px-6 py-3 ${viewMode === 'kanban' ? 'max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]' : 'max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl'}`}>
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

      {/* NOTE: ChatPanel removed from task view - access via navigation sidebar "Messages" */}

      {/* Bottom Tabs for Mobile Navigation - hidden in focus mode */}
      {!focusMode && (
        <BottomTabs
          stats={stats}
          quickFilter={quickFilter}
          showCompleted={showCompleted}
          onFilterChange={setQuickFilter}
          onShowCompletedChange={setShowCompleted}
        />
      )}

      {/* Spacer for bottom tabs on mobile - hidden in focus mode */}
      {!focusMode && <div className="h-16 md:hidden" />}
      </div>
    </PullToRefresh>
  );
}
