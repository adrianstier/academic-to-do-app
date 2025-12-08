'use client';

import { useState, useEffect } from 'react';
import TodoList from '@/components/TodoList';
import LoginScreen from '@/components/LoginScreen';
import { AuthUser } from '@/types/todo';
import { getStoredSession, setStoredSession, clearStoredSession } from '@/lib/auth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      // Check for stored session
      const session = getStoredSession();

      if (session && isSupabaseConfigured()) {
        // Verify user still exists
        const { data } = await supabase
          .from('users')
          .select('id, name, color, created_at, last_login, streak_count, streak_last_date, welcome_shown_at')
          .eq('id', session.userId)
          .single();

        if (data) {
          setCurrentUser(data);
        } else {
          // User no longer exists, clear session
          clearStoredSession();
        }
      }

      setIsLoading(false);
    };

    loadSession();
  }, []);

  const handleLogin = (user: AuthUser) => {
    setStoredSession(user);
    setCurrentUser(user);
  };

  const handleUserChange = (user: AuthUser | null) => {
    if (user) {
      setStoredSession(user);
      setCurrentUser(user);
    } else {
      clearStoredSession();
      setCurrentUser(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="text-slate-500 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <TodoList currentUser={currentUser} onUserChange={handleUserChange} />;
}
