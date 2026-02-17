'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import TodoList from './TodoList';
import { shouldShowDailyDashboard, markDailyDashboardShown } from '@/lib/dashboardUtils';
import { DashboardModalSkeleton, ChatPanelSkeleton, AIInboxSkeleton, WeeklyProgressChartSkeleton } from './LoadingSkeletons';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthUser, Todo, QuickFilter, ActivityLogEntry } from '@/types/todo';
import { AIInboxItem } from './views/AIInbox';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import { AppShell, useAppShell, ActiveView } from './layout';
import { useTodoStore } from '@/store/todoStore';
import { ErrorBoundary } from './ErrorBoundary';
import NotificationPermissionBanner from './NotificationPermissionBanner';

// Lazy load DashboardModal for better initial load performance
const DashboardModal = dynamic(() => import('./DashboardModal'), {
  ssr: false,
  loading: () => <DashboardModalSkeleton />,
});

// Lazy load ChatView for the dedicated messages view
const ChatView = dynamic(() => import('./views/ChatView'), {
  ssr: false,
  loading: () => <ChatPanelSkeleton />,
});

// Lazy load AIInbox for the AI-derived items review
const AIInbox = dynamic(() => import('./views/AIInbox'), {
  ssr: false,
  loading: () => <AIInboxSkeleton />,
});

// Lazy load DashboardPage for the full dashboard view
const DashboardPage = dynamic(() => import('./views/DashboardPage'), {
  ssr: false,
  loading: () => <DashboardModalSkeleton />,
});

// Lazy load WeeklyProgressChart modal (accessible from any view via sidebar)
const WeeklyProgressChart = dynamic(() => import('./WeeklyProgressChart'), {
  ssr: false,
  loading: () => <WeeklyProgressChartSkeleton />,
});

// Lazy load KeyboardShortcutsModal (accessible from any view via sidebar)
const KeyboardShortcutsModal = dynamic(() => import('./KeyboardShortcutsModal'), {
  ssr: false,
  loading: () => null,
});

// Lazy load ProjectDashboard for the projects view
const ProjectDashboard = dynamic(() => import('./ProjectDashboard'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" /></div>,
});

// Lazy load ArchiveView for the archive browser
const ArchiveView = dynamic(() => import('./ArchiveView'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" /></div>,
});

// Lazy load ManuscriptPipelineView for the dedicated pipeline view
const ManuscriptPipelineView = dynamic(() => import('./ManuscriptPipelineView'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" /></div>,
});

// Lazy load GanttView for timeline visualization
const GanttView = dynamic(() => import('./GanttView'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" /></div>,
});

// Lazy load EquipmentCalendar for lab equipment booking
const EquipmentCalendar = dynamic(() => import('./EquipmentCalendar'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" /></div>,
});

// Lazy load IntegrationsPage for settings (Google Calendar, Zotero, ORCID, SSO)
const IntegrationsPage = dynamic(() => import('./IntegrationsPage'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" /></div>,
});

interface MainAppProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
}

/**
 * MainAppContent - Inner component that uses AppShell context
 */
