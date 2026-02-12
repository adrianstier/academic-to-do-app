'use client';

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday } from 'date-fns';
import { ChevronRight, CheckCircle2, Clock, Bell, Link2 } from 'lucide-react';
import { Todo, TodoPriority } from '@/types/todo';
import { useTodoStore } from '@/store/todoStore';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  isTaskOverdue,
  STATUS_BORDER,
  getSubtaskProgress,
  isFollowUpOverdue,
  getInitials,
  hasPendingReminders,
} from './constants';

interface DayViewProps {
  currentDate: Date;
  direction: 'left' | 'right';
  todosByDate: Map<string, Todo[]>;
  onDateClick: (date: Date) => void;
  onTaskClick: (todo: Todo) => void;
  onQuickComplete?: (todoId: string) => void;
  onToggleWaiting?: (todoId: string, waiting: boolean) => void;
  onQuickAdd?: (dateKey: string, text: string) => void;
}

const PRIORITY_BADGES: Record<TodoPriority, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
  high: { label: 'High', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  medium: { label: 'Medium', className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  low: { label: 'Low', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
};

const dayVariants = {
  enter: (direction: 'left' | 'right') => ({
    x: direction === 'right' ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: 'left' | 'right') => ({
    x: direction === 'right' ? -50 : 50,
    opacity: 0,
  }),
};

export default function DayView({
  currentDate,
  direction,
  todosByDate,
  onDateClick,
  onTaskClick,
  onQuickComplete,
  onToggleWaiting,
  onQuickAdd,
}: DayViewProps) {
  const storeProjects = useTodoStore(state => state.projects);
  const storeDeps = useTodoStore(state => state.dependencies);
  const storeTags = useTodoStore(state => state.tags);

  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const dayTodos = useMemo(() => todosByDate.get(dateKey) || [], [todosByDate, dateKey]);
  const today = isToday(currentDate);

  // Inline quick-add state
  const [quickAddText, setQuickAddText] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const handleQuickAddSubmit = useCallback(() => {
    const trimmed = quickAddText.trim();
    if (trimmed && onQuickAdd) {
      onQuickAdd(dateKey, trimmed);
      setQuickAddText('');
      setShowQuickAdd(false);
    }
  }, [quickAddText, onQuickAdd, dateKey]);

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-auto">
      <AnimatePresence mode="popLayout" custom={direction}>
        <motion.div
          key={dateKey}
          custom={direction}
          variants={dayVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2 }}
        >
          {/* Day Header */}
          <div className="flex items-center gap-3 mb-4">
            {today && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                Today
              </span>
            )}
            <span className="text-sm text-[var(--text-muted)]">
              {dayTodos.length} {dayTodos.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          {/* Task Cards */}
          {dayTodos.length > 0 ? (
            <div className="space-y-3">
              {dayTodos.map((todo) => {
                const category = todo.category || 'other';
                const priority = todo.priority || 'medium';
                const priorityBadge = PRIORITY_BADGES[priority];
                const isOverdue = !todo.completed && isTaskOverdue(todo.due_date);
                const subtaskProgress = getSubtaskProgress(todo.subtasks);
                const isWaitingOverdue = isFollowUpOverdue(todo.waiting_since, todo.follow_up_after_hours);

                // Project, dependency, tag data from store
                const todoProject = todo.project_id ? storeProjects.find(p => p.id === todo.project_id) : null;
                const todoDeps = storeDeps[todo.id];
                const totalDeps = todoDeps ? todoDeps.blocks.length + todoDeps.blockedBy.length : 0;
                const isBlocked = todoDeps && todoDeps.blockedBy.length > 0 && !todo.completed;
                const todoTags = todo.tags && todo.tags.length > 0
                  ? todo.tags.map(tagId => storeTags.find(t => t.id === tagId)).filter(Boolean)
                  : [];
                const customStatusName = todo.custom_status && todoProject?.custom_statuses
                  ? todoProject.custom_statuses.find(s => s.id === todo.custom_status)
                  : null;

                // Status border: overdue > in_progress > default
                const statusClass = isOverdue
                  ? 'border-l-2 border-l-red-500'
                  : STATUS_BORDER[todo.status] || '';

                return (
                  <div key={todo.id} className={`relative rounded-xl border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-hover)] transition-all group ${statusClass}`}>
                    <button
                      onClick={() => onTaskClick(todo)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-start gap-3">
                        {/* Category Color Bar */}
                        <div className={`w-1 self-stretch rounded-full ${CATEGORY_COLORS[category]}`} />

                        <div className="flex-1 min-w-0">
                          {/* Title Row */}
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
                              {todo.text}
                            </h3>
                            {priorityBadge && (
                              <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${priorityBadge.className}`}>
                                {priorityBadge.label}
                              </span>
                            )}
                            {isOverdue && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                Overdue
                              </span>
                            )}
                            {/* Custom status badge replaces generic "In Progress" when available */}
                            {customStatusName ? (
                              <span
                                className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
                                style={{ backgroundColor: customStatusName.color + '18', color: customStatusName.color }}
                              >
                                {customStatusName.name}
                              </span>
                            ) : todo.status === 'in_progress' && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-500/10 text-blue-500">
                                In Progress
                              </span>
                            )}
                            {/* Blocked badge */}
                            {isBlocked && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                <Link2 className="w-2.5 h-2.5" />
                                Blocked
                              </span>
                            )}
                          </div>

                          {/* Project + Details Row */}
                          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] flex-wrap">
                            {todoProject && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
                                style={{ backgroundColor: todoProject.color + '18', color: todoProject.color }}
                              >
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: todoProject.color }}
                                />
                                {todoProject.name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[category]}`} />
                              {CATEGORY_LABELS[category]}
                            </span>
                            {todo.assigned_to && (
                              <span className="flex items-center gap-1">
                                <span className="w-4 h-4 rounded-full bg-[var(--surface)] flex items-center justify-center text-[9px] font-bold">
                                  {getInitials(todo.assigned_to)}
                                </span>
                                {todo.assigned_to}
                              </span>
                            )}
                            {subtaskProgress && (
                              <span>{subtaskProgress}</span>
                            )}
                            {totalDeps > 0 && !isBlocked && (
                              <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                                <Link2 className="w-3 h-3" />
                                {totalDeps} dep{totalDeps !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>

                          {/* Tag badges row */}
                          {todoTags.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {todoTags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag!.id}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: tag!.color + '18', color: tag!.color }}
                                >
                                  {tag!.name}
                                </span>
                              ))}
                              {todoTags.length > 3 && (
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  +{todoTags.length - 3}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Indicators Row */}
                          {(todo.waiting_for_response || hasPendingReminders(todo.reminders, todo.reminder_at)) && (
                            <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                              {todo.waiting_for_response && (
                                <span className={`flex items-center gap-1 ${isWaitingOverdue ? 'text-red-500' : 'text-amber-500'}`}>
                                  <Clock className="w-3.5 h-3.5" />
                                  {isWaitingOverdue ? 'Follow-up overdue' : 'Waiting'}
                                </span>
                              )}
                              {hasPendingReminders(todo.reminders, todo.reminder_at) && (
                                <span className="flex items-center gap-1 text-[var(--text-muted)]">
                                  <Bell className="w-3.5 h-3.5" />
                                  Reminder
                                </span>
                              )}
                            </div>
                          )}

                          {/* Notes Preview */}
                          {todo.notes && (
                            <p className="mt-2 text-xs text-[var(--text-muted)] line-clamp-2">
                              {todo.notes}
                            </p>
                          )}
                        </div>

                        {/* Hover chevron */}
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                      </div>
                    </button>

                    {/* Quick Action Buttons */}
                    {(onQuickComplete || onToggleWaiting) && (
                      <div className="absolute top-2 right-8 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onQuickComplete && !todo.completed && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onQuickComplete(todo.id); }}
                            className="p-1 rounded hover:bg-green-500/20 text-[var(--text-muted)] hover:text-green-500 transition-colors"
                            title="Mark complete"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {onToggleWaiting && !todo.completed && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleWaiting(todo.id, !todo.waiting_for_response); }}
                            className={`p-1 rounded transition-colors ${todo.waiting_for_response ? 'text-amber-500 hover:bg-amber-500/20' : 'text-[var(--text-muted)] hover:bg-amber-500/20 hover:text-amber-500'}`}
                            title={todo.waiting_for_response ? 'Stop waiting' : 'Mark waiting'}
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-[var(--text-muted)] mb-4">
                No tasks for {format(currentDate, 'EEEE, MMMM d')}
              </p>
              <button
                onClick={() => onDateClick(currentDate)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 transition-colors"
              >
                + Create Task
              </button>
            </div>
          )}

          {/* Inline Quick Add */}
          {onQuickAdd && (
            <div className="mt-4">
              {showQuickAdd ? (
                <input
                  autoFocus
                  value={quickAddText}
                  onChange={(e) => setQuickAddText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleQuickAddSubmit();
                    if (e.key === 'Escape') { setShowQuickAdd(false); setQuickAddText(''); }
                  }}
                  onBlur={() => { if (!quickAddText.trim()) { setShowQuickAdd(false); setQuickAddText(''); } }}
                  placeholder="Task name — press Enter to add"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                />
              ) : (
                <button
                  onClick={() => setShowQuickAdd(true)}
                  className="w-full px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-lg border border-dashed border-[var(--border)] transition-colors"
                >
                  + Quick add task
                </button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
