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
      try {
        // Check for stored session
        const session = getStoredSession();

        if (session && isSupabaseConfigured()) {
          // Verify user still exists with a timeout
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), 10000)
          );

          const queryPromise = supabase
            .from('users')
            .select('id, name, color, role, created_at, last_login, streak_count, streak_last_date, welcome_shown_at')
            .eq('id', session.userId)
            .single();

          try {
            const result = await Promise.race([queryPromise, timeoutPromise]);
            const { data } = result as { data: AuthUser | null };

            if (data) {
              // Default role to 'member' if not set
              setCurrentUser({ ...data, role: data.role || 'member' });
            } else {
              // User no longer exists, clear session
              clearStoredSession();
            }
          } catch (queryError) {
            console.error('Session verification failed:', queryError);
            // If query fails, clear session and let user log in again
            clearStoredSession();
          }
        }
      } catch (error) {
        console.error('Session load error:', error);
      } finally {
        setIsLoading(false);
      }
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
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] relative overflow-hidden">
        {/* Ambient gradient orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/3 w-[500px] h-[500px] bg-[var(--accent-gold)]/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-[var(--accent)]/10 rounded-full blur-[100px]" />
        </div>

        {/* Loading indicator */}
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] flex items-center justify-center shadow-lg" style={{ boxShadow: '0 8px 24px rgba(0, 51, 160, 0.3)' }}>
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <TodoList currentUser={currentUser} onUserChange={handleUserChange} />;
}
