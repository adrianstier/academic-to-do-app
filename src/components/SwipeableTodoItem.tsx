'use client';

import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { Check, Pencil, Trash2, Flag, RotateCcw } from 'lucide-react';
import TodoItem from './TodoItem';
import type { Todo, TodoPriority, TodoStatus, RecurrencePattern, Subtask, Attachment } from '@/types/todo';

/**
 * SwipeableTodoItem - A touch-friendly wrapper for TodoItem with swipe gestures
 *
 * Swipe left: Complete task (green indicator)
 * Swipe right: Reveal quick edit menu
 *
 * Only active on touch devices to preserve desktop UX
 */

export interface SwipeableTodoItemProps {
  todo: Todo;
  users: string[];
  currentUserName: string;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onStatusChange?: (id: string, status: TodoStatus) => void;
  onUpdateText?: (id: string, text: string) => void;
  onDuplicate?: (todo: Todo) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onSetRecurrence?: (id: string, recurrence: RecurrencePattern) => void;
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => void;
  onSaveAsTemplate?: (todo: Todo) => void;
  onUpdateAttachments?: (id: string, attachments: Attachment[], skipDbUpdate?: boolean) => void;
  onSetReminder?: (id: string, reminderAt: string | null) => void;
  // Optional: callback when edit mode is requested via swipe
  onEditRequest?: (todo: Todo) => void;
  // Optional: render custom content instead of default TodoItem
  children?: ReactNode;
  // Optional: disable swipe (e.g., when dragging)
  disabled?: boolean;
}

// Swipe thresholds
const SWIPE_THRESHOLD = 80; // Minimum distance to trigger action
const MAX_SWIPE_DISTANCE = 120; // Maximum visual feedback distance
const VELOCITY_THRESHOLD = 500; // Fast swipe threshold (px/s)

// Check if device supports touch
const isTouchDevice = () => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

