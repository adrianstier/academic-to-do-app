'use client';

import { useRef, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import type { Todo, TodoPriority, TodoStatus } from '@/types/todo';

interface MetadataSectionProps {
  todo: Todo;
  users: string[];
  onStatusChange?: (id: string, status: TodoStatus) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  // Snooze
  showSnoozeMenu: boolean;
  onToggleSnooze: () => void;
  onSnooze: (days: number) => void;
}

function isOverdue(dateStr: string, completed: boolean): boolean {
  if (completed) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

export default function MetadataSection({
  todo,
  users,
  onStatusChange,
  onSetPriority,
  onSetDueDate,
  onAssign,
  showSnoozeMenu,
  onToggleSnooze,
  onSnooze,
}: MetadataSectionProps) {
  const snoozeRef = useRef<HTMLDivElement>(null);

  // Close snooze menu on click outside
  useEffect(() => {
    if (!showSnoozeMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) {
        onToggleSnooze();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSnoozeMenu, onToggleSnooze]);

  const priority = todo.priority || 'medium';
  const status = todo.status || 'todo';
  const overdue = todo.due_date ? isOverdue(todo.due_date, todo.completed) : false;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Status */}
      {onStatusChange && (
        <div>
          <label htmlFor="task-status" className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">
            Status
          </label>
          <select
            id="task-status"
            value={status}
            onChange={(e) => onStatusChange(todo.id, e.target.value as TodoStatus)}
            className="input-refined w-full text-sm px-3 py-2 text-[var(--foreground)] min-h-[44px]"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      )}

      {/* Priority */}
      <div>
        <label htmlFor="task-priority" className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">
          Priority
        </label>
        <select
          id="task-priority"
          value={priority}
          onChange={(e) => onSetPriority(todo.id, e.target.value as TodoPriority)}
          className="input-refined w-full text-sm px-3 py-2 text-[var(--foreground)] min-h-[44px]"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {/* Due Date + Snooze */}
      <div>
        <label htmlFor="task-due-date" className="text-xs font-medium text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
          Due Date
          {overdue && (
            <span className="inline-flex items-center gap-1 text-[var(--danger)]">
              <AlertTriangle className="w-3 h-3" />
              <span className="text-[10px] font-semibold">OVERDUE</span>
            </span>
          )}
        </label>
        <div className="flex gap-1.5">
          <input
            id="task-due-date"
            type="date"
            value={todo.due_date ? todo.due_date.split('T')[0] : ''}
            onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
            className={`input-refined flex-1 min-w-0 text-sm px-3 py-2 text-[var(--foreground)] min-h-[44px] ${
              overdue ? 'border-[var(--danger)] bg-[var(--danger-light)]' : ''
            }`}
          />
          {!todo.completed && (
            <div className="relative" ref={snoozeRef}>
              <button
                onClick={onToggleSnooze}
                className="p-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--warning)] hover:border-[var(--warning)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Snooze (quick reschedule)"
                aria-label="Snooze task"
                aria-expanded={showSnoozeMenu}
                aria-haspopup="true"
              >
                <Clock className="w-4 h-4" />
              </button>
              {showSnoozeMenu && (
                <div className="absolute right-0 top-full mt-1 rounded-[var(--radius-lg)] shadow-xl z-50 py-1 min-w-[140px] border border-[var(--border)] bg-[var(--surface)]">
                  {[
                    { label: 'Tomorrow', days: 1 },
                    { label: 'In 2 Days', days: 2 },
                    { label: 'Next Week', days: 7 },
                    { label: 'Next Month', days: 30 },
                  ].map(({ label, days }) => (
                    <button
                      key={days}
                      onClick={() => onSnooze(days)}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--text-muted)] transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assigned To */}
      <div>
        <label htmlFor="task-assigned-to" className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">
          Assigned To
        </label>
        <select
          id="task-assigned-to"
          value={todo.assigned_to || ''}
          onChange={(e) => onAssign(todo.id, e.target.value || null)}
          className="input-refined w-full text-sm px-3 py-2 text-[var(--foreground)] min-h-[44px]"
        >
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user} value={user}>{user}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
