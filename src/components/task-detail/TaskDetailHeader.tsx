'use client';

import { X, Edit3 } from 'lucide-react';
import type { Todo, TodoPriority } from '@/types/todo';
import { PRIORITY_CONFIG } from '@/types/todo';

interface TaskDetailHeaderProps {
  todo: Todo;
  editingText: boolean;
  text: string;
  onTextChange: (text: string) => void;
  onSaveText: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onClose: () => void;
  canEditText: boolean;
}

const PRIORITY_BORDER_COLORS: Record<TodoPriority, string> = {
  urgent: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#6b7280',
};

export default function TaskDetailHeader({
  todo,
  editingText,
  text,
  onTextChange,
  onSaveText,
  onCancelEdit,
  onStartEdit,
  onClose,
  canEditText,
}: TaskDetailHeaderProps) {
  const priority = todo.priority || 'medium';
  const borderColor = PRIORITY_BORDER_COLORS[priority];

  return (
    <div
      className="p-4 sm:p-5 pb-3 sm:pb-4"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editingText ? (
            <div className="space-y-2">
              <textarea
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSaveText();
                  }
                  if (e.key === 'Escape') onCancelEdit();
                }}
                className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--surface)] text-[var(--foreground)] text-lg font-semibold resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                rows={2}
                autoFocus
                aria-label="Edit task title"
              />
              <div className="flex gap-2">
                <button
                  onClick={onSaveText}
                  className="px-3 py-1.5 bg-[var(--accent)] text-white text-sm rounded-[var(--radius-md)] hover:bg-[var(--accent-hover)] transition-colors min-h-[36px]"
                >
                  Save
                </button>
                <button
                  onClick={onCancelEdit}
                  className="px-3 py-1.5 text-sm rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors min-h-[36px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => canEditText && onStartEdit()}
              className={`text-lg font-semibold leading-snug ${
                canEditText ? 'cursor-pointer hover:opacity-80' : ''
              } ${todo.completed ? 'text-[var(--text-light)] line-through opacity-60' : 'text-[var(--foreground)]'}`}
              role={canEditText ? 'button' : undefined}
              tabIndex={canEditText ? 0 : undefined}
              onKeyDown={(e) => {
                if (canEditText && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onStartEdit();
                }
              }}
              aria-label={canEditText ? `Edit task title: ${todo.text}` : undefined}
            >
              {todo.text}
              {canEditText && (
                <Edit3 className="inline-block w-4 h-4 ml-2 opacity-30" aria-hidden="true" />
              )}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
          aria-label="Close task details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
