'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '@/types/todo';

// Types based on the API response
export interface DailyDigestTask {
  id: string;
  text: string;
  priority: string;
  due_date?: string;
  assigned_to?: string;
  status: string;
  subtasks_count: number;
  subtasks_completed: number;
}

export interface DailyDigestData {
  greeting: string;
  overdueTasks: {
    count: number;
    summary: string;
    tasks: DailyDigestTask[];
  };
  todaysTasks: {
    count: number;
    summary: string;
    tasks: DailyDigestTask[];
  };
  teamActivity: {
    summary: string;
    highlights: string[];
  };
  focusSuggestion: string;
  generatedAt: string;
}

interface UseDailyDigestOptions {
  currentUser: AuthUser | null;
  autoFetch?: boolean;
  enabled?: boolean;
}

interface UseDailyDigestReturn {
  digest: DailyDigestData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastFetched: Date | null;
  isNew: boolean;
  digestType: 'morning' | 'afternoon' | null;
  nextScheduled: Date | null;
  hasDigest: boolean;
}

// Helper to get CSRF token from cookie
const getCsrfToken = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
};

export function useDailyDigest({
  currentUser,
  autoFetch = true,
  enabled = true,
}: UseDailyDigestOptions): UseDailyDigestReturn {
  const [digest, setDigest] = useState<DailyDigestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [digestType, setDigestType] = useState<'morning' | 'afternoon' | null>(null);
  const [nextScheduled, setNextScheduled] = useState<Date | null>(null);
  const [hasDigest, setHasDigest] = useState(false);

  const fetchDigest = useCallback(async () => {
    if (!currentUser?.name || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const csrfToken = getCsrfToken();
      // Fetch from stored digests instead of generating on-demand
      const response = await fetch('/api/digest/latest', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Name': currentUser.name,
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch daily digest');
      }

      // Handle response from /api/digest/latest
      if (data.hasDigest) {
        setDigest(data.digest);
        setIsNew(data.isNew || false);
        setDigestType(data.digestType || null);
        setHasDigest(true);
      } else {
        setDigest(null);
        setIsNew(false);
        setDigestType(null);
        setHasDigest(false);
      }

      if (data.nextScheduled) {
        setNextScheduled(new Date(data.nextScheduled));
      }

      setLastFetched(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      setError(errorMessage);
      console.error('Error fetching daily digest:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.name, enabled]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && enabled && !digest && !loading && !lastFetched) {
      fetchDigest();
    }
  }, [autoFetch, enabled, digest, loading, lastFetched, fetchDigest]);

  return {
    digest,
    loading,
    error,
    refetch: fetchDigest,
    lastFetched,
    isNew,
    digestType,
    nextScheduled,
    hasDigest,
  };
}

// Priority color mapping helper
export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-500';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-[var(--brand-blue)]';
    case 'low':
      return 'bg-slate-400';
    default:
      return 'bg-[var(--brand-blue)]';
  }
};

// Format relative due date helper
export const formatDigestDueDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < -1) {
    return `${Math.abs(diffDays)} days overdue`;
  } else if (diffDays === -1) {
    return 'Yesterday';
  } else if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
};
