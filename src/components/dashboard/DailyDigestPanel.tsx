'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  AlertTriangle,
  CalendarDays,
  Users,
  Target,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Lightbulb,
  AlertCircle,
} from 'lucide-react';
import {
  useDailyDigest,
  getPriorityColor,
  formatDigestDueDate,
  type DailyDigestData,
} from '@/hooks/useDailyDigest';
import DailyDigestSkeleton from './DailyDigestSkeleton';
import type { AuthUser } from '@/types/todo';

interface DailyDigestPanelProps {
  currentUser: AuthUser;
  onNavigateToTask?: (taskId: string) => void;
  onFilterOverdue?: () => void;
  onFilterDueToday?: () => void;
  defaultExpanded?: boolean;
  className?: string;
}

// Content component for rendering digest sections
function DigestContent({
  digest,
  onTaskClick,
  onOverdueClick,
  onTodayClick,
}: {
  digest: DailyDigestData;
  onTaskClick?: (taskId: string) => void;
  onOverdueClick?: () => void;
  onTodayClick?: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Greeting */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm text-[var(--text-secondary)]"
      >
        {digest.greeting}
      </motion.p>

      {/* Overdue Tasks Section */}
      {digest.overdueTasks.count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl p-4 bg-red-500/10 border border-red-500/30"
        >
          <button
            onClick={onOverdueClick}
            aria-label={`View all ${digest.overdueTasks.count} overdue tasks`}
            className="w-full flex items-center justify-between mb-3 group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-red-400">
                Overdue Tasks ({digest.overdueTasks.count})
              </h3>
            </div>
            <ChevronRight className="w-4 h-4 text-red-400 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </button>
          <p className="text-sm text-red-300/80 mb-3">{digest.overdueTasks.summary}</p>
          <div className="space-y-2">
            {digest.overdueTasks.tasks.slice(0, 3).map((task) => (
              <button
                key={task.id}
                onClick={() => onTaskClick?.(task.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)}`} />
                <span className="flex-1 text-sm text-red-200 truncate">{task.text}</span>
                {task.due_date && (
                  <span className="text-xs text-red-400/70 flex-shrink-0">
                    {formatDigestDueDate(task.due_date)}
                  </span>
                )}
              </button>
            ))}
            {digest.overdueTasks.count > 3 && (
              <button
                onClick={onOverdueClick}
                className="w-full text-center py-2 text-xs text-red-400 hover:text-red-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                +{digest.overdueTasks.count - 3} more overdue
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Today's Tasks Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl p-4 bg-[var(--surface-2)] border border-[var(--border)]"
      >
        <button
          onClick={onTodayClick}
          aria-label={`View all ${digest.todaysTasks.count} tasks due today`}
          className="w-full flex items-center justify-between mb-3 group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[var(--brand-blue)]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Today&apos;s Tasks ({digest.todaysTasks.count})
            </h3>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" aria-hidden="true" />
        </button>
        <p className="text-sm text-[var(--text-secondary)] mb-3">{digest.todaysTasks.summary}</p>
        {digest.todaysTasks.count > 0 ? (
          <div className="space-y-2">
            {digest.todaysTasks.tasks.slice(0, 4).map((task) => (
              <button
                key={task.id}
                onClick={() => onTaskClick?.(task.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--surface-3)] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)}`} />
                <span className="flex-1 text-sm text-[var(--foreground)] truncate">{task.text}</span>
                {task.subtasks_count > 0 && (
                  <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                    {task.subtasks_completed}/{task.subtasks_count}
                  </span>
                )}
              </button>
            ))}
            {digest.todaysTasks.count > 4 && (
              <button
                onClick={onTodayClick}
                className="w-full text-center py-2 text-xs text-[var(--accent)] hover:underline rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                +{digest.todaysTasks.count - 4} more today
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
            <span className="text-sm text-[var(--text-secondary)]">No tasks due today</span>
          </div>
        )}
      </motion.div>

      {/* Team Activity Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl p-4 bg-[var(--surface-2)] border border-[var(--border)]"
      >
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-[#C9A227]" />
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Team Activity</h3>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-3">{digest.teamActivity.summary}</p>
        {digest.teamActivity.highlights.length > 0 && (
          <ul className="space-y-2" aria-label="Team activity highlights">
            {digest.teamActivity.highlights.map((highlight, index) => (
              <li
                key={`highlight-${index}-${highlight.substring(0, 20)}`}
                className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
              >
                <span className="text-[#C9A227] mt-0.5" aria-hidden="true">-</span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      {/* Focus Suggestion Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-xl p-4 bg-gradient-to-br from-[var(--brand-blue)]/10 to-[#C9A227]/10 border border-[var(--brand-blue)]/30"
      >
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-[var(--brand-blue)]" />
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Today&apos;s Focus</h3>
        </div>
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-[#C9A227] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--foreground)]">{digest.focusSuggestion}</p>
        </div>
      </motion.div>
    </div>
  );
}

// Helper to format next scheduled time
function formatNextScheduled(date: Date | null): string {
  if (!date) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (isToday) {
    return `Today at ${time}`;
  }
  return `Tomorrow at ${time}`;
}

export default function DailyDigestPanel({
  currentUser,
  onNavigateToTask,
  onFilterOverdue,
  onFilterDueToday,
  defaultExpanded = true,
  className = '',
}: DailyDigestPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { digest, loading, error, refetch, isNew, digestType, nextScheduled, hasDigest } = useDailyDigest({
    currentUser,
    autoFetch: true,
    enabled: true,
  });

  // Get subtitle text based on state
  const getSubtitle = () => {
    if (loading) return 'Loading...';
    if (error) return 'Unable to load';
    if (!hasDigest) return 'Your briefing is coming';
    if (digestType === 'morning') return 'Morning briefing';
    if (digestType === 'afternoon') return 'Afternoon briefing';
    return 'AI-powered briefing';
  };

  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden ${className}`}
    >
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-2)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset"
        aria-expanded={isExpanded}
        aria-controls="daily-digest-content"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C9A227]/10 flex items-center justify-center relative">
            <Sparkles className="w-5 h-5 text-[#C9A227]" />
            {/* New badge */}
            {isNew && hasDigest && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--brand-blue)] rounded-full border-2 border-[var(--surface)]" />
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--foreground)]">Daily Digest</h2>
              {isNew && hasDigest && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--brand-blue)] text-white rounded">
                  New
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {getSubtitle()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <RefreshCw className="w-4 h-4 text-[var(--text-muted)] animate-spin" />
          )}
          <ChevronDown
            className={`w-5 h-5 text-[var(--text-muted)] transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id="daily-digest-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1">
              {/* Error state */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-400">Unable to load digest</p>
                    <p className="text-xs text-red-500/90 mt-1">{error}</p>
                    <button
                      onClick={refetch}
                      className="mt-2 text-xs text-red-400 hover:text-red-300 underline flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Try again
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Loading state */}
              {loading && !error && <DailyDigestSkeleton />}

              {/* No digest available state */}
              {!hasDigest && !loading && !error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-8 text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-[var(--text-muted)]" />
                  </div>
                  <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">
                    Your briefing is on its way
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-xs">
                    {nextScheduled
                      ? `Your next AI-powered briefing will be ready ${formatNextScheduled(nextScheduled)}`
                      : 'Your AI-powered briefing will be ready soon'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    Briefings are generated at 5 AM and 4 PM daily
                  </p>
                </motion.div>
              )}

              {/* Digest content */}
              {digest && hasDigest && !loading && !error && (
                <DigestContent
                  digest={digest}
                  onTaskClick={onNavigateToTask}
                  onOverdueClick={onFilterOverdue}
                  onTodayClick={onFilterDueToday}
                />
              )}

              {/* Footer with timestamp and next scheduled */}
              {hasDigest && digest && !loading && (
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <div className="text-xs text-[var(--text-muted)]">
                    <p>
                      Generated at{' '}
                      {new Date(digest.generatedAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    {nextScheduled && (
                      <p className="mt-0.5">
                        Next: {formatNextScheduled(nextScheduled)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={refetch}
                    disabled={loading}
                    className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    Check for update
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
