'use client';

import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TodoItem from './TodoItem';
import type { Todo, TodoPriority, TodoStatus, RecurrencePattern, Subtask, Attachment } from '@/types/todo';
import {
  listItemVariants,
  layoutTransition,
  prefersReducedMotion,
  DURATION,
} from '@/lib/animations';

interface AnimatedTodoItemProps {
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
  /** Animation variant */
  animationVariant?: 'default' | 'slide' | 'fade';
  /** Whether to animate layout changes */
  layoutAnimation?: boolean;
  /** Index for stagger animation delay */
  index?: number;
}

/**
 * AnimatedTodoItem - TodoItem wrapper with enter/exit and layout animations
 *
 * Features:
 * - Smooth enter animation when item appears
 * - Slide-out animation when item is deleted
 * - Layout animation for reordering
 * - Completion pulse effect
 * - Respects reduced motion preferences
 */
const AnimatedTodoItem = memo(function AnimatedTodoItem({
  todo,
  animationVariant = 'default',
  layoutAnimation = true,
  index = 0,
  ...props
}: AnimatedTodoItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const reducedMotion = prefersReducedMotion();

  // Enhanced delete handler with exit animation
  const handleDelete = useCallback((id: string) => {
    if (reducedMotion) {
      props.onDelete(id);
      return;
    }

    // Trigger exit animation, then call actual delete
    setIsExiting(true);
    // The actual delete will be called via onAnimationComplete
  }, [reducedMotion, props.onDelete]);

  // Animation variants based on variant prop
  const getVariants = () => {
    if (reducedMotion) return undefined;

    switch (animationVariant) {
      case 'slide':
        return {
          hidden: { opacity: 0, x: -20 },
          visible: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: '-100%', height: 0, marginBottom: 0 },
        };
      case 'fade':
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
          exit: { opacity: 0, height: 0, marginBottom: 0 },
        };
      default:
        return listItemVariants;
    }
  };

  // Calculate stagger delay
  const staggerDelay = index * 0.03;

  return (
    <motion.div
      layout={layoutAnimation && !reducedMotion}
      layoutId={layoutAnimation && !reducedMotion ? `todo-${todo.id}` : undefined}
      variants={getVariants()}
      initial={!reducedMotion ? 'hidden' : false}
      animate={!reducedMotion ? (isExiting ? 'exit' : 'visible') : undefined}
      exit={!reducedMotion ? 'exit' : undefined}
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              ...layoutTransition,
              delay: staggerDelay,
            }
      }
      onAnimationComplete={(definition) => {
        // If exit animation completed, trigger actual delete
        if (definition === 'exit' && isExiting) {
          props.onDelete(todo.id);
        }
      }}
      className="relative"
    >
      {/* Completion flash effect */}
      <AnimatePresence>
        {todo.completed && !reducedMotion && (
          <motion.div
            initial={{ opacity: 0.6, scale: 1.02 }}
            animate={{ opacity: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.medium }}
            className="absolute inset-0 bg-[var(--success)]/10 rounded-[var(--radius-xl)] pointer-events-none"
          />
        )}
      </AnimatePresence>

      <TodoItem
        todo={todo}
        {...props}
        onDelete={handleDelete}
      />
    </motion.div>
  );
});

export default AnimatedTodoItem;

/**
 * AnimatedTodoList - Container for AnimatedTodoItems with proper AnimatePresence
 */
interface AnimatedTodoListProps {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedTodoList({ children, className = '' }: AnimatedTodoListProps) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <div className={className}>{children}</div>
    </AnimatePresence>
  );
}
