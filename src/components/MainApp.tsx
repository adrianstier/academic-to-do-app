'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import TodoList from './TodoList';
import { shouldShowDailyDashboard, markDailyDashboardShown } from '@/lib/dashboardUtils';
import { DashboardModalSkeleton, ChatPanelSkeleton } from './LoadingSkeletons';
import { AuthUser, Todo, QuickFilter } from '@/types/todo';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import { AppShell, useAppShell, ActiveView } from './layout';
import { useTodoStore } from '@/store/todoStore';

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
  loading: () => <ChatPanelSkeleton />,
});

interface MainAppProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
}

/**
 * MainAppContent - Inner component that uses AppShell context
 */
function MainAppContent({ currentUser, onUserChange }: MainAppProps) {
  const { activeView, setActiveView, onNewTaskTrigger } = useAppShell();
  const usersWithColors = useTodoStore((state) => state.usersWithColors);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialFilter, setInitialFilter] = useState<QuickFilter | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  // Initialize showDashboard to false - we'll check for daily show AFTER data loads
  const [showDashboard, setShowDashboard] = useState(false);
  const [hasCheckedDailyDashboard, setHasCheckedDailyDashboard] = useState(false);

  // Fetch todos
  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      try {
        const todosResult = await supabase
          .from('todos')
          .select('*')
          .order('created_at', { ascending: false });

        if (todosResult.data) {
          setTodos(todosResult.data);
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
    setShowDashboard(false);
    setActiveView('tasks');
  }, [setActiveView]);

  const handleAddTask = useCallback(() => {
    setShowAddTask(true);
    setShowDashboard(false);
    setActiveView('tasks');
  }, [setActiveView]);

  const handleOpenDashboard = useCallback(() => {
    setShowDashboard(true);
  }, []);

  // Handle task link click from chat (navigate to tasks view and scroll to task)
  const handleTaskLinkClick = useCallback((taskId: string) => {
    setActiveView('tasks');
    // Small delay to allow view switch
    setTimeout(() => {
      const taskElement = document.getElementById(`todo-${taskId}`);
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        taskElement.classList.add('ring-2', 'ring-blue-500');
        setTimeout(() => {
          taskElement.classList.remove('ring-2', 'ring-blue-500');
        }, 2000);
      }
    }, 100);
  }, [setActiveView]);

  // Handle dashboard view - open modal and switch back to tasks
  // Must be before any conditional returns to follow React hooks rules
  useEffect(() => {
    if (activeView === 'dashboard') {
      setShowDashboard(true);
      setActiveView('tasks');
    }
  }, [activeView, setActiveView]);

  // Register the new task trigger callback with AppShell
  useEffect(() => {
    onNewTaskTrigger(() => {
      setShowAddTask(true);
    });
  }, [onNewTaskTrigger]);

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

  // Render different views based on activeView from AppShell context
  const renderActiveView = () => {
    switch (activeView) {
      case 'chat':
        return (
          <ChatView
            currentUser={currentUser}
            users={usersWithColors}
            onBack={() => setActiveView('tasks')}
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
            onOpenDashboard={handleOpenDashboard}
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
            onOpenDashboard={handleOpenDashboard}
          />
        );

      case 'archive':
        // Archive is handled by TodoList internally
        return (
          <TodoList
            currentUser={currentUser}
            onUserChange={onUserChange}
            initialFilter={initialFilter}
            autoFocusAddTask={showAddTask}
            onOpenDashboard={handleOpenDashboard}
          />
        );

      case 'ai_inbox':
        // AI Inbox view for reviewing AI-derived tasks
        return (
          <AIInbox
            items={[]} // TODO: Connect to actual AI inbox state from store
            users={usersWithColors.map(u => u.name)}
            onAccept={async (item, editedTask) => {
              // TODO: Implement accept logic - create task from AI suggestion
              console.log('Accept AI item:', item, editedTask);
            }}
            onDismiss={async (itemId) => {
              // TODO: Implement dismiss logic
              console.log('Dismiss AI item:', itemId);
            }}
            onRefresh={async () => {
              // TODO: Implement refresh logic - fetch new AI items
              console.log('Refresh AI inbox');
            }}
          />
        );

      case 'tasks':
      default:
        return (
          <TodoList
            currentUser={currentUser}
            onUserChange={onUserChange}
            initialFilter={initialFilter}
            autoFocusAddTask={showAddTask}
            onOpenDashboard={handleOpenDashboard}
          />
        );
    }
  };

  return (
    <>
      {renderActiveView()}

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
        />
      )}
    </>
  );
}

/**
 * MainApp - Wraps the app content in AppShell context provider
 */
export default function MainApp({ currentUser, onUserChange }: MainAppProps) {
  return (
    <AppShell currentUser={currentUser} onUserChange={onUserChange}>
      <MainAppContent currentUser={currentUser} onUserChange={onUserChange} />
    </AppShell>
  );
}
