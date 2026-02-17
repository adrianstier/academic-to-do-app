'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { supabase } from '@/lib/supabaseClient';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { useTodoStore } from '@/store/todoStore';
import type {
  Team,
  TeamMembership,
  TeamRole,
  TeamPermissions,
} from '@/types/team';

// ============================================
// Types
// ============================================

interface TeamContextType {
  /** Currently selected team */
  currentTeam: Team | null;
  /** Current team ID (convenience accessor) */
  currentTeamId: string | null;
  /** User's role in the current team */
  currentRole: TeamRole | null;
  /** User's permissions in the current team */
  currentPermissions: TeamPermissions | null;
  /** All teams the user belongs to */
  teams: TeamMembership[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether multi-tenancy is enabled */
  isMultiTenancyEnabled: boolean;
  /** Switch to a different team */
  switchTeam: (teamId: string) => Promise<void>;
  /** Refresh teams list from server */
  refreshTeams: () => Promise<void>;
  /** Check if user has a specific permission */
  hasPermission: (permission: keyof TeamPermissions) => boolean;
  /** Check if user is owner of current team */
  isTeamOwner: boolean;
  /** Check if user is admin (owner or admin) of current team */
  isTeamAdmin: boolean;
  /** Retry loading after error */
  retry: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

const CURRENT_TEAM_KEY = 'academic-current-team';
const SESSION_KEY = 'todoSession';

// ============================================
// Provider Component
// ============================================

interface TeamProviderProps {
  children: ReactNode;
  /** Optional userId — if not provided, reads from stored session */
  userId?: string;
}

export function TeamProvider({ children, userId: userIdProp }: TeamProviderProps) {
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [currentMembership, setCurrentMembership] = useState<TeamMembership | null>(null);
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(userIdProp);
  const refreshTeamsRef = useRef<(() => Promise<void>) | null>(null);
  const retryCountRef = useRef(0);

  const isMultiTenancyEnabled = isFeatureEnabled('multi_tenancy');

  // Self-resolve userId from stored session if not provided as prop
  useEffect(() => {
    setMounted(true);

    if (userIdProp) {
      setResolvedUserId(userIdProp);
      return;
    }

    // Read from stored session
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        if (session.userId) {
          setResolvedUserId(session.userId);
        }
      }
    } catch {
      // Invalid session data
    }

    // Listen for auth changes (dispatched by page.tsx on login/logout)
    const handleAuthChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.userId) {
        setResolvedUserId(detail.userId);
      } else {
        setResolvedUserId(undefined);
        setTeams([]);
        setCurrentTeam(null);
        setCurrentMembership(null);
      }
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, [userIdProp]);

  // Update resolvedUserId when prop changes
  useEffect(() => {
    if (userIdProp !== undefined) {
      setResolvedUserId(userIdProp);
    }
  }, [userIdProp]);

