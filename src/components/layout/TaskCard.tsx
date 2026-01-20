'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Calendar,
  Clock,
  User,
  Paperclip,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  MoreHorizontal,
  CheckCircle2,
  Circle,
  Flag,
  Timer,
} from 'lucide-react';
import { formatDistanceToNow, isPast, isToday, isTomorrow, format } from 'date-fns';
import { useTheme } from '@/contexts/ThemeContext';
import { Todo, TodoPriority, TodoStatus, Subtask } from '@/types/todo';

// ═══════════════════════════════════════════════════════════════════════════
// ENHANCED TASK CARD
// A visually rich task display with clear priority hierarchy
// Features:
// - Strong visual differentiation by priority (urgent tasks stand out)
// - Inline subtask progress
// - Smart due date display (overdue, today, tomorrow, etc.)
// - Hover actions for quick edits
// - Attachment and comment indicators
// - Assignee avatar
// ═══════════════════════════════════════════════════════════════════════════

interface TaskCardProps {
  task: Todo;
  onToggleComplete: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
  onQuickEdit?: (taskId: string, field: string, value: unknown) => void;
  isSelected?: boolean;
  users?: Array<{ name: string; color: string }>;
  compact?: boolean;
}

// Priority configuration with enhanced visual treatment
const PRIORITY_STYLES: Record<TodoPriority, {
  label: string;
  borderColor: string;
  bgGradient: string;
  textColor: string;
  iconColor: string;
  badgeBg: string;
  glow?: string;
}> = {
  urgent: {
    label: 'Urgent',
    borderColor: 'var(--danger)',
    bgGradient: 'linear-gradient(135deg, rgba(220, 38, 38, 0.08) 0%, transparent 60%)',
    textColor: 'var(--danger)',
    iconColor: 'var(--danger)',
    badgeBg: 'var(--danger-light)',
    glow: '0 0 20px rgba(220, 38, 38, 0.15)',
  },
  high: {
    label: 'High',
    borderColor: 'var(--warning)',
    bgGradient: 'linear-gradient(135deg, rgba(217, 119, 6, 0.06) 0%, transparent 60%)',
    textColor: 'var(--warning)',
    iconColor: 'var(--warning)',
    badgeBg: 'var(--warning-light)',
  },
  medium: {
    label: 'Medium',
    borderColor: 'var(--accent)',
    bgGradient: 'transparent',
    textColor: 'var(--accent)',
    iconColor: 'var(--accent)',
    badgeBg: 'var(--accent-light)',
  },
  low: {
    label: 'Low',
    borderColor: 'var(--border)',
    bgGradient: 'transparent',
    textColor: 'var(--text-muted)',
    iconColor: 'var(--text-muted)',
    badgeBg: 'var(--surface-2)',
  },
};