function MainAppContent({ currentUser, onUserChange }: MainAppProps) {
  const {
    activeView,
    setActiveView,
    onNewTaskTrigger,
    showWeeklyChart,
    closeWeeklyChart,
    showShortcuts,
    closeShortcuts,
  } = useAppShell();
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const usersWithColors = useTodoStore((state) => state.usersWithColors);
  const users = useTodoStore((state) => state.users);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialFilter, setInitialFilter] = useState<QuickFilter | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  // Initialize showDashboard to false - we'll check for daily show AFTER data loads
  const [showDashboard, setShowDashboard] = useState(false);
  const [hasCheckedDailyDashboard, setHasCheckedDailyDashboard] = useState(false);
  // Track which task to auto-expand when navigating from dashboard/notifications
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // AI Inbox state
  const [aiInboxItems, setAiInboxItems] = useState<AIInboxItem[]>([]);
  const [aiInboxLoading, setAiInboxLoading] = useState(false);

  // Fetch todos
  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      try {
        const [todosResult, activityResult] = await Promise.all([
          supabase
            .from('todos')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('activity_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200),
        ]);

        if (todosResult.data) {
          setTodos(todosResult.data);
        }
        if (activityResult.data) {
          setActivityLog(activityResult.data as ActivityLogEntry[]);
        }
      } catch (error) {
        logger.error('Failed to fetch data', error, { component: 'MainApp' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up realtime subscription for todos
    const channel = supabase
      .channel('dashboard-todos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTodos(prev => [payload.new as Todo, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setTodos(prev => prev.map(t => t.id === payload.new.id ? payload.new as Todo : t));
        } else if (payload.eventType === 'DELETE') {
          setTodos(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch AI inbox suggestions from the patterns API
  const fetchAISuggestions = useCallback(async () => {
    setAiInboxLoading(true);
    try {
      const res = await fetch('/api/patterns/suggestions');
      if (!res.ok) {
        logger.error('Failed to fetch AI suggestions', new Error(`HTTP ${res.status}`), { component: 'MainApp' });
        return;
      }
      const data = await res.json();
      const patterns = data.patterns || {};
      const items: AIInboxItem[] = [];

      for (const [category, patternList] of Object.entries(patterns)) {
        if (!Array.isArray(patternList)) continue;
        for (const pattern of patternList) {
          items.push({
            id: pattern.id || `suggestion-${items.length}`,
            type: 'document' as const,
            source: {
              label: `Pattern: ${category}`,
              preview: pattern.pattern_text || pattern.text || '',
              receivedAt: pattern.created_at || new Date().toISOString(),
            },
            proposedTask: {
              text: pattern.pattern_text || pattern.text || 'Suggested task',
              priority: pattern.priority || 'medium',
              dueDate: pattern.due_date || undefined,
              assignedTo: pattern.assigned_to || undefined,
            },
            confidence: Math.min((pattern.occurrence_count || 1) / 10, 1),
            status: 'pending',
            createdAt: pattern.created_at || new Date().toISOString(),
          });
        }
      }

      setAiInboxItems(items);
    } catch (error) {
      logger.error('Failed to fetch AI suggestions', error, { component: 'MainApp' });
    } finally {
      setAiInboxLoading(false);
    }
  }, []);

  // Fetch AI suggestions on mount
  useEffect(() => {
    fetchAISuggestions();
  }, [fetchAISuggestions]);

  // Listen for 'apply-quick-filter' custom events dispatched by CommandPalette
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<QuickFilter>;
      if (customEvent.detail) {
        useTodoStore.getState().setQuickFilter(customEvent.detail);
      }
    };
    window.addEventListener('apply-quick-filter', handler);
    return () => window.removeEventListener('apply-quick-filter', handler);
  }, []);

  // Check if we should show daily dashboard on first login of the day
  // Only check ONCE after initial data load - prevents flash on hard refresh
  useEffect(() => {
    if (!loading && !hasCheckedDailyDashboard) {
      setHasCheckedDailyDashboard(true);
      if (shouldShowDailyDashboard()) {
        markDailyDashboardShown(); // Mark BEFORE showing to prevent duplicates
        setShowDashboard(true);
      }
    }
  }, [loading, hasCheckedDailyDashboard]);

  const handleNavigateToTasks = useCallback((filter?: QuickFilter) => {
    if (filter) {
      setInitialFilter(filter);
    }
    // Clear any stale selected task to prevent auto-expanding an unrelated task
    setSelectedTaskId(null);
    setShowDashboard(false);
    setActiveView('tasks');
  }, [setActiveView]);

  const handleAddTask = useCallback(() => {
    setShowAddTask(true);
    // Clear any stale selected task
    setSelectedTaskId(null);
    setShowDashboard(false);
    setActiveView('tasks');
  }, [setActiveView]);

  const handleOpenDashboard = useCallback(() => {
    setShowDashboard(true);
  }, []);

  // Reset the add task trigger after modal opens
  const handleAddTaskModalOpened = useCallback(() => {
    setShowAddTask(false);
  }, []);

  // Reset the initial filter after it's applied
  const handleInitialFilterApplied = useCallback(() => {
    setInitialFilter(null);
  }, []);

  // Handle task link click from chat/dashboard/notifications (navigate to tasks view and open task)
  const handleTaskLinkClick = useCallback((taskId: string) => {
    setActiveView('tasks');
    // Set the selected task ID to trigger auto-expand in TodoItem
    setSelectedTaskId(taskId);
    // Small delay to allow view switch, then scroll to task
    setTimeout(() => {
      const taskElement = document.getElementById(`todo-${taskId}`);
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add animated highlight class
        taskElement.classList.add('notification-highlight');
        // Remove the class after animation completes
        setTimeout(() => {
          taskElement.classList.remove('notification-highlight');
        }, 3000);
      }
    }, 150);
  }, [setActiveView]);

  // Clear selected task after it has been expanded
  const handleSelectedTaskHandled = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  // Handle restoring an archived task
  const handleRestoreTask = useCallback(async (taskId: string) => {
    if (!isSupabaseConfigured()) return;

    try {
      // Restore task by marking it as not completed and resetting status
      const { error } = await supabase
        .from('todos')
        .update({
          completed: false,
          status: 'todo',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) {
        logger.error('Failed to restore task', error, { component: 'MainApp', taskId });
        throw error;
      }

      // Log the restore action
      await supabase.from('activity_log').insert({
        action: 'restore',
        entity_type: 'todo',
        entity_id: taskId,
        user_name: currentUser.name,
        details: { restored_from: 'archive' },
      });

      logger.info('Task restored from archive', { component: 'MainApp', taskId });
    } catch (error) {
      logger.error('Failed to restore task', error, { component: 'MainApp', taskId });
      throw error;
    }
  }, [currentUser.name]);

  // Handle permanently deleting an archived task
  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!isSupabaseConfigured()) return;

    try {
      // Get task info for logging before deletion
      const { data: taskData } = await supabase
        .from('todos')
        .select('text')
        .eq('id', taskId)
        .single();

      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', taskId);

      if (error) {
        logger.error('Failed to delete task', error, { component: 'MainApp', taskId });
        throw error;
      }

      // Log the deletion
      await supabase.from('activity_log').insert({
        action: 'permanent_delete',
        entity_type: 'todo',
        entity_id: taskId,
        user_name: currentUser.name,
        details: { task_text: taskData?.text, deleted_from: 'archive' },
      });

      logger.info('Task permanently deleted from archive', { component: 'MainApp', taskId });
    } catch (error) {
      logger.error('Failed to delete task', error, { component: 'MainApp', taskId });
      throw error;
    }
  }, [currentUser.name]);

  // Dashboard view is now a full page, no longer triggers modal
  // The modal is only shown on daily login check

  // Register the new task trigger callback with AppShell
  useEffect(() => {
    onNewTaskTrigger(() => {
      setShowAddTask(true);
    });
  }, [onNewTaskTrigger]);

  // AI Inbox handlers - extracted to useCallback for memoization
  // NOTE: These must be defined BEFORE any conditional returns to follow Rules of Hooks
  const handleAIAccept = useCallback(async (item: AIInboxItem, editedTask?: Partial<AIInboxItem['proposedTask']>) => {
    const task = editedTask || item.proposedTask;
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: task.text || item.proposedTask.text,
          priority: task.priority || item.proposedTask.priority || 'medium',
          assignedTo: task.assignedTo || item.proposedTask.assignedTo,
          dueDate: task.dueDate || item.proposedTask.dueDate,
          notes: task.notes || item.proposedTask.notes,
          subtasks: task.subtasks || item.proposedTask.subtasks || [],
        }),
      });

      if (!res.ok) {
        logger.error('Failed to create task from AI suggestion', new Error(`HTTP ${res.status}`), { component: 'MainApp' });
        return;
      }

      // Remove accepted item from inbox
      setAiInboxItems(prev => prev.filter(i => i.id !== item.id));
      logger.info('AI suggestion accepted and task created', { component: 'MainApp', itemId: item.id });
    } catch (error) {
      logger.error('Failed to accept AI suggestion', error, { component: 'MainApp', itemId: item.id });
    }
  }, []);

  const handleAIDismiss = useCallback(async (itemId: string) => {
    setAiInboxItems(prev => prev.filter(i => i.id !== itemId));
    logger.info('AI suggestion dismissed', { component: 'MainApp', itemId });
  }, []);

  const handleAIRefresh = useCallback(async () => {
    await fetchAISuggestions();
  }, [fetchAISuggestions]);

  const handleArchiveClose = useCallback(() => setActiveView('tasks'), [setActiveView]);
  const handleChatBack = useCallback(() => setActiveView('tasks'), [setActiveView]);

  // Pipeline stage change handler - updates the task notes with [stage:xxx] tag
  const handlePipelineStageChange = useCallback(async (todoId: string, newStageId: string) => {
    if (!isSupabaseConfigured()) return;

    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;

    const currentNotes = todo.notes || '';
    const cleanedNotes = currentNotes.replace(/\[stage:\w+\]/g, '').trim();
    const newNotes = cleanedNotes ? `${cleanedNotes} [stage:${newStageId}]` : `[stage:${newStageId}]`;

    try {
      const { error } = await supabase
        .from('todos')
        .update({ notes: newNotes, updated_at: new Date().toISOString() })
        .eq('id', todoId);

      if (error) {
        logger.error('Failed to update pipeline stage', error, { component: 'MainApp', todoId, newStageId });
      }
    } catch (error) {
      logger.error('Failed to update pipeline stage', error, { component: 'MainApp', todoId, newStageId });
    }
  }, [todos]);

  // Memoized view rendering to prevent unnecessary re-renders
  // NOTE: Must be defined BEFORE any conditional returns to follow Rules of Hooks
  const activeViewContent = useMemo(() => {
    switch (activeView) {
      case 'dashboard':
        return (
          <DashboardPage
            currentUser={currentUser}
            todos={todos}
            users={users}
            activityLog={activityLog}
            onNavigateToTasks={() => handleNavigateToTasks()}
            onTaskClick={handleTaskLinkClick}
            onFilterOverdue={() => handleNavigateToTasks('overdue')}
            onFilterDueToday={() => handleNavigateToTasks('due_today')}
          />
        );

      case 'chat':
        return (
          <ChatView
            currentUser={currentUser}
            users={usersWithColors}
            onBack={handleChatBack}
            onTaskLinkClick={handleTaskLinkClick}
          />
        );

      case 'activity':
        // Activity feed is handled by TodoList internally
        // Just switch to tasks view for now
        return (
          <TodoList
            currentUser={currentUser}
            onUserChange={onUserChange}
            initialFilter={initialFilter}
            autoFocusAddTask={showAddTask}
            onAddTaskModalOpened={handleAddTaskModalOpened}
            onInitialFilterApplied={handleInitialFilterApplied}
            onOpenDashboard={handleOpenDashboard}
            selectedTaskId={selectedTaskId}
            onSelectedTaskHandled={handleSelectedTaskHandled}
          />
        );

      case 'goals':
        // Strategic goals is handled by TodoList internally
        return (
          <TodoList
            currentUser={currentUser}
            onUserChange={onUserChange}
            initialFilter={initialFilter}
            autoFocusAddTask={showAddTask}
            onAddTaskModalOpened={handleAddTaskModalOpened}
            onInitialFilterApplied={handleInitialFilterApplied}
            onOpenDashboard={handleOpenDashboard}
            selectedTaskId={selectedTaskId}
            onSelectedTaskHandled={handleSelectedTaskHandled}
          />
        );

      case 'archive':
        // Full-featured archive browser
        return (
          <ArchiveView
            currentUser={currentUser}
            users={users}
            onRestore={handleRestoreTask}
            onDelete={handleDeleteTask}
            onClose={handleArchiveClose}
          />
        );

      case 'ai_inbox':
        // AI Inbox view for reviewing AI-derived tasks
        return (
          <AIInbox
            items={aiInboxItems}
            users={usersWithColors.map(u => u.name)}
            onAccept={handleAIAccept}
            onDismiss={handleAIDismiss}
            onRefresh={handleAIRefresh}
            isLoading={aiInboxLoading}
          />
        );

      case 'pipeline':
        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <ManuscriptPipelineView
              todos={todos}
              onTodoClick={handleTaskLinkClick}
              onStatusChange={handlePipelineStageChange}
            />
          </div>
        );

      case 'projects':
        return <ProjectDashboard />;

      case 'gantt':
        return (
          <div className="h-full">
            <GanttView onTaskClick={(todo) => handleTaskLinkClick(todo.id)} />
          </div>
        );

      case 'equipment':
        return (
          <div className="h-full">
            <EquipmentCalendar currentUser={currentUser.name} />
          </div>
        );

      case 'integrations':
        return <IntegrationsPage />;

      case 'tasks':
      default:
        return (
          <TodoList
            currentUser={currentUser}
            onUserChange={onUserChange}
            initialFilter={initialFilter}
            autoFocusAddTask={showAddTask}
            onAddTaskModalOpened={handleAddTaskModalOpened}
            onInitialFilterApplied={handleInitialFilterApplied}
            onOpenDashboard={handleOpenDashboard}
            selectedTaskId={selectedTaskId}
            onSelectedTaskHandled={handleSelectedTaskHandled}
          />
        );
    }
  }, [
    activeView,
    currentUser,
    todos,
    users,
    usersWithColors,
    activityLog,
    initialFilter,
    showAddTask,
    selectedTaskId,
    handleNavigateToTasks,
    handleTaskLinkClick,
    handleSelectedTaskHandled,
    handleRestoreTask,
    handleDeleteTask,
    handleAddTaskModalOpened,
    handleInitialFilterApplied,
    handleOpenDashboard,
    handleChatBack,
    handleArchiveClose,
    handleAIAccept,
    handleAIDismiss,
    handleAIRefresh,
    aiInboxItems,
    aiInboxLoading,
    handlePipelineStageChange,
    onUserChange,
  ]);

  // Loading state - rendered conditionally in JSX to avoid early return before hooks
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  return (
    <>
      {activeViewContent}

      {/* Only render DashboardModal when it needs to be shown - prevents skeleton flash */}
      {showDashboard && (
        <DashboardModal
          isOpen={showDashboard}
          onClose={() => setShowDashboard(false)}
          todos={todos}
          currentUser={currentUser}
          onNavigateToTasks={() => handleNavigateToTasks()}
          onAddTask={handleAddTask}
          onFilterOverdue={() => handleNavigateToTasks('overdue')}
          onFilterDueToday={() => handleNavigateToTasks('due_today')}
          users={users}
        />
      )}

      {/* Push notification permission banner */}
      <NotificationPermissionBanner currentUser={currentUser} />

      {/* Weekly Progress Chart Modal - accessible from any view via sidebar */}
      {showWeeklyChart && (
        <WeeklyProgressChart
          todos={todos}
          darkMode={darkMode}
          show={showWeeklyChart}
          onClose={closeWeeklyChart}
        />
      )}

      {/* Keyboard Shortcuts Modal - accessible from any view via sidebar */}
      <KeyboardShortcutsModal
        show={showShortcuts}
        onClose={closeShortcuts}
        darkMode={darkMode}
      />
    </>
  );
}

/**
 * MainApp - Wraps the app content in AppShell context provider with Error Boundary
 */
export default function MainApp({ currentUser, onUserChange }: MainAppProps) {
  return (
    <AppShell currentUser={currentUser} onUserChange={onUserChange}>
      <ErrorBoundary>
        <MainAppContent currentUser={currentUser} onUserChange={onUserChange} />
      </ErrorBoundary>
    </AppShell>
  );
}