  /**
   * Load all teams the user belongs to (with retry + exponential backoff)
   * Declared before the useEffect that calls it to avoid block-scope ordering issues.
   */
  const loadUserTeams = useCallback(async (uid: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Try new team_members table first, fall back to agency_members
      let data;
      let fetchError;

      // First try team_members (new schema)
      const teamResult = await supabase
        .from('team_members')
        .select(`
          team_id,
          role,
          permissions,
          is_default_team,
          teams!inner (
            id,
            name,
            slug,
            is_active
          )
        `)
        .eq('user_id', uid)
        .eq('status', 'active');

      if (teamResult.error?.code === '42P01') {
        // Table doesn't exist, try agency_members (backward compatibility)
        const agencyResult = await supabase
          .from('agency_members')
          .select(`
            agency_id,
            role,
            permissions,
            is_default_agency,
            agencies!inner (
              id,
              name,
              slug,
              is_active
            )
          `)
          .eq('user_id', uid)
          .eq('status', 'active');

        data = agencyResult.data;
        fetchError = agencyResult.error;

        if (!fetchError && data) {
          // Transform agency data to team format
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawData = data as any[];
          const memberships: TeamMembership[] = (rawData || [])
            .filter((m) => m.agencies?.is_active)
            .map((m) => ({
              team_id: m.agency_id,
              team_name: m.agencies.name,
              team_slug: m.agencies.slug,
              role: m.role as TeamRole,
              permissions: m.permissions as TeamPermissions,
              is_default: m.is_default_agency,
            }));

          setTeams(memberships);
          setIsLoading(false);
          return;
        }
      } else {
        data = teamResult.data;
        fetchError = teamResult.error;
      }

      if (fetchError) {
        throw fetchError;
      }

      // Transform the data - Supabase returns joined data as nested objects
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = data as any[];
      const memberships: TeamMembership[] = (rawData || [])
        .filter((m) => m.teams?.is_active)
        .map((m) => ({
          team_id: m.team_id,
          team_name: m.teams.name,
          team_slug: m.teams.slug,
          role: m.role as TeamRole,
          permissions: m.permissions as TeamPermissions,
          is_default: m.is_default_team,
        }));

      setTeams(memberships);
      retryCountRef.current = 0;
    } catch (err) {
      console.error('Failed to load teams:', err);

      // Retry with exponential backoff (3 attempts: 1s, 2s, 4s)
      if (retryCountRef.current < 3) {
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        retryCountRef.current++;
        setTimeout(() => loadUserTeams(uid), delay);
        return;
      }

      setError('Failed to load labs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load full team details
   */
  const loadTeamDetails = useCallback(async (
    teamId: string,
    membership: TeamMembership
  ) => {
    try {
      // Try teams table first, fall back to agencies
      let data;
      let fetchError;

      const teamResult = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .eq('is_active', true)
        .single();

      if (teamResult.error?.code === '42P01') {
        // Table doesn't exist, try agencies
        const agencyResult = await supabase
          .from('agencies')
          .select('*')
          .eq('id', teamId)
          .eq('is_active', true)
          .single();

        data = agencyResult.data;
        fetchError = agencyResult.error;
      } else {
        data = teamResult.data;
        fetchError = teamResult.error;
      }

      if (fetchError || !data) {
        throw fetchError || new Error('Team not found');
      }

      setCurrentTeam(data as Team);
      setCurrentMembership(membership);
      localStorage.setItem(CURRENT_TEAM_KEY, teamId);

      // Set cookie for server-side access
      document.cookie = `current_team_id=${teamId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    } catch (err) {
      console.error('Failed to load team details:', err);
      setError('Failed to load lab details');
    }
  }, []);

  // Load teams on mount or when userId changes
  useEffect(() => {
    if (!isMultiTenancyEnabled) {
      setIsLoading(false);
      return;
    }

    if (!resolvedUserId) {
      setIsLoading(false);
      setTeams([]);
      setCurrentTeam(null);
      setCurrentMembership(null);
      return;
    }

    retryCountRef.current = 0;
    loadUserTeams(resolvedUserId);
  }, [resolvedUserId, isMultiTenancyEnabled, loadUserTeams]);

  // Load saved team selection from localStorage
  useEffect(() => {
    if (!mounted || !isMultiTenancyEnabled || teams.length === 0) return;

    const savedTeamId = localStorage.getItem(CURRENT_TEAM_KEY);

    if (savedTeamId) {
      // Verify user still has access to this team
      const membership = teams.find(t => t.team_id === savedTeamId);
      if (membership) {
        loadTeamDetails(savedTeamId, membership);
        return;
      }
    }

    // Default to the user's default team or first team
    const defaultTeam = teams.find(t => t.is_default) || teams[0];
    if (defaultTeam) {
      loadTeamDetails(defaultTeam.team_id, defaultTeam);
    }
  }, [mounted, teams, isMultiTenancyEnabled, loadTeamDetails]);

  // Sync currentMembership from teams array when it updates (fix stale permissions)
  useEffect(() => {
    if (!currentTeam || teams.length === 0) return;

    const updatedMembership = teams.find(t => t.team_id === currentTeam.id);
    if (updatedMembership && updatedMembership !== currentMembership) {
      setCurrentMembership(updatedMembership);
    }
  }, [teams, currentTeam, currentMembership]);

  /**
   * Switch to a different team
   */
  const switchTeam = useCallback(async (teamId: string) => {
    const membership = teams.find(t => t.team_id === teamId);
    if (!membership) {
      setError('You are not a member of this lab');
      return;
    }

    // Clear stale application state from the previous team
    const store = useTodoStore.getState();
    store.setTodos([]);
    store.setProjects([]);
    store.setTags([]);
    store.clearSelection();
    store.resetFilters();
    store.setLoading(true);
    store.setError(null);

    await loadTeamDetails(teamId, membership);
  }, [teams, loadTeamDetails]);

  /**
   * Refresh teams list
   */
  const refreshTeams = useCallback(async () => {
    if (resolvedUserId) {
      await loadUserTeams(resolvedUserId);
    }
  }, [resolvedUserId, loadUserTeams]);

  // Store refreshTeams in ref for subscription callback (avoids dep array issues)
  refreshTeamsRef.current = refreshTeams;

  /**
   * Retry loading after error
   */
  const retry = useCallback(async () => {
    retryCountRef.current = 0;
    setError(null);
    if (resolvedUserId) {
      await loadUserTeams(resolvedUserId);
    }
  }, [resolvedUserId, loadUserTeams]);

  /**
   * Check if user has a specific permission
   */
  const hasPermission = useCallback((permission: keyof TeamPermissions): boolean => {
    if (!isMultiTenancyEnabled) return true;
    if (!currentMembership?.permissions) return false;
    return currentMembership.permissions[permission] === true;
  }, [currentMembership, isMultiTenancyEnabled]);

  // Computed values
  const isTeamOwner = currentMembership?.role === 'owner';
  const isTeamAdmin = currentMembership?.role === 'owner' || currentMembership?.role === 'admin';

  // Subscribe to real-time team updates with unique channel name
  useEffect(() => {
    if (!isMultiTenancyEnabled || !resolvedUserId) return;

    // Use unique channel name per team to avoid subscription conflicts
    const channelName = currentTeam?.id
      ? `team-updates-${currentTeam.id}-${resolvedUserId}`
      : `team-updates-global-${resolvedUserId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `user_id=eq.${resolvedUserId}`,
        },
        () => {
          // Use ref to avoid stale closure — refreshTeams won't cause re-subscription
          refreshTeamsRef.current?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'teams',
          filter: currentTeam ? `id=eq.${currentTeam.id}` : undefined,
        },
        (payload) => {
          // Update current team if it changed
          if (currentTeam && payload.new) {
            setCurrentTeam(payload.new as Team);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Only re-subscribe when userId or currentTeam.id changes (not on every refreshTeams change)
  }, [resolvedUserId, currentTeam?.id, isMultiTenancyEnabled]);

  const value: TeamContextType = {
    currentTeam,
    currentTeamId: currentTeam?.id || null,
    currentRole: currentMembership?.role || null,
    currentPermissions: currentMembership?.permissions || null,
    teams,
    isLoading,
    error,
    isMultiTenancyEnabled,
    switchTeam,
    refreshTeams,
    hasPermission,
    isTeamOwner,
    isTeamAdmin,
    retry,
  };

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return null;
  }

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Hook to get current team ID, safe to use without checking
 * Returns null if no team is selected or multi-tenancy is disabled
 */
export function useCurrentTeamId(): string | null {
  const { currentTeamId, isMultiTenancyEnabled } = useTeam();
  if (!isMultiTenancyEnabled) return null;
  return currentTeamId;
}

/**
 * Hook to check if user has permission
 */
export function useTeamPermission(permission: keyof TeamPermissions): boolean {
  const { hasPermission, isMultiTenancyEnabled } = useTeam();
  if (!isMultiTenancyEnabled) return true;
  return hasPermission(permission);
}

/**
 * Hook to get team-scoped query params for Supabase queries
 * Returns an object with team_id if multi-tenancy is enabled
 */
export function useTeamScope(): { team_id?: string } {
  const { currentTeamId, isMultiTenancyEnabled } = useTeam();

  if (!isMultiTenancyEnabled || !currentTeamId) {
    return {};
  }

  return { team_id: currentTeamId };
}

