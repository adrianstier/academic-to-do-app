'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ListChecks,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
  Users,
  Tag,
} from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf';
import { useTheme } from '@/contexts/ThemeContext';
import StatCard from './StatCard';
import AnimatedProgressRing from './AnimatedProgressRing';

// =====================================================================
// Types
// =====================================================================

interface AssigneeStats {
  total: number;
  completed: number;
}

interface RecentActivityItem {
  id: string;
  text: string;
  completed: boolean;
  status: string;
  priority: string;
  assigned_to?: string;
  due_date?: string;
  updated_at: string;
}

export interface ProjectStatsData {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  todo_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  tasks_by_priority: Record<string, number>;
  tasks_by_category: Record<string, number>;
  tasks_by_status: Record<string, number>;
  tasks_by_assignee: Record<string, AssigneeStats>;
  recent_completions: number;
  recent_activity: RecentActivityItem[];
}

interface ProjectStatsProps {
  projectId: string;
  onStatsLoaded?: (stats: ProjectStatsData) => void;
}

// =====================================================================
// Category display config
// =====================================================================

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  research: { label: 'Research', color: '#8b5cf6' },
  writing: { label: 'Writing', color: '#3b82f6' },
  analysis: { label: 'Analysis', color: '#06b6d4' },
  meeting: { label: 'Meeting', color: '#f59e0b' },
  submission: { label: 'Submission', color: '#ef4444' },
  revision: { label: 'Revision', color: '#f97316' },
  presentation: { label: 'Presentation', color: '#ec4899' },
  reading: { label: 'Reading', color: '#10b981' },
  coursework: { label: 'Coursework', color: '#6366f1' },
  admin: { label: 'Admin', color: '#6b7280' },
  other: { label: 'Other', color: '#9ca3af' },
  uncategorized: { label: 'Uncategorized', color: '#d1d5db' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: '#ef4444' },
  high: { label: 'High', color: '#f59e0b' },
  medium: { label: 'Medium', color: '#3b82f6' },
  low: { label: 'Low', color: '#6b7280' },
};

// =====================================================================
// Sub-components
// =====================================================================

/**
 * Horizontal stacked bar for showing distribution
 */
function DistributionBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <div className="w-full h-3 rounded-full overflow-hidden flex bg-[var(--surface-3)] dark:bg-white/10">
      {segments
        .filter(s => s.value > 0)
        .map((segment, i) => {
          const pct = (segment.value / total) * 100;
          return (
            <motion.div
              key={segment.label}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ backgroundColor: segment.color }}
              title={`${segment.label}: ${segment.value} (${Math.round(pct)}%)`}
            />
          );
        })}
    </div>
  );
}

/**
 * Legend for the distribution bar
 */
