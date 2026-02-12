'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { Todo } from '@/types/todo';
import CalendarDayCell from './CalendarDayCell';
import CalendarDragOverlay from './CalendarDragOverlay';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface MonthViewProps {
  currentMonth: Date;
  direction: 'left' | 'right';
  todosByDate: Map<string, Todo[]>;
  onDateClick: (date: Date) => void;
  onAddTask?: (date: Date) => void;
  onTaskClick: (todo: Todo) => void;
  onReschedule?: (todoId: string, newDate: string) => void;
  onQuickComplete?: (todoId: string) => void;
  onToggleWaiting?: (todoId: string, waiting: boolean) => void;
  onQuickAdd?: (dateKey: string, text: string) => void;
}

const monthVariants = {
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

export default function MonthView({
  currentMonth,
  direction,
  todosByDate,
  onDateClick,
  onAddTask,
  onTaskClick,
  onReschedule,
  onQuickComplete,
  onToggleWaiting,
  onQuickAdd,
}: MonthViewProps) {
  const [activeTodo, setActiveTodo] = useState<Todo | null>(null);
  const [focusedCellIndex, setFocusedCellIndex] = useState<{ row: number; col: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Require 8px of drag distance before starting (prevents accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Group calendar days into weeks (rows of 7) for ARIA grid structure
  const calendarWeeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }, [currentMonth]);

  // Build a flat lookup of all todos for drag resolution
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

  // Keyboard navigation handler for the grid container
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const maxRow = calendarWeeks.length - 1;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        setFocusedCellIndex((prev) => {
          const current = prev || { row: 0, col: 0 };
          let { row, col } = current;

          switch (e.key) {
            case 'ArrowUp':
              row = Math.max(0, row - 1);
              break;
            case 'ArrowDown':
              row = Math.min(maxRow, row + 1);
              break;
            case 'ArrowLeft':
              if (col === 0) {
                if (row > 0) {
                  row -= 1;
                  col = 6;
                }
              } else {
                col -= 1;
              }
              break;
            case 'ArrowRight':
              if (col === 6) {
                if (row < maxRow) {
                  row += 1;
                  col = 0;
                }
              } else {
                col += 1;
              }
              break;
          }
          return { row, col };
        });
      } else if (e.key === 'Enter') {
        if (focusedCellIndex) {
          const day = calendarWeeks[focusedCellIndex.row]?.[focusedCellIndex.col];
          if (day) {
            onDateClick(day);
          }
        }
      } else if (e.key === 'Escape') {
        setFocusedCellIndex(null);
      }
    },
    [calendarWeeks, focusedCellIndex, onDateClick]
  );

  // When grid receives focus and no cell is focused, default to today or first day of month
  const handleGridFocus = useCallback(() => {
    if (focusedCellIndex === null) {
      // Find today's cell if visible
      for (let row = 0; row < calendarWeeks.length; row++) {
        for (let col = 0; col < calendarWeeks[row].length; col++) {
          if (isToday(calendarWeeks[row][col])) {
            setFocusedCellIndex({ row, col });
            return;
          }
        }
      }
      // Otherwise find first day of current month
      for (let row = 0; row < calendarWeeks.length; row++) {
        for (let col = 0; col < calendarWeeks[row].length; col++) {
          if (isSameMonth(calendarWeeks[row][col], currentMonth)) {
            setFocusedCellIndex({ row, col });
            return;
          }
        }
      }
      // Fallback to first cell
      setFocusedCellIndex({ row: 0, col: 0 });
    }
  }, [focusedCellIndex, calendarWeeks, currentMonth]);

  // Scroll focused cell into view when it changes
  useEffect(() => {
    if (focusedCellIndex && gridRef.current) {
      const cell = gridRef.current.querySelector(
        `[data-cell-row="${focusedCellIndex.row}"][data-cell-col="${focusedCellIndex.col}"]`
      );
      if (cell) {
        (cell as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedCellIndex]);

  // Reset focused cell when month changes
  useEffect(() => {
    setFocusedCellIndex(null);
  }, [currentMonth]);

  const content = (
    <div
      ref={gridRef}
      role="grid"
      aria-label="Calendar month"
      tabIndex={0}
      onKeyDown={handleGridKeyDown}
      onFocus={handleGridFocus}
      className="flex-1 p-2 sm:p-4 overflow-auto outline-none"
    >
      {/* Weekday Headers */}
      <div role="row" className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="text-center text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day Grid */}
      <AnimatePresence mode="popLayout" custom={direction}>
        <motion.div
          key={format(currentMonth, 'yyyy-MM')}
          custom={direction}
          variants={monthVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="space-y-1"
        >
          {calendarWeeks.map((week, weekRowIndex) => (
            <div key={format(week[0], 'yyyy-MM-dd')} role="row" className="grid grid-cols-7 gap-1">
              {week.map((day, colIndex) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayTodos = todosByDate.get(dateKey) || [];

                return (
                  <CalendarDayCell
                    key={dateKey}
                    date={day}
                    todos={dayTodos}
                    isCurrentMonth={isSameMonth(day, currentMonth)}
                    isToday={isToday(day)}
                    onClick={() => onDateClick(day)}
                    onAddTask={onAddTask ? () => onAddTask(day) : undefined}
                    onTaskClick={onTaskClick}
                    enableDragDrop={enableDragDrop}
                    isDragActive={isDragActive}
                    columnIndex={colIndex}
                    rowIndex={weekRowIndex}
                    onQuickComplete={onQuickComplete}
                    onToggleWaiting={onToggleWaiting}
                    onQuickAdd={onQuickAdd}
                    isFocused={focusedCellIndex?.row === weekRowIndex && focusedCellIndex?.col === colIndex}
                  />
                );
              })}
            </div>
          ))}
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
