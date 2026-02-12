'use client';

import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { Todo } from '@/types/todo';

interface MiniCalendarProps {
  currentDate: Date;
  todosByDate: Map<string, Todo[]>;
  onDateClick: (date: Date) => void;
}

export default function MiniCalendar({
  currentDate,
  todosByDate,
  onDateClick,
}: MiniCalendarProps) {
  // Derive displayed month directly from the main view's currentDate —
  // no independent state, so the mini calendar always mirrors the main view.
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(monthEnd),
    });
  }, [currentDate]);

  return (
    <div>
      {/* Header — read-only month label, no independent navigation */}
      <div className="flex items-center justify-center mb-2">
        <span className="text-xs font-semibold text-[var(--foreground)]">
          {format(currentDate, 'MMM yyyy')}
        </span>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-[var(--text-muted)]">
            {d}
          </div>
        ))}
      </div>

      {/* Day Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const hasTasks = (todosByDate.get(dateKey)?.length || 0) > 0;
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = isSameDay(day, currentDate);
          const today = isToday(day);

          return (
            <button
              key={dateKey}
              onClick={() => onDateClick(day)}
              className={`
                relative w-full aspect-square flex items-center justify-center text-[11px] transition-colors
                ${isSelected
                  ? 'bg-[var(--accent)] text-white font-bold rounded-full'
                  : today
                    ? 'bg-[var(--accent)] text-white font-bold rounded-full'
                    : isCurrentMonth
                      ? 'text-[var(--foreground)] rounded hover:bg-[var(--surface-hover)]'
                      : 'text-[var(--text-muted)]/50 rounded hover:bg-[var(--surface-hover)]'
                }
              `}
            >
              {day.getDate()}
              {hasTasks && !isSelected && !today && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