function DistributionLegend({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const filteredSegments = segments.filter(s => s.value > 0);

  if (filteredSegments.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)] dark:text-white/40 text-center py-2">
        No data available
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
      {filteredSegments.map(segment => (
        <div key={segment.label} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{ backgroundColor: segment.color }}
          />
          <span className="text-xs text-[var(--text-muted)] dark:text-white/50">
            {segment.label}
          </span>
          <span className="text-xs font-medium text-[var(--foreground)] dark:text-white/70">
            {segment.value}
          </span>
          <span className="text-xs text-[var(--text-muted)] dark:text-white/30">
            ({total > 0 ? Math.round((segment.value / total) * 100) : 0}%)
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Assignee progress rows
 */
function AssigneeBreakdown({ assignees }: { assignees: Record<string, AssigneeStats> }) {
  const sorted = useMemo(() => {
    return Object.entries(assignees)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8);
  }, [assignees]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-6">
        <Users className="w-7 h-7 mx-auto mb-2 text-[var(--text-muted)] dark:text-white/30" />
        <p className="text-xs text-[var(--text-muted)] dark:text-white/50">
          No assignee data yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map(([name, data]) => {
        const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
        return (
          <div key={name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-[var(--foreground)] dark:text-white truncate max-w-[60%]">
                {name}
              </span>
              <span className="text-xs text-[var(--text-muted)] dark:text-white/50">
                {data.completed}/{data.total} done
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden bg-[var(--surface-3)] dark:bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--success)]"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// Main Component
// =====================================================================

export default function ProjectStats({ projectId, onStatsLoaded }: ProjectStatsProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const prefersReducedMotion = useReducedMotion();
  const [stats, setStats] = useState<ProjectStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchWithCsrf(`/api/projects/${projectId}/stats`);
        if (!res.ok) {
          throw new Error('Failed to fetch project stats');
        }
        const data = await res.json();
        if (data.stats) {
          setStats(data.stats);
          onStatsLoaded?.(data.stats);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Derived data
  const categorySegments = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.tasks_by_category)
      .map(([key, value]) => ({
        label: CATEGORY_CONFIG[key]?.label || key,
        value,
        color: CATEGORY_CONFIG[key]?.color || '#9ca3af',
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  const prioritySegments = useMemo(() => {
    if (!stats) return [];
    const order = ['urgent', 'high', 'medium', 'low'];
    return order
      .filter(key => stats.tasks_by_priority[key])
      .map(key => ({
        label: PRIORITY_CONFIG[key]?.label || key,
        value: stats.tasks_by_priority[key] || 0,
        color: PRIORITY_CONFIG[key]?.color || '#9ca3af',
      }));
  }, [stats]);

  // =================== Loading ===================
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 animate-pulse"
            >
              <div className="h-4 w-20 bg-[var(--surface-3)] dark:bg-white/10 rounded mb-3" />
              <div className="h-8 w-16 bg-[var(--surface-3)] dark:bg-white/10 rounded" />
            </div>
          ))}
        </div>
        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 p-5 animate-pulse">
            <div className="h-4 w-32 bg-[var(--surface-3)] dark:bg-white/10 rounded mb-4" />
            <div className="flex justify-center"><div className="w-28 h-28 rounded-full bg-[var(--surface-3)] dark:bg-white/10" /></div>
          </div>
          <div className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 p-5 animate-pulse lg:col-span-2">
            <div className="h-4 w-40 bg-[var(--surface-3)] dark:bg-white/10 rounded mb-4" />
            <div className="h-3 w-full bg-[var(--surface-3)] dark:bg-white/10 rounded mb-3" />
            <div className="h-3 w-3/4 bg-[var(--surface-3)] dark:bg-white/10 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // =================== Error ===================
  if (error || !stats) {
    return (
      <div className="p-4 rounded-xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 text-[var(--danger)] text-sm">
        {error || 'No statistics available'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* =================== Stat Cards Row =================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Tasks"
          value={stats.total_tasks}
          icon={ListChecks}
          variant="default"
          delay={0}
        />
        <StatCard
          label="Completion Rate"
          value={stats.completion_rate}
          icon={CheckCircle2}
          variant="success"
          suffix="%"
          delay={0.05}
        />
        <StatCard
          label="In Progress"
          value={stats.in_progress_tasks}
          icon={Clock}
          variant="info"
          delay={0.1}
        />
        <StatCard
          label="Overdue"
          value={stats.overdue_tasks}
          icon={AlertTriangle}
          variant={stats.overdue_tasks > 0 ? 'danger' : 'default'}
          delay={0.15}
        />
      </div>

      {/* =================== Charts Row: Progress Ring + Category Breakdown =================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Progress Ring Card */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-[var(--success-light)] dark:bg-[var(--success)]/20">
              <CheckCircle2 className="w-4 h-4 text-[var(--success)] dark:text-[var(--success-vivid)]" />
            </div>
            <h4 className="text-sm font-semibold text-[var(--foreground)] dark:text-white">
              Overall Progress
            </h4>
          </div>

          <div className="flex flex-col items-center">
            <AnimatedProgressRing
              progress={stats.completion_rate}
              size={140}
              strokeWidth={10}
              darkMode={darkMode}
              gradientId="projectProgressGradient"
            >
              <div className="text-center">
                <span className="text-3xl font-bold tracking-tight text-[var(--foreground)] dark:text-white">
                  {stats.completion_rate}
                </span>
                <span className="text-sm font-medium text-[var(--text-muted)] dark:text-white/60">%</span>
                <p className="text-xs text-[var(--text-muted)] dark:text-white/40 mt-0.5">
                  Complete
                </p>
              </div>
            </AnimatedProgressRing>

            {/* Quick status summary below ring */}
            <div className="flex items-center justify-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                <span className="text-[var(--text-muted)] dark:text-white/50">
                  {stats.completed_tasks} done
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--warning)]" />
                <span className="text-[var(--text-muted)] dark:text-white/50">
                  {stats.in_progress_tasks} active
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--brand-blue)]" />
                <span className="text-[var(--text-muted)] dark:text-white/50">
                  {stats.todo_tasks || 0} to do
                </span>
              </div>
            </div>

            {stats.recent_completions > 0 && (
              <p className="text-xs text-[var(--success)] dark:text-[var(--success-vivid)] mt-3 font-medium">
                {stats.recent_completions} completed this week
              </p>
            )}
          </div>
        </motion.div>

        {/* Category + Priority Breakdown Card */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm p-5 lg:col-span-2"
        >
          {/* Category Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20">
                <Tag className="w-4 h-4 text-[var(--brand-blue)] dark:text-[var(--brand-sky)]" />
              </div>
              <h4 className="text-sm font-semibold text-[var(--foreground)] dark:text-white">
                Tasks by Category
              </h4>
            </div>

            {categorySegments.length > 0 ? (
              <>
                <DistributionBar segments={categorySegments} />
                <DistributionLegend segments={categorySegments} />
              </>
            ) : (
              <p className="text-xs text-[var(--text-muted)] dark:text-white/40 py-2">
                No categorized tasks yet
              </p>
            )}
          </div>

          {/* Priority Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-[var(--warning-light)] dark:bg-[var(--warning)]/20">
                <BarChart3 className="w-4 h-4 text-[var(--warning)] dark:text-[var(--warning)]" />
              </div>
              <h4 className="text-sm font-semibold text-[var(--foreground)] dark:text-white">
                Tasks by Priority
              </h4>
            </div>

            {prioritySegments.length > 0 ? (
              <>
                <DistributionBar segments={prioritySegments} />
                <DistributionLegend segments={prioritySegments} />
              </>
            ) : (
              <p className="text-xs text-[var(--text-muted)] dark:text-white/40 py-2">
                No tasks with priority data
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* =================== Assignee Breakdown =================== */}
      {stats.tasks_by_assignee && Object.keys(stats.tasks_by_assignee).length > 0 && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20">
              <Users className="w-4 h-4 text-[var(--brand-blue)] dark:text-[var(--brand-sky)]" />
            </div>
            <h4 className="text-sm font-semibold text-[var(--foreground)] dark:text-white">
              Tasks by Assignee
            </h4>
          </div>
          <AssigneeBreakdown assignees={stats.tasks_by_assignee} />
        </motion.div>
      )}
    </div>
  );
}

export type { ProjectStatsData as ProjectStatsDataExport };
