'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { GripVertical, Clock, Bell, CheckCircle2 } from 'lucide-react';
import { Todo } from '@/types/todo';
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

// Priority-based left border colors
const PRIORITY_BORDER: Record<string, string> = {
  urgent: 'border-l-2 border-l-red-500',
  high: 'border-l-2 border-l-orange-500',
  medium: 'border-l-2 border-l-transparent',
  low: 'border-l-2 border-l-transparent',
};

interface CalendarDayCellProps {
  date: Date;
  todos: Todo[];
  isCurrentMonth: boolean;
  isToday: boolean;
  onClick: () => void;
  onAddTask?: () => void;
  onTaskClick: (todo: Todo) => void;
  enableDragDrop?: boolean;
  isDragActive?: boolean;
  columnIndex?: number;
  rowIndex?: number;
  onQuickComplete?: (todoId: string) => void;
  onToggleWaiting?: (todoId: string, waiting: boolean) => void;
  onQuickAdd?: (dateKey: string, text: string) => void;
  isFocused?: boolean;
}

// Draggable task item inside the popup
function DraggableTaskItem({
  todo,
  onTaskClick,
  enableDrag,
  onQuickComplete,
  onToggleWaiting,
}: {
  todo: Todo;
  onTaskClick: (todo: Todo) => void;
  enableDrag: boolean;
  onQuickComplete?: (todoId: string) => void;
  onToggleWaiting?: (todoId: string, waiting: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `calendar-task-${todo.id}`,
    data: { todoId: todo.id, type: 'calendar-task' },
    disabled: !enableDrag,
  });

  const category = todo.category || 'other';
  const isOverdue = isTaskOverdue(todo.due_date);

  // Overdue border takes precedence, then status border, then priority border
  const borderClass = isOverdue
    ? 'border-l-2 border-l-red-500'
    : STATUS_BORDER[todo.status] || PRIORITY_BORDER[todo.priority] || 'border-l-2 border-l-transparent';

  const subtaskProgress = getSubtaskProgress(todo.subtasks);
  const followUpOverdue = todo.waiting_for_response
    ? isFollowUpOverdue(todo.waiting_since, todo.follow_up_after_hours)
    : false;

  return (
    <div
      ref={setNodeRef}
      className={`group/task flex items-start gap-2 p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors text-left ${borderClass} ${isDragging ? 'opacity-30' : ''}`}
    >
      {enableDrag && (
        <button
          {...listeners}
          {...attributes}
          className="mt-1 cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-[var(--foreground)] flex-shrink-0"
          aria-label={`Drag ${todo.text}`}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTaskClick(todo);
        }}
        className="flex-1 flex items-start gap-2 min-w-0 text-left"
      >
        <div
          className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${CATEGORY_COLORS[category]}`}
          title={CATEGORY_LABELS[category]}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm truncate ${isOverdue ? 'text-red-500' : 'text-[var(--foreground)]'}`}
            title={todo.text}
          >
            {todo.text}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {CATEGORY_LABELS[category]}
          </p>
          {/* Wave 1: Visual indicators row */}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {todo.status === 'in_progress' && !isOverdue && (
              <span className="text-[10px] text-amber-500 font-medium">In Progress</span>
            )}
            {subtaskProgress && (
              <span className="text-[10px] text-[var(--text-muted)]">{subtaskProgress}</span>
            )}
            {todo.waiting_for_response && (
              <Clock
                className={`w-3 h-3 ${followUpOverdue ? 'text-red-500' : 'text-amber-500'}`}
                aria-label={followUpOverdue ? 'Follow-up overdue' : 'Waiting for response'}
              />
            )}
{hasPendingReminders(todo.reminders, todo.reminder_at) && (
              <Bell className="w-3 h-3 text-[var(--text-muted)]" aria-label="Has reminders" />
            )}
            {todo.assigned_to && (
              <span className="text-[10px] font-medium text-[var(--text-muted)] bg-[var(--surface)] px-1 rounded" title={`Assigned to ${todo.assigned_to}`}>
                {getInitials(todo.assigned_to)}
              </span>
            )}
          </div>
        </div>
      </button>
      {/* Quick action buttons — visible on hover */}
      {(onQuickComplete || onToggleWaiting) && (
        <div className="flex items-center gap-1 flex-shrink-0 mt-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
          {onQuickComplete && !todo.completed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickComplete(todo.id);
              }}
              className="text-[var(--text-muted)] hover:text-emerald-500 transition-colors"
              aria-label="Mark complete"
              title="Mark complete"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          {onToggleWaiting && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleWaiting(todo.id, !todo.waiting_for_response);
              }}
              className={`transition-colors ${
                todo.waiting_for_response
                  ? 'text-amber-500 hover:text-[var(--text-muted)]'
                  : 'text-[var(--text-muted)] hover:text-amber-500'
              }`}
              aria-label={todo.waiting_for_response ? 'Remove waiting status' : 'Mark as waiting'}
              title={todo.waiting_for_response ? 'Remove waiting status' : 'Mark as waiting'}
            >
              <Clock className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CalendarDayCell({
  date,
  todos,
  isCurrentMonth,
  isToday,
  onClick,
  onAddTask,
  onTaskClick,
  enableDragDrop = false,
  isDragActive = false,
  columnIndex,
  rowIndex,
  onQuickComplete,
  onToggleWaiting,
  onQuickAdd,
  isFocused,
}: CalendarDayCellProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const quickAddInputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLButtonElement>(null);

  const dateKey = format(date, 'yyyy-MM-dd');

  // Make the cell a droppable target
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `calendar-day-${dateKey}`,
    data: { dateKey, type: 'calendar-day' },
    disabled: !enableDragDrop,
  });

  const dayNumber = date.getDate();

  // Full date label for screen readers (e.g. "Monday, February 9, 2026, 3 tasks")
  const fullDateLabel = `${format(date, 'EEEE, MMMM d, yyyy')}${
    todos.length > 0 ? `, ${todos.length} task${todos.length !== 1 ? 's' : ''}` : ''
  }`;

  const handleCellClick = useCallback(() => {
    if (todos.length > 0) {
      setShowPopup((prev) => !prev);
    } else {
      onClick();
    }
  }, [todos.length, onClick]);

  // Close popup when drag ends (isDragActive transitions from true to false)
  // Without this, the popup can get stuck open because onMouseLeave won't fire
  // if the mouse hasn't moved after the drag completes
  const prevIsDragActive = useRef(isDragActive);
  useEffect(() => {
    if (prevIsDragActive.current && !isDragActive) {
      setShowPopup(false);
    }
    prevIsDragActive.current = isDragActive;
  }, [isDragActive]);

  // Determine popup positioning based on cell position in grid
  const popupHorizontal = columnIndex !== undefined && columnIndex >= 5 ? 'right-0' : 'left-0';
  const popupVertical = rowIndex !== undefined && rowIndex >= 4 ? 'bottom-full mb-1' : 'top-full mt-1';

  // Workload heatmap: subtle background tint based on task count
  const heatmapClass =
    isCurrentMonth && !isOver && !isToday
      ? todos.length >= 7
        ? 'bg-red-500/5'
        : todos.length >= 4
          ? 'bg-amber-500/5'
          : ''
      : '';

  // Auto-focus the quick-add input when it appears
  useEffect(() => {
    if (showQuickAdd && quickAddInputRef.current) {
      quickAddInputRef.current.focus();
    }
  }, [showQuickAdd]);

  // Scroll the cell into view when it becomes focused via keyboard navigation
  useEffect(() => {
    if (isFocused && cellRef.current) {
      cellRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  const handleQuickAddSubmit = useCallback(() => {
    const trimmed = quickAddText.trim();
    if (trimmed && onQuickAdd) {
      onQuickAdd(dateKey, trimmed);
    }
    setQuickAddText('');
    setShowQuickAdd(false);
  }, [quickAddText, onQuickAdd, dateKey]);

  const handleQuickAddKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleQuickAddSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setQuickAddText('');
        setShowQuickAdd(false);
      }
    },
    [handleQuickAddSubmit]
  );

  const handleQuickAddBlur = useCallback(() => {
    if (!quickAddText.trim()) {
      setQuickAddText('');
      setShowQuickAdd(false);
    }
  }, [quickAddText]);

  return (
    <div
      ref={setDroppableRef}
      className="relative"
      data-cell-row={rowIndex}
      data-cell-col={columnIndex}
      onMouseEnter={() => !isDragActive && !showPopup && todos.length > 0 && setShowPopup(true)}
      onMouseLeave={() => !isDragActive && setShowPopup(false)}
    >
      <motion.button
        ref={cellRef}
        role="gridcell"
        aria-label={fullDateLabel}
        onClick={handleCellClick}
        whileHover={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
        whileTap={{ scale: 0.98 }}
        className={`
          group w-full aspect-square sm:aspect-auto min-h-[80px] sm:min-h-[100px] p-2 rounded-lg
          flex flex-col items-start justify-start
          transition-all duration-200 border
          ${isOver
            ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/20 border-[var(--accent)]'
            : isToday
              ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/30'
              : isCurrentMonth
                ? `bg-[var(--surface-2)] border-[var(--border)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-hover)] ${heatmapClass}`
                : 'bg-[var(--background)] dark:bg-[var(--background)] border-[var(--border-muted)]'
          }
          ${isFocused ? 'ring-2 ring-[var(--accent)]/60 ring-offset-1 ring-offset-[var(--surface-2)]' : ''}
        `}
      >
        {/* Day Number */}
        <span
          className={`
            mb-1 inline-flex items-center justify-center
            ${isToday
              ? 'text-white bg-[var(--accent)] w-7 h-7 rounded-full text-sm font-bold'
              : isCurrentMonth
                ? 'text-[var(--foreground)] text-base font-bold'
                : 'text-[var(--text-muted)] dark:text-[var(--text-muted)]/50 text-sm font-medium'
            }
          `}
        >
          {dayNumber}
        </span>

        {/* "+ Add task" hint on empty cells — inline quick-add if onQuickAdd provided */}
        {todos.length === 0 && !showQuickAdd && (
          <span
            className="opacity-50 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] text-xs"
            onClick={(e) => {
              if (onQuickAdd) {
                e.stopPropagation();
                setShowQuickAdd(true);
              }
            }}
          >
            + Add task
          </span>
        )}
        {todos.length === 0 && showQuickAdd && (
          <input
            ref={quickAddInputRef}
            type="text"
            value={quickAddText}
            onChange={(e) => setQuickAddText(e.target.value)}
            onKeyDown={handleQuickAddKeyDown}
            onBlur={handleQuickAddBlur}
            onClick={(e) => e.stopPropagation()}
            placeholder="Quick add..."
            className="w-full text-xs bg-transparent border-b border-[var(--border)] focus:border-[var(--accent)] outline-none text-[var(--foreground)] placeholder:text-[var(--text-muted)] py-0.5"
          />
        )}

        {/* Task Previews */}
        {todos.length > 0 && (
          <div className="w-full flex-1 flex flex-col gap-0.5 min-h-0 overflow-hidden">
            {todos.slice(0, 3).map((todo) => {
              const cat = todo.category || 'other';
              const isOverdue = isTaskOverdue(todo.due_date);
              const isWaiting = todo.waiting_for_response;
              const waitingOverdue = isWaiting
                ? isFollowUpOverdue(todo.waiting_since, todo.follow_up_after_hours)
                : false;
              const hasIncompleteSubtasks = todo.subtasks?.some((s) => !s.completed);
              return (
                <div
                  key={todo.id}
                  className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] sm:text-xs truncate bg-[var(--surface)]/60"
                >
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[cat]}`}
                      title={CATEGORY_LABELS[cat]}
                    />
                  </div>
                  {isWaiting && (
                    <Clock
                      className={`w-2.5 h-2.5 flex-shrink-0 ${waitingOverdue ? 'text-red-500' : 'text-amber-500'}`}
                    />
                  )}
                  <span
                    className={`truncate ${
                      isOverdue
                        ? 'text-red-500'
                        : 'text-[var(--text-light)]'
                    }`}
                    title={todo.text}
                  >
                    {todo.text}
                  </span>
                  {hasIncompleteSubtasks && (
                    <span className="text-[8px] text-[var(--text-muted)] flex-shrink-0" title="Has incomplete subtasks">●</span>
                  )}
                  {hasPendingReminders(todo.reminders, todo.reminder_at) && (
                    <Bell className="w-2.5 h-2.5 text-[var(--text-muted)] flex-shrink-0" />
                  )}
                </div>
              );
            })}
            {todos.length > 3 && (
              <span className="text-[10px] text-[var(--text-muted)] px-1">
                +{todos.length - 3} more
              </span>
            )}
          </div>
        )}
      </motion.button>

      {/* Popup with draggable tasks */}
      <AnimatePresence>
        {showPopup && todos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 ${popupVertical} ${popupHorizontal} min-w-[220px] max-w-[280px] p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] shadow-lg dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.4)]`}
            style={{ pointerEvents: 'auto' }}
            onMouseEnter={() => setShowPopup(true)}
            onMouseLeave={() => !isDragActive && setShowPopup(false)}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                {format(date, 'EEEE, MMM d')}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  (onAddTask || onClick)();
                }}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                + Add
              </button>
            </div>

            {/* Task List — show all tasks; container scrolls via max-h + overflow-y-auto */}
            <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
              {todos.map((todo) => (
                <DraggableTaskItem
                  key={todo.id}
                  todo={todo}
                  onTaskClick={onTaskClick}
                  enableDrag={enableDragDrop}
                  onQuickComplete={onQuickComplete}
                  onToggleWaiting={onToggleWaiting}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { DraggableTaskItem };
