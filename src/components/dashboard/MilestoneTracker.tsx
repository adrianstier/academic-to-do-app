'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Plus,
  Calendar,
  Target,
} from 'lucide-react';
import type { Milestone } from '@/types/project';

interface MilestoneTrackerProps {
  projectId: string;
  initialMilestones?: Milestone[];
}

/**
 * MilestoneTracker - Vertical list of milestones for a project
 *
 * Uses local state for milestone management. A backend milestones API
 * can be connected later; the component interface is designed to be
 * easily swapped to server-backed state.
 */
export default function MilestoneTracker({ projectId, initialMilestones = [] }: MilestoneTrackerProps) {
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [showForm, setShowForm] = useState(false);

  const completedCount = milestones.filter(m => m.completed).length;
  const totalCount = milestones.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggle = useCallback((milestoneId: string) => {
    setMilestones(prev =>
      prev.map(m =>
        m.id === milestoneId ? { ...m, completed: !m.completed } : m
      )
    );
  }, []);

  const handleAdd = useCallback(() => {
    if (!newTitle.trim()) return;

    const milestone: Milestone = {
      id: `ms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      project_id: projectId,
      title: newTitle.trim(),
      target_date: newDate || undefined,
      completed: false,
      display_order: milestones.length,
      created_at: new Date().toISOString(),
    };

    setMilestones(prev => [...prev, milestone]);
    setNewTitle('');
    setNewDate('');
    setShowForm(false);
  }, [newTitle, newDate, projectId, milestones.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTitle.trim()) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Escape') {
      setShowForm(false);
      setNewTitle('');
      setNewDate('');
    }
  }, [handleAdd, newTitle]);

  // Sort: incomplete first by display_order, then completed
  const sortedMilestones = [...milestones].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.target_date && b.target_date) {
      return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
    }
    return a.display_order - b.display_order;
  });

  return (
    <div className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20">
              <Target className="w-4 h-4 text-[var(--brand-blue)] dark:text-[var(--brand-sky)]" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)] dark:text-white text-sm">
                Milestones
              </h3>
              {totalCount > 0 && (
                <p className="text-xs text-[var(--text-muted)] dark:text-white/50">
                  {completedCount} of {totalCount} complete
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
              text-[var(--brand-blue)] dark:text-[var(--brand-sky)]
              bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20
              hover:bg-[var(--brand-blue)]/20 dark:hover:bg-[var(--brand-sky)]/30
              transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mb-1">
            <div className="h-2 rounded-full overflow-hidden bg-[var(--surface-3)] dark:bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--success)]"
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-[var(--text-muted)] dark:text-white/40">
                {progressPercent}% complete
              </span>
              <span className="text-xs text-[var(--text-muted)] dark:text-white/40">
                {totalCount - completedCount} remaining
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Add milestone form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-2.5">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Milestone title..."
                autoFocus
                className="w-full px-3 py-2 rounded-lg text-sm
                  bg-[var(--surface)] dark:bg-[var(--surface-3)]
                  border border-[var(--border)] dark:border-white/10
                  text-[var(--foreground)] dark:text-white
                  placeholder-[var(--text-muted)] dark:placeholder-white/40
                  focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30 focus:border-[var(--brand-blue)]"
              />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg text-xs
                      bg-[var(--surface)] dark:bg-[var(--surface-3)]
                      border border-[var(--border)] dark:border-white/10
                      text-[var(--foreground)] dark:text-white
                      focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30"
                  />
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!newTitle.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg
                    bg-[var(--brand-blue)] text-white
                    hover:bg-[var(--brand-navy)] disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setNewTitle('');
                    setNewDate('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg
                    text-[var(--text-muted)] hover:bg-[var(--surface-2)] dark:hover:bg-white/10
                    transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestone list */}
      <div className="px-5 pb-5">
        {sortedMilestones.length === 0 ? (
          <div className="text-center py-8">
            <Target className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] dark:text-white/30" />
            <p className="text-sm text-[var(--text-muted)] dark:text-white/50">
              No milestones yet
            </p>
            <p className="text-xs text-[var(--text-muted)] dark:text-white/30 mt-1">
              Add milestones to track key deliverables
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {sortedMilestones.map((milestone) => (
                <motion.div
                  key={milestone.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-colors group
                    ${milestone.completed
                      ? 'bg-[var(--success-light)]/30 dark:bg-[var(--success)]/5'
                      : 'hover:bg-[var(--surface)] dark:hover:bg-white/5'
                    }
                  `}
                >
                  <button
                    onClick={() => handleToggle(milestone.id)}
                    className={`flex-shrink-0 transition-all ${
                      milestone.completed
                        ? 'text-[var(--success)] hover:text-[var(--success)]/80'
                        : 'text-[var(--text-muted)] dark:text-white/30 hover:text-[var(--brand-blue)]'
                    }`}
                    aria-label={milestone.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {milestone.completed ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <span className={`text-sm ${
                      milestone.completed
                        ? 'line-through text-[var(--text-muted)] dark:text-white/40'
                        : 'text-[var(--foreground)] dark:text-white'
                    }`}>
                      {milestone.title}
                    </span>
                  </div>

                  {milestone.target_date && (
                    <span className={`text-xs flex-shrink-0 px-2 py-0.5 rounded ${
                      !milestone.completed && (() => {
                        // Compare dates in local timezone to avoid UTC offset issues
                        const target = new Date(milestone.target_date + 'T23:59:59');
                        return target < new Date();
                      })()
                        ? 'bg-[var(--danger-light)] text-[var(--danger)]'
                        : 'text-[var(--text-muted)] dark:text-white/40'
                    }`}>
                      {new Date(milestone.target_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