export default function SwipeableTodoItem({
  todo,
  users,
  currentUserName,
  selected,
  onSelect,
  onToggle,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority,
  onStatusChange,
  onUpdateText,
  onDuplicate,
  onUpdateNotes,
  onSetRecurrence,
  onUpdateSubtasks,
  onSaveAsTemplate,
  onUpdateAttachments,
  onSetReminder,
  onEditRequest,
  children,
  disabled = false,
}: SwipeableTodoItemProps) {
  const [isTouchEnabled, setIsTouchEnabled] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Motion values for swipe animation
  const x = useMotionValue(0);

  // Transform x position to background opacity and icon scale
  const leftBgOpacity = useTransform(x, [-MAX_SWIPE_DISTANCE, 0], [1, 0]);
  const rightBgOpacity = useTransform(x, [0, MAX_SWIPE_DISTANCE], [0, 1]);
  const leftIconScale = useTransform(x, [-MAX_SWIPE_DISTANCE, -SWIPE_THRESHOLD, 0], [1.2, 1, 0.5]);
  const rightIconScale = useTransform(x, [0, SWIPE_THRESHOLD, MAX_SWIPE_DISTANCE], [0.5, 1, 1.2]);

  // Check touch support on mount
  useEffect(() => {
    setIsTouchEnabled(isTouchDevice());
  }, []);

  // Handle swipe end - determine if action should trigger
  const handleDragEnd = useCallback((_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const swipeDistance = offset.x;
    const swipeVelocity = velocity.x;

    // Fast swipe or far enough swipe triggers action
    const triggeredByVelocity = Math.abs(swipeVelocity) > VELOCITY_THRESHOLD;
    const triggeredByDistance = Math.abs(swipeDistance) > SWIPE_THRESHOLD;

    if (triggeredByVelocity || triggeredByDistance) {
      if (swipeDistance < 0) {
        // Swipe left - complete/reopen task
        setIsAnimating(true);
        // Animate to full swipe, then snap back
        animate(x, -MAX_SWIPE_DISTANCE, {
          type: 'spring',
          stiffness: 500,
          damping: 30,
          onComplete: () => {
            onToggle(todo.id, !todo.completed);
            // Snap back after action
            animate(x, 0, {
              type: 'spring',
              stiffness: 400,
              damping: 30,
              onComplete: () => setIsAnimating(false),
            });
          },
        });
      } else if (swipeDistance > 0) {
        // Swipe right - show edit menu
        setShowEditMenu(true);
        // Animate to threshold then hold
        animate(x, MAX_SWIPE_DISTANCE, {
          type: 'spring',
          stiffness: 500,
          damping: 30,
        });
      }
    } else {
      // Not enough swipe, snap back
      animate(x, 0, {
        type: 'spring',
        stiffness: 400,
        damping: 30,
      });
    }
  }, [todo.id, todo.completed, onToggle, x]);

  // Close edit menu when clicking elsewhere
  useEffect(() => {
    if (!showEditMenu) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowEditMenu(false);
        animate(x, 0, {
          type: 'spring',
          stiffness: 400,
          damping: 30,
        });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showEditMenu, x]);

  // Quick action handlers from edit menu
  const handleQuickEdit = useCallback(() => {
    setShowEditMenu(false);
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    if (onEditRequest) {
      onEditRequest(todo);
    }
  }, [onEditRequest, todo, x]);

  const handleQuickDelete = useCallback(() => {
    setShowEditMenu(false);
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    onDelete(todo.id);
  }, [onDelete, todo.id, x]);

  const handleQuickPriorityChange = useCallback((priority: TodoPriority) => {
    setShowEditMenu(false);
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    onSetPriority(todo.id, priority);
  }, [onSetPriority, todo.id, x]);

  const closeEditMenu = useCallback(() => {
    setShowEditMenu(false);
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
  }, [x]);

  // Helper to render the inner content
  const renderContent = () => {
    if (children) {
      return children;
    }
    return (
      <TodoItem
        todo={todo}
        users={users}
        currentUserName={currentUserName}
        selected={selected}
        onSelect={onSelect}
        onToggle={onToggle}
        onDelete={onDelete}
        onAssign={onAssign}
        onSetDueDate={onSetDueDate}
        onSetPriority={onSetPriority}
        onStatusChange={onStatusChange}
        onUpdateText={onUpdateText}
        onDuplicate={onDuplicate}
        onUpdateNotes={onUpdateNotes}
        onSetRecurrence={onSetRecurrence}
        onUpdateSubtasks={onUpdateSubtasks}
        onSaveAsTemplate={onSaveAsTemplate}
        onUpdateAttachments={onUpdateAttachments}
        onSetReminder={onSetReminder}
      />
    );
  };

  // If not a touch device or disabled, render content without swipe wrapper
  if (!isTouchEnabled || disabled) {
    return <>{renderContent()}</>;
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-x-clip overflow-y-visible rounded-[var(--radius-xl)]"
      role="listitem"
      aria-label={`Task: ${todo.text}. ${todo.completed ? 'Completed.' : ''} Swipe left to ${todo.completed ? 'reopen' : 'complete'}, swipe right for options.`}
    >
      {/* Left background - Complete action (green) */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-6 rounded-[var(--radius-xl)]"
        style={{
          opacity: leftBgOpacity,
          backgroundColor: todo.completed
            ? 'var(--warning)' // Yellow for reopen
            : 'var(--success)', // Green for complete
        }}
        aria-hidden="true"
      >
        <motion.div
          style={{ scale: leftIconScale }}
          className="flex items-center gap-2 text-white"
        >
          {todo.completed ? (
            <>
              <RotateCcw className="w-6 h-6" strokeWidth={2.5} />
              <span className="text-sm font-semibold">Reopen</span>
            </>
          ) : (
            <>
              <Check className="w-6 h-6" strokeWidth={2.5} />
              <span className="text-sm font-semibold">Done</span>
            </>
          )}
        </motion.div>
      </motion.div>

      {/* Right background - Edit menu (blue) */}
      <motion.div
        className="absolute inset-0 flex items-center justify-start pl-4 rounded-[var(--radius-xl)]"
        style={{
          opacity: rightBgOpacity,
          backgroundColor: 'var(--accent)',
        }}
        aria-hidden="true"
      >
        <motion.div
          style={{ scale: rightIconScale }}
          className="flex items-center gap-2 text-white"
        >
          <Pencil className="w-5 h-5" />
          <span className="text-sm font-semibold">Options</span>
        </motion.div>
      </motion.div>

      {/* Swipeable content */}
      <motion.div
        style={{ x }}
        drag={!isAnimating && !showEditMenu ? 'x' : false}
        dragConstraints={{ left: -MAX_SWIPE_DISTANCE, right: MAX_SWIPE_DISTANCE }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className="relative z-10 touch-pan-y"
      >
        {renderContent()}
      </motion.div>

      {/* Edit menu overlay - appears after swipe right */}
      {showEditMenu && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 flex items-center justify-start bg-[var(--accent)] rounded-[var(--radius-xl)]"
          role="menu"
          aria-label="Quick actions menu"
        >
          <div className="flex items-center gap-1 px-3">
            {/* Edit button */}
            {onEditRequest && (
              <button
                onClick={handleQuickEdit}
                className="flex flex-col items-center gap-1 p-3 rounded-[var(--radius-md)] hover:bg-white/20 active:bg-white/30 transition-colors touch-manipulation"
                role="menuitem"
                aria-label="Edit task"
              >
                <Pencil className="w-5 h-5 text-white" />
                <span className="text-xs text-white font-medium">Edit</span>
              </button>
            )}

            {/* Priority buttons */}
            <div className="flex flex-col items-center gap-1 p-2">
              <div className="flex gap-1">
                <button
                  onClick={() => handleQuickPriorityChange('urgent')}
                  className={`p-2 rounded-full transition-colors touch-manipulation ${
                    todo.priority === 'urgent'
                      ? 'bg-red-500 ring-2 ring-white'
                      : 'bg-red-500/70 hover:bg-red-500 active:bg-red-600'
                  }`}
                  role="menuitemradio"
                  aria-label="Set priority to urgent"
                  aria-checked={todo.priority === 'urgent'}
                >
                  <Flag className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => handleQuickPriorityChange('high')}
                  className={`p-2 rounded-full transition-colors touch-manipulation ${
                    todo.priority === 'high'
                      ? 'bg-orange-500 ring-2 ring-white'
                      : 'bg-orange-500/70 hover:bg-orange-500 active:bg-orange-600'
                  }`}
                  role="menuitemradio"
                  aria-label="Set priority to high"
                  aria-checked={todo.priority === 'high'}
                >
                  <Flag className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => handleQuickPriorityChange('medium')}
                  className={`p-2 rounded-full transition-colors touch-manipulation ${
                    todo.priority === 'medium'
                      ? 'bg-yellow-500 ring-2 ring-white'
                      : 'bg-yellow-500/70 hover:bg-yellow-500 active:bg-yellow-600'
                  }`}
                  role="menuitemradio"
                  aria-label="Set priority to medium"
                  aria-checked={todo.priority === 'medium'}
                >
                  <Flag className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => handleQuickPriorityChange('low')}
                  className={`p-2 rounded-full transition-colors touch-manipulation ${
                    todo.priority === 'low'
                      ? 'bg-blue-400 ring-2 ring-white'
                      : 'bg-blue-400/70 hover:bg-blue-400 active:bg-blue-500'
                  }`}
                  role="menuitemradio"
                  aria-label="Set priority to low"
                  aria-checked={todo.priority === 'low'}
                >
                  <Flag className="w-4 h-4 text-white" />
                </button>
              </div>
              <span className="text-xs text-white/80">Priority</span>
            </div>

            {/* Delete button */}
            <button
              onClick={handleQuickDelete}
              className="flex flex-col items-center gap-1 p-3 rounded-[var(--radius-md)] hover:bg-red-500/50 active:bg-red-500/70 transition-colors touch-manipulation"
              role="menuitem"
              aria-label="Delete task"
            >
              <Trash2 className="w-5 h-5 text-white" />
              <span className="text-xs text-white font-medium">Delete</span>
            </button>

            {/* Close button */}
            <button
              onClick={closeEditMenu}
              className="ml-auto p-3 rounded-[var(--radius-md)] hover:bg-white/20 active:bg-white/30 transition-colors touch-manipulation"
              aria-label="Close menu"
            >
              <span className="text-sm text-white font-medium">Close</span>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Hook to detect if the current device supports touch
 * Can be used by parent components to conditionally enable swipe features
 */
export function useIsTouchDevice(): boolean {
  const [isTouchEnabled, setIsTouchEnabled] = useState(false);

  useEffect(() => {
    setIsTouchEnabled(isTouchDevice());
  }, []);

  return isTouchEnabled;
}
