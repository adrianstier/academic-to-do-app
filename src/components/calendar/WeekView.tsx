'use client';

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  format,
  isToday,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from 'date-fns';
import { Todo } from '@/types/todo';
import { DraggableTaskItem } from './CalendarDayCell';
import { CATEGORY_COLORS, isTaskOverdue, STATUS_BORDER, getSubtaskProgress, isFollowUpOverdue, getInitials, hasPendingReminders } from './constants';
import { Clock, Bell } from 'lucide-react';
import CalendarDragOverlay from './CalendarDragOverlay';

/** Task count thresholds for badge color coding */
const TASK_COUNT_HIGH = 7;
const TASK_COUNT_MEDIUM = 4;

interface WeekViewProps {
  currentDate: Date;
  direction: 'left' | 'right';
  todosByDate: Map<string, Todo[]>;
  onDateClick: (date: Date) => void;
  onTaskClick: (todo: Todo) => void;
  onReschedule?: (todoId: string, newDate: string) => void;
  onAddTask?: (date: Date) => void;
  onQuickComplete?: (todoId: string) => void;
  onToggleWaiting?: (todoId: string, waiting: boolean) => void;
}

const weekVariants = {
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

function DroppableDayColumn({
  day,
  dayTodos,
  today,
  onDateClick,
  onTaskClick,
  onAddTask,
  enableDragDrop,
  isDragActive,
  onQuickComplete,
  onToggleWaiting,
}: {
  day: Date;
  dayTodos: Todo[];
  today: boolean;
  onDateClick: (date: Date) => void;
  onTaskClick: (todo: Todo) => void;
  onAddTask?: (date: Date) => void;
  enableDragDrop: boolean;
  isDragActive: boolean;
  onQuickComplete?: (todoId: string) => void;
  onToggleWaiting?: (todoId: string, waiting: boolean) => void;
}) {
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
  const dateKey = format(day, 'yyyy-MM-dd');
  const { setNodeRef, isOver } = useDroppable({
    id: `week-day-${dateKey}`,
    data: { dateKey, type: 'week-day' },
    disabled: !enableDragDrop,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col sm:flex-col rounded-lg border overflow-hidden sm:min-h-[200px] transition-all
        ${isOver
          ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/20 border-[var(--accent)]'
          : today
            ? 'ring-2 ring-[var(--accent)] border-[var(--accent)]/30 bg-[var(--accent)]/10'
            : isWeekend
              ? 'border-[var(--border)] bg-[var(--surface)]/50 opacity-75'
              : 'border-[var(--border)] bg-[var(--surface-2)]'
        }
      `}
    >
      {/* Day Header */}
      <button
        onClick={() => onDateClick(day)}
        className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
      >
        {/* Mobile: show full day name; tablet+: abbreviated */}
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase sm:hidden">
          {format(day, 'EEEE')}
        </span>
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase hidden sm:inline">
          {format(day, 'EEE')}
        </span>
        <span
          className={`
            text-sm font-bold
            ${today ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}
          `}
        >
          {format(day, 'd MMM')}
        </span>
        {dayTodos.length > 0 && (
          <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${
            dayTodos.length >= TASK_COUNT_HIGH
              ? 'bg-blue-500/10 text-blue-500'
              : dayTodos.length >= TASK_COUNT_MEDIUM
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-[var(--surface)] text-[var(--text-muted)]'
          }`}>
            {dayTodos.length} {dayTodos.length === 1 ? 'task' : 'tasks'}
          </span>
        )}
      </button>

      {/* Tasks */}
      <div className="flex-1 p-1.5 space-y-0.5 overflow-y-auto">
        {dayTodos.map((todo) => {
          const overdue = !todo.completed && isTaskOverdue(todo.due_date);
          const subtaskProgress = getSubtaskProgress(todo.subtasks);
          return (
            <div key={todo.id} className={`relative ${STATUS_BORDER[todo.status] || ''}`}>
              <DraggableTaskItem
                todo={todo}
                onTaskClick={onTaskClick}
                enableDrag={enableDragDrop}
                onQuickComplete={onQuickComplete}
                onToggleWaiting={onToggleWaiting}
              />
              {overdue && (
                <span
                  className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400 leading-none"
                  title="Overdue"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Overdue
                </span>
              )}
              {/* Task indicators */}
              {(todo.waiting_for_response || subtaskProgress || hasPendingReminders(todo.reminders, todo.reminder_at) || todo.assigned_to) && (
                <div className="flex items-center gap-1 px-2 pb-1 text-[10px]">
                  {todo.waiting_for_response && (
                    <span className={`flex items-center gap-0.5 ${isFollowUpOverdue(todo.waiting_since, todo.follow_up_after_hours) ? 'text-red-500' : 'text-amber-500'}`} title="Waiting for response">
                      <Clock className="w-3 h-3" />
                    </span>
                  )}
                  {subtaskProgress && (
                    <span className="text-[var(--text-muted)]" title="Subtask progress">
                      {subtaskProgress}
                    </span>
                  )}
                  {hasPendingReminders(todo.reminders, todo.reminder_at) && (
                    <span className="flex items-center text-[var(--text-muted)]" title="Has reminders">
                      <Bell className="w-3 h-3" />
                    </span>
                  )}
                  {todo.assigned_to && (
                    <span className="text-[var(--text-muted)] bg-[var(--surface)] px-1 rounded font-medium" title={`Assigned to ${todo.assigned_to}`}>
                      {getInitials(todo.assigned_to)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {dayTodos.length === 0 && (
          <button
            onClick={() => (onAddTask || onDateClick)(day)}
            className="w-full sm:h-full min-h-[40px] flex items-center justify-center text-xs text-[var(--text-muted)] hover:bg-[var(--surface-hover)] rounded-md transition-colors"
          >
            + Add task
          </button>
        )}
      </div>
    </div>
  );
}

export default function WeekView({
  currentDate,
  direction,
  todosByDate,
  onDateClick,
  onTaskClick,
  onReschedule,
  onAddTask,
  onQuickComplete,
  onToggleWaiting,
}: WeekViewProps) {
  const [activeTodo, setActiveTodo] = useState<Todo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(currentDate),
      end: endOfWeek(currentDate),
    });
  }, [currentDate]);

  // Flat lookup for drag resolution
  const allTodos = useMemo(() => {
    const map = new Map<string, Todo>();
    todosByDate.forEach((todos) => {
      todos.forEach((todo) => map.set(todo.id, todo));
    });
    return map;
  }, [todosByDate]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const todoId = event.active.data.current?.todoId;
    if (todoId) {
      setActiveTodo(allTodos.get(todoId) || null);
    }
  }, [allTodos]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTodo(null);
    const { active, over } = event;
    if (!over || !onReschedule) return;

    const todoId = active.data.current?.todoId;
    const newDateKey = over.data.current?.dateKey;

    if (todoId && newDateKey) {
      onReschedule(todoId, newDateKey);
    }
  }, [onReschedule]);

  const handleDragCancel = useCallback(() => {
    setActiveTodo(null);
  }, []);

  const enableDragDrop = !!onReschedule;
  const isDragActive = activeTodo !== null;

  const content = (
    <div className="flex-1 p-2 sm:p-4 overflow-auto">
      <AnimatePresence mode="popLayout" custom={direction}>
        <motion.div
          key={format(startOfWeek(currentDate), 'yyyy-MM-dd')}
          custom={direction}
          variants={weekVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-4 md:grid-cols-7 gap-2 h-full"
        >
          {weekDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayTodos = todosByDate.get(dateKey) || [];
            const today = isToday(day);

            return (
              <DroppableDayColumn
                key={dateKey}
                day={day}
                dayTodos={dayTodos}
                today={today}
                onDateClick={onDateClick}
                onTaskClick={onTaskClick}
                onAddTask={onAddTask}
                enableDragDrop={enableDragDrop}
                isDragActive={isDragActive}
                onQuickComplete={onQuickComplete}
                onToggleWaiting={onToggleWaiting}
              />
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );

  if (!enableDragDrop) return content;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {content}
      <CalendarDragOverlay activeTodo={activeTodo} />
    </DndContext>
  );
}
