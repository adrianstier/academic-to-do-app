'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import MainApp from '@/components/MainApp';
import LoginScreen from '@/components/LoginScreen';
import TeamOnboardingModal from '@/components/TeamOnboardingModal';
import { AuthUser } from '@/types/todo';
import { getStoredSession, setStoredSession, clearStoredSession } from '@/lib/auth';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import { TeamProvider, useTeam } from '@/contexts/TeamContext';

// ============================================
// Team-Aware App Wrapper
// Checks if user needs team onboarding
// ============================================

interface TeamAwareAppProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
  onTeamCreated: () => void;
}

function TeamAwareApp({ currentUser, onUserChange, onTeamCreated }: TeamAwareAppProps) {
  const { teams, isLoading: teamsLoading, isMultiTenancyEnabled, refreshTeams } = useTeam();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if user needs team onboarding (has no teams when multi-tenancy is enabled)
  useEffect(() => {
    if (!teamsLoading && isMultiTenancyEnabled) {
      setShowOnboarding(teams.length === 0);
    }
  }, [teams, teamsLoading, isMultiTenancyEnabled]);

  const handleOnboardingComplete = async () => {
    // Refresh teams after onboarding
    await refreshTeams();
    setShowOnboarding(false);
    onTeamCreated();
  };

  // Show loading while checking teams
  if (teamsLoading && isMultiTenancyEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] relative overflow-hidden">
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

  // Show team onboarding modal if user has no teams
  if (showOnboarding && isMultiTenancyEnabled) {
    return (
      <>
        <MainApp currentUser={currentUser} onUserChange={onUserChange} />
        <TeamOnboardingModal
          userId={currentUser.id}
          userName={currentUser.name}
          onComplete={handleOnboardingComplete}
        />
      </>
    );
  }

  return <MainApp currentUser={currentUser} onUserChange={onUserChange} />;
}

export default function Home() {
  const { data: oauthSession, status: oauthStatus } = useSession();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        // Check for test mode bypass (for E2E testing)
        // This allows tests to inject a mock user without OAuth
        if (typeof window !== 'undefined') {
          const testMode = localStorage.getItem('__test_mode__');
          const testUser = localStorage.getItem('__test_user__');
          if (testMode === 'true' && testUser) {
            try {
              const user = JSON.parse(testUser) as AuthUser;
              setCurrentUser(user);
              setIsLoading(false);
              return;
            } catch {
              // Invalid test user, continue with normal flow
            }
          }
        }

        // First, check for OAuth session from NextAuth
        if (oauthStatus === 'authenticated' && oauthSession?.user) {
          // User authenticated via OAuth - find or create user in database
          const email = oauthSession.user.email;
          const name = oauthSession.user.name || email?.split('@')[0] || 'User';

          if (isSupabaseConfigured() && email) {
            // Check if user exists by email
            const { data: existingUser } = await supabase
              .from('users')
              .select('id, name, color, role, created_at, last_login, streak_count, streak_last_date, welcome_shown_at')
              .eq('email', email)
              .single();

            if (existingUser) {
              // Update last login
              await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', existingUser.id);

              setCurrentUser({ ...existingUser, role: existingUser.role || 'member' });
              setIsLoading(false);
              return;
            }

            // Create new user from OAuth
            const colors = ['#1e3a5f', '#2c5282', '#c9a227', '#5d7a64', '#6b9ac4', '#3b6ea8', '#d4b84a', '#7a9a82'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];

            const { data: newUser, error } = await supabase
              .from('users')
              .insert({
                name,
                email,
                color: randomColor,
                role: 'member',
                last_login: new Date().toISOString(),
              })
              .select()
              .single();

            if (newUser && !error) {
              setCurrentUser({ ...newUser, role: newUser.role || 'member' });
              setIsLoading(false);
              return;
            }
          }
        }

        // Fall back to legacy PIN session if OAuth not authenticated
        if (oauthStatus !== 'loading') {
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
              logger.error('Session verification failed', queryError, { component: 'HomePage' });
              // If query fails, clear session and let user log in again
              clearStoredSession();
            }
          }

          setIsLoading(false);
        }
      } catch (error) {
        logger.error('Session load error', error, { component: 'HomePage' });
        setIsLoading(false);
      }
    };

    loadSession();
  }, [oauthSession, oauthStatus]);

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

  // Handler for when team is created during onboarding
  const handleTeamCreated = () => {
    // Force a re-render to refresh the TeamProvider state
    logger.info('Team created during onboarding', { userId: currentUser.id });
  };

  return (
    <TeamProvider userId={currentUser.id}>
      <TeamAwareApp
        currentUser={currentUser}
        onUserChange={handleUserChange}
        onTeamCreated={handleTeamCreated}
      />
    </TeamProvider>
  );
}