export default function TaskCard({
  task,
  onToggleComplete,
  onOpenDetail,
  onQuickEdit,
  isSelected = false,
  users = [],
  compact = false,
}: TaskCardProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';

  const [isHovered, setIsHovered] = useState(false);
  const [showMobileMetadata, setShowMobileMetadata] = useState(false);

  const priorityStyle = PRIORITY_STYLES[task.priority];
  const assignedUser = users.find(u => u.name === task.assigned_to);

  // Calculate subtask progress
  const subtaskProgress = useMemo(() => {
    if (!task.subtasks?.length) return null;
    const completed = task.subtasks.filter(s => s.completed).length;
    return {
      completed,
      total: task.subtasks.length,
      percent: Math.round((completed / task.subtasks.length) * 100),
    };
  }, [task.subtasks]);

  // Smart due date formatting
  const dueDateInfo = useMemo(() => {
    if (!task.due_date) return null;

    const dueDate = new Date(task.due_date);
    const isOverdue = isPast(dueDate) && !isToday(dueDate) && !task.completed;
    const isDueToday = isToday(dueDate);
    const isDueTomorrow = isTomorrow(dueDate);

    let label: string;
    let color: string;
    let urgent = false;

    if (isOverdue) {
      label = `Overdue ${formatDistanceToNow(dueDate, { addSuffix: false })}`;
      color = 'var(--danger)';
      urgent = true;
    } else if (isDueToday) {
      label = 'Due today';
      color = 'var(--warning)';
      urgent = true;
    } else if (isDueTomorrow) {
      label = 'Due tomorrow';
      color = 'var(--warning)';
    } else {
      label = format(dueDate, 'MMM d');
      color = darkMode ? 'var(--text-muted)' : 'var(--text-muted)';
    }

    return { label, color, urgent, isOverdue };
  }, [task.due_date, task.completed, darkMode]);

  // Check if task has additional context
  const hasAttachments = task.attachments && task.attachments.length > 0;
  const hasNotes = task.notes && task.notes.trim().length > 0;
  const hasTranscription = task.transcription && task.transcription.trim().length > 0;

  const handleToggleComplete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete(task.id);
  }, [task.id, onToggleComplete]);

  const handleCardClick = useCallback(() => {
    onOpenDetail(task.id);
  }, [task.id, onOpenDetail]);

  // Toggle mobile metadata visibility on tap
  const handleMobileMetadataToggle = useCallback((e: React.TouchEvent) => {
    // Prevent triggering card click when toggling metadata
    e.stopPropagation();
    setShowMobileMetadata(prev => !prev);
  }, []);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      className={`
        group relative overflow-hidden
        rounded-xl border cursor-pointer
        transition-all duration-200
        ${task.completed
          ? 'opacity-60'
          : ''
        }
        ${isSelected
          ? 'ring-2 ring-[var(--accent)] ring-offset-2'
          : ''
        }
        ${darkMode
          ? 'bg-[var(--surface)] border-white/10 hover:border-white/20'
          : 'bg-white border-[var(--border)] hover:border-[var(--border-hover)]'
        }
      `}
      style={{
        borderLeftWidth: task.priority === 'urgent' || task.priority === 'high' ? 4 : 1,
        borderLeftColor: task.completed ? 'var(--success)' : priorityStyle.borderColor,
        background: task.completed ? undefined : priorityStyle.bgGradient,
        boxShadow: !task.completed && task.priority === 'urgent' ? priorityStyle.glow : undefined,
      }}
      role="article"
      aria-label={`Task: ${task.text}`}
    >
      {/* Overdue corner indicator */}
      {dueDateInfo?.isOverdue && !task.completed && (
        <div
          className="absolute top-0 right-0 w-0 h-0"
          style={{
            borderStyle: 'solid',
            borderWidth: '0 24px 24px 0',
            borderColor: 'transparent var(--danger) transparent transparent',
          }}
        />
      )}

      <div className={`p-4 ${compact ? 'py-3' : ''}`}>
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={handleToggleComplete}
            className={`
              flex-shrink-0 mt-0.5
              w-5 h-5 rounded-md border-2
              flex items-center justify-center
              transition-all duration-200
              ${task.completed
                ? 'bg-[var(--success)] border-[var(--success)]'
                : `border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)]`
              }
            `}
            aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
          >
            <AnimatePresence>
              {task.completed && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Task text */}
            <p
              className={`
                text-sm font-medium leading-snug
                ${task.completed
                  ? 'line-through text-[var(--text-muted)]'
                  : darkMode
                    ? 'text-white'
                    : 'text-[var(--foreground)]'
                }
              `}
            >
              {task.text}
            </p>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* PRIMARY METADATA - Always visible */}
              {/* Priority badge (only for high/urgent) */}
              {(task.priority === 'urgent' || task.priority === 'high') && !task.completed && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: priorityStyle.badgeBg,
                    color: priorityStyle.textColor,
                  }}
                >
                  <Flag className="w-3 h-3" />
                  {priorityStyle.label}
                </span>
              )}

              {/* Due date - Primary metadata, always visible */}
              {dueDateInfo && (
                <span
                  className={`
                    inline-flex items-center gap-1 text-xs font-medium
                    ${dueDateInfo.urgent && !task.completed ? 'font-semibold' : ''}
                  `}
                  style={{ color: task.completed ? 'var(--text-muted)' : dueDateInfo.color }}
                >
                  {dueDateInfo.isOverdue && !task.completed ? (
                    <AlertTriangle className="w-3 h-3" />
                  ) : (
                    <Calendar className="w-3 h-3" />
                  )}
                  {dueDateInfo.label}
                </span>
              )}

              {/* SECONDARY METADATA - Hidden on mobile, shown on tap/hover or on larger screens */}
              {/* Subtask progress */}
              {subtaskProgress && (
                <span
                  className={`
                    inline-flex items-center gap-1.5 text-xs
                    ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}
                    ${showMobileMetadata ? 'flex' : 'hidden'} sm:inline-flex
                  `}
                >
                  <div className="relative w-12 h-1.5 rounded-full overflow-hidden bg-[var(--surface-2)]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${subtaskProgress.percent}%` }}
                      className="absolute inset-y-0 left-0 rounded-full bg-[var(--success)]"
                    />
                  </div>
                  <span>{subtaskProgress.completed}/{subtaskProgress.total}</span>
                </span>
              )}

              {/* Attachments indicator */}
              {hasAttachments && (
                <span
                  className={`
                    items-center gap-1 text-xs
                    ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}
                    ${showMobileMetadata ? 'inline-flex' : 'hidden'} sm:inline-flex
                  `}
                >
                  <Paperclip className="w-3 h-3" />
                  {task.attachments!.length}
                </span>
              )}

              {/* Notes/Transcription indicator */}
              {(hasNotes || hasTranscription) && (
                <span
                  className={`
                    ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}
                    ${showMobileMetadata ? 'inline-flex' : 'hidden'} sm:inline-flex
                  `}
                >
                  <MessageSquare className="w-3 h-3" />
                </span>
              )}

              {/* Mobile metadata toggle indicator - only on mobile when there's hidden metadata */}
              {(subtaskProgress || hasAttachments || hasNotes || hasTranscription || assignedUser) && (
                <button
                  onTouchEnd={handleMobileMetadataToggle}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMobileMetadata(prev => !prev);
                  }}
                  className={`
                    inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded
                    ${darkMode ? 'text-white/40 hover:text-white/60 hover:bg-white/5' : 'text-[var(--text-light)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}
                    sm:hidden
                    transition-colors
                  `}
                  aria-label={showMobileMetadata ? 'Hide details' : 'Show more details'}
                >
                  <MoreHorizontal className="w-3 h-3" />
                  {!showMobileMetadata && <span className="text-[10px]">more</span>}
                </button>
              )}
            </div>
          </div>

          {/* Right side: Assignee + Actions */}
          <div className="flex items-center gap-2">
            {/* Assignee avatar - hidden on mobile, shown on tap or larger screens */}
            {assignedUser && (
              <div
                className={`
                  w-7 h-7 rounded-full items-center justify-center text-white text-xs font-semibold flex-shrink-0
                  ${showMobileMetadata ? 'flex' : 'hidden'} sm:flex
                `}
                style={{ backgroundColor: assignedUser.color }}
                title={assignedUser.name}
              >
                {assignedUser.name[0]}
              </div>
            )}

            {/* Open detail arrow (visible on hover) */}
            <motion.div
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -5 }}
              className={`hidden sm:block ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}
            >
              <ChevronRight className="w-5 h-5" />
            </motion.div>
          </div>
        </div>

        {/* Expanded subtasks preview (optional, for important tasks) - hidden on mobile unless expanded */}
        {!compact && task.priority === 'urgent' && subtaskProgress && subtaskProgress.total <= 5 && (
          <div className={`mt-3 pl-8 space-y-1 ${showMobileMetadata ? 'block' : 'hidden'} sm:block`}>
            {task.subtasks?.slice(0, 3).map(subtask => (
              <div
                key={subtask.id}
                className={`
                  flex items-center gap-2 text-xs
                  ${subtask.completed
                    ? 'line-through opacity-50'
                    : ''
                  }
                  ${darkMode ? 'text-white/60' : 'text-[var(--text-muted)]'}
                `}
              >
                {subtask.completed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />
                ) : (
                  <Circle className="w-3.5 h-3.5" />
                )}
                <span className="truncate">{subtask.text}</span>
              </div>
            ))}
            {task.subtasks && task.subtasks.length > 3 && (
              <p className={`text-xs pl-5 ${darkMode ? 'text-white/40' : 'text-[var(--text-light)]'}`}>
                +{task.subtasks.length - 3} more
              </p>
            )}
          </div>
        )}
      </div>

      {/* Hover action bar - hidden on mobile to reduce density */}
      <AnimatePresence>
        {isHovered && !task.completed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`
              absolute bottom-0 inset-x-0 px-4 py-2
              hidden sm:flex items-center justify-end gap-2
              ${darkMode
                ? 'bg-gradient-to-t from-[var(--surface)] via-[var(--surface)]/80 to-transparent'
                : 'bg-gradient-to-t from-white via-white/80 to-transparent'
              }
            `}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Quick edit priority
              }}
              className={`
                p-1.5 rounded-lg text-xs font-medium
                transition-colors
                ${darkMode
                  ? 'hover:bg-white/10 text-white/60 hover:text-white'
                  : 'hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)]'
                }
              `}
            >
              <Flag className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Quick edit due date
              }}
              className={`
                p-1.5 rounded-lg text-xs font-medium
                transition-colors
                ${darkMode
                  ? 'hover:bg-white/10 text-white/60 hover:text-white'
                  : 'hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)]'
                }
              `}
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Quick edit assignee
              }}
              className={`
                p-1.5 rounded-lg text-xs font-medium
                transition-colors
                ${darkMode
                  ? 'hover:bg-white/10 text-white/60 hover:text-white'
                  : 'hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)]'
                }
              `}
            >
              <User className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // More options
              }}
              className={`
                p-1.5 rounded-lg text-xs font-medium
                transition-colors
                ${darkMode
                  ? 'hover:bg-white/10 text-white/60 hover:text-white'
                  : 'hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)]'
                }
              `}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK CARD SKELETON
// Loading placeholder for task cards
// ═══════════════════════════════════════════════════════════════════════════

export function TaskCardSkeleton({ compact = false }: { compact?: boolean }) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';

  return (
    <div
      className={`
        rounded-xl border p-4 animate-pulse
        ${compact ? 'py-3' : ''}
        ${darkMode
          ? 'bg-[var(--surface)] border-white/10'
          : 'bg-white border-[var(--border)]'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`w-5 h-5 rounded-md ${darkMode ? 'bg-white/10' : 'bg-[var(--surface-2)]'}`} />
        <div className="flex-1 space-y-2">
          <div className={`h-4 rounded w-3/4 ${darkMode ? 'bg-white/10' : 'bg-[var(--surface-2)]'}`} />
          <div className="flex gap-2">
            <div className={`h-3 rounded w-16 ${darkMode ? 'bg-white/5' : 'bg-[var(--surface-2)]'}`} />
            <div className={`h-3 rounded w-20 hidden sm:block ${darkMode ? 'bg-white/5' : 'bg-[var(--surface-2)]'}`} />
          </div>
        </div>
        {/* Assignee avatar skeleton - hidden on mobile */}
        <div className={`w-7 h-7 rounded-full hidden sm:block ${darkMode ? 'bg-white/10' : 'bg-[var(--surface-2)]'}`} />
      </div>
    </div>
  );
}
