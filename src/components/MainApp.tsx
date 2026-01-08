'use client';

import { useState, useEffect, useCallback } from 'react';
import TodoList from './TodoList';
import DashboardModal, { shouldShowDailyDashboard } from './DashboardModal';
import { AuthUser, Todo, QuickFilter } from '@/types/todo';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface MainAppProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
}

export default function MainApp({ currentUser, onUserChange }: MainAppProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialFilter, setInitialFilter] = useState<QuickFilter | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  // Fetch todos
  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      try {
        const [todosResult, usersResult] = await Promise.all([
          supabase
            .from('todos')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('users')
            .select('name')
        ]);

        if (todosResult.data) {
          setTodos(todosResult.data);
        }
        if (usersResult.data) {
          setUsers(usersResult.data.map(u => u.name));
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
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

  // Check if we should show daily dashboard on mount
  useEffect(() => {
    if (!loading && shouldShowDailyDashboard()) {
      setShowDashboard(true);
    }
  }, [loading]);

  const handleNavigateToTasks = useCallback((filter?: QuickFilter) => {
    if (filter) {
      setInitialFilter(filter);
    }
    setShowDashboard(false);
  }, []);

  const handleAddTask = useCallback(() => {
    setShowAddTask(true);
    setShowDashboard(false);
  }, []);

  const handleOpenDashboard = useCallback(() => {
    setShowDashboard(true);
  }, []);

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
      <TodoList
        currentUser={currentUser}
        onUserChange={onUserChange}
        initialFilter={initialFilter}
        autoFocusAddTask={showAddTask}
        onOpenDashboard={handleOpenDashboard}
      />

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
    </>
  );
}
