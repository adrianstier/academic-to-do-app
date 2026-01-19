'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, AlertTriangle, Calendar, CalendarClock, CalendarX } from 'lucide-react';
import { Todo, TodoPriority, Subtask, Attachment, RecurrencePattern } from '@/types/todo';
import { prefersReducedMotion, DURATION } from '@/lib/animations';
import { isToday, isPast, isFuture, parseISO, startOfDay } from 'date-fns';

// Section types for grouping
export type TaskSection = 'overdue' | 'today' | 'upcoming' | 'no_date';

interface TaskSectionData {
  id: TaskSection;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  tasks: Todo[];
}

interface TaskSectionsProps {
  todos: Todo[];
  users: string[];
  currentUserName: string;
  selectedTodos: Set<string>;
  showBulkActions: boolean;
  onSelectTodo?: (id: string, selected: boolean) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, user: string | null) => void;
  onSetDueDate: (id: string, date: string | null) => void;
  onSetReminder: (id: string, reminderAt: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onStatusChange: (id: string, status: 'todo' | 'in_progress' | 'done') => void;
  onUpdateText: (id: string, text: string) => void;
  onDuplicate: (todo: Todo) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onSetRecurrence: (id: string, pattern: RecurrencePattern | null) => void;
  onUpdateSubtasks: (id: string, subtasks: Subtask[]) => void;
  onUpdateAttachments: (id: string, attachments: Attachment[]) => void;
  onSaveAsTemplate: (todo: Todo) => void;
  onEmailCustomer: (todo: Todo) => void;
  isDragEnabled: boolean;
  renderTodoItem: (todo: Todo, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
}

// Check if a date is today
function checkIsToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  const date = parseISO(dateStr);
  return isToday(date);
}

// Check if a date is overdue (past and not today)
function checkIsOverdue(dateStr?: string, completed?: boolean): boolean {
  if (!dateStr || completed) return false;
  const date = startOfDay(parseISO(dateStr));
  const today = startOfDay(new Date());
  return date < today;
}

// Check if a date is upcoming (future, not today)
function checkIsUpcoming(dateStr?: string): boolean {
  if (!dateStr) return false;
  const date = startOfDay(parseISO(dateStr));
  const today = startOfDay(new Date());
  return date > today;
}

/**
 * TaskSections - Groups tasks into collapsible date-based sections
 *
 * Sections:
 * - Overdue: Tasks with due dates in the past (not completed)
 * - Today: Tasks due today
 * - Upcoming: Tasks due in the future
 * - No Date: Tasks without a due date
 */
export default function TaskSections({
  todos,
  renderTodoItem,
  emptyState,
}: TaskSectionsProps) {
  // Track collapsed state per section
  const [collapsedSections, setCollapsedSections] = useState<Set<TaskSection>>(new Set());

  // Group tasks into sections
  const sections = useMemo((): TaskSectionData[] => {
    const overdue: Todo[] = [];
    const today: Todo[] = [];
    const upcoming: Todo[] = [];
    const noDate: Todo[] = [];

    todos.forEach(todo => {
      // Skip completed tasks from section grouping (they're already filtered out by the parent)
      if (checkIsOverdue(todo.due_date, todo.completed)) {
        overdue.push(todo);
      } else if (checkIsToday(todo.due_date)) {
        today.push(todo);
      } else if (checkIsUpcoming(todo.due_date)) {
        upcoming.push(todo);
      } else {
        noDate.push(todo);
      }
    });

    return [
      {
        id: 'overdue',
        label: 'Overdue',
        icon: <AlertTriangle className="w-4 h-4" />,
        colorClass: 'text-[var(--danger)]',
        bgClass: 'bg-[var(--danger)]/10',
        tasks: overdue,
      },
      {
        id: 'today',
        label: 'Today',
        icon: <Calendar className="w-4 h-4" />,
        colorClass: 'text-[var(--accent)]',
        bgClass: 'bg-[var(--accent)]/10',
        tasks: today,
      },
      {
        id: 'upcoming',
        label: 'Upcoming',
        icon: <CalendarClock className="w-4 h-4" />,
        colorClass: 'text-[var(--text-muted)]',
        bgClass: 'bg-[var(--surface-2)]',
        tasks: upcoming,
      },
      {
        id: 'no_date',
        label: 'No Date',
        icon: <CalendarX className="w-4 h-4" />,
        colorClass: 'text-[var(--text-light)]',
        bgClass: 'bg-[var(--surface-2)]',
        tasks: noDate,
      },
    ];
  }, [todos]);

  // Toggle section collapse
  const toggleSection = useCallback((sectionId: TaskSection) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Check if all sections are empty
  const allEmpty = sections.every(s => s.tasks.length === 0);

  if (allEmpty && emptyState) {
    return <>{emptyState}</>;
  }

  // Calculate cumulative index for animation delays
  let cumulativeIndex = 0;

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        // Skip empty sections
        if (section.tasks.length === 0) return null;

        const isCollapsed = collapsedSections.has(section.id);
        const startIndex = cumulativeIndex;
        cumulativeIndex += section.tasks.length;

        return (
          <div key={section.id} className="space-y-2">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className={`
                w-full flex items-center gap-2 px-3 py-2 rounded-lg
                transition-colors duration-200
                hover:bg-[var(--surface-2)]
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]
              `}
              aria-expanded={!isCollapsed}
              aria-controls={`section-${section.id}`}
            >
              {/* Collapse indicator */}
              <motion.div
                initial={false}
                animate={{ rotate: isCollapsed ? 0 : 90 }}
                transition={{ duration: 0.15 }}
                className="text-[var(--text-muted)]"
              >
                <ChevronRight className="w-4 h-4" />
              </motion.div>

              {/* Section icon */}
              <span className={section.colorClass}>
                {section.icon}
              </span>

              {/* Section label */}
              <span className={`font-semibold text-sm uppercase tracking-wide ${section.colorClass}`}>
                {section.label}
              </span>

              {/* Task count badge */}
              <span className={`
                ml-auto px-2 py-0.5 rounded-full text-xs font-medium
                ${section.bgClass} ${section.colorClass}
              `}>
                {section.tasks.length}
              </span>
            </button>

            {/* Section Content */}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  id={`section-${section.id}`}
                  initial={prefersReducedMotion() ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={prefersReducedMotion() ? undefined : { opacity: 0, height: 0 }}
                  transition={{ duration: DURATION.normal }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pl-2">
                    {section.tasks.map((todo, index) => (
                      <div key={todo.id}>
                        {renderTodoItem(todo, startIndex + index)}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hook to determine if sectioned view should be used
 * Returns true if no custom sort is active and the view makes sense
 */
export function useShouldUseSections(sortOption: string): boolean {
  // Use sections view for date-based or default sorting
  // Don't use for custom ordering (drag-and-drop)
  return sortOption !== 'custom';
}
