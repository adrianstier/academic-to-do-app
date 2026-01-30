'use client';

import ReminderPicker from '@/components/ReminderPicker';
import type { Todo } from '@/types/todo';

interface ReminderRowProps {
  todo: Todo;
  onSetReminder: (id: string, reminderAt: string | null) => void;
}

export default function ReminderRow({ todo, onSetReminder }: ReminderRowProps) {
  if (todo.completed) return null;

  return (
    <div>
      <label className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">
        Reminder
      </label>
      <ReminderPicker
        value={todo.reminder_at || undefined}
        dueDate={todo.due_date || undefined}
        onChange={(time) => onSetReminder(todo.id, time)}
        compact
      />
    </div>
  );
}
