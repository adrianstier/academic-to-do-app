'use client';

import { Repeat } from 'lucide-react';
import type { RecurrencePattern } from '@/types/todo';

interface RecurrenceRowProps {
  todoId: string;
  recurrence: RecurrencePattern;
  onSetRecurrence: (id: string, recurrence: RecurrencePattern) => void;
}

export default function RecurrenceRow({ todoId, recurrence, onSetRecurrence }: RecurrenceRowProps) {
  return (
    <div>
      <label htmlFor={`recurrence-${todoId}`} className="text-xs font-medium text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
        <Repeat className="w-3.5 h-3.5" />
        Repeat
      </label>
      <select
        id={`recurrence-${todoId}`}
        value={recurrence || ''}
        onChange={(e) => onSetRecurrence(todoId, (e.target.value || null) as RecurrencePattern)}
        className="input-refined w-full text-sm px-3 py-2 text-[var(--foreground)] min-h-[44px]"
      >
        <option value="">No repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
    </div>
  );
}
