'use client';

import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';
import type { Todo } from '@/types/todo';

interface TaskDetailFooterProps {
  todo: Todo;
  showDeleteConfirm: boolean;
  onShowDeleteConfirm: () => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
  onClose: () => void;
}

export default function TaskDetailFooter({
  todo,
  showDeleteConfirm,
  onShowDeleteConfirm,
  onDelete,
  onCancelDelete,
  onClose,
}: TaskDetailFooterProps) {
  if (showDeleteConfirm) {
    return (
      <div className="p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--surface-2)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[var(--danger-light)] flex items-center justify-center" aria-hidden="true">
            <AlertTriangle className="w-4 h-4 text-[var(--danger)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Delete this task?</p>
            <p className="text-xs text-[var(--text-muted)]">This action cannot be undone.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancelDelete}
            fullWidth
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onDelete(todo.id);
              onClose();
            }}
            fullWidth
          >
            Delete
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--surface-2)]">
      {/* Metadata */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-[var(--text-muted)] flex items-center gap-2 flex-wrap">
          {todo.created_by && <span>Created by {todo.created_by}</span>}
          {todo.created_at && (
            <span>
              &bull; {new Date(todo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {todo.updated_at && todo.updated_by && (
            <span className="hidden sm:inline">
              &bull; Updated by {todo.updated_by}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={onShowDeleteConfirm}
            className="text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)]"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
