'use client';

import { useState, useEffect } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import type { Subtask } from '@/types/todo';

interface SubtaskItemProps {
  subtask: Subtask;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
}

export default function SubtaskItem({ subtask, onToggle, onDelete, onUpdate }: SubtaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(subtask.text);

  // Sync editText when subtask.text changes externally (e.g., real-time updates)
  useEffect(() => {
    if (!isEditing) {
      setEditText(subtask.text);
    }
  }, [subtask.text, isEditing]);

  const handleSave = () => {
    if (editText.trim() && editText.trim() !== subtask.text) {
      onUpdate(subtask.id, editText.trim());
    } else {
      setEditText(subtask.text);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditText(subtask.text);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`group flex items-center gap-2 sm:gap-3 p-2.5 rounded-[var(--radius-md)] transition-colors ${
        subtask.completed ? 'bg-[var(--surface-2)] opacity-60' : 'bg-[var(--surface)]'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(subtask.id)}
        role="checkbox"
        aria-checked={subtask.completed}
        aria-label={`${subtask.completed ? 'Completed' : 'Incomplete'}: ${subtask.text}`}
        className={`w-6 h-6 sm:w-5 sm:h-5 rounded-[var(--radius-sm)] border-2 flex items-center justify-center flex-shrink-0 transition-all touch-manipulation ${
          subtask.completed
            ? 'bg-[var(--accent)] border-[var(--accent)]'
            : 'border-[var(--border)] hover:border-[var(--accent)] active:border-[var(--accent)]'
        }`}
      >
        {subtask.completed && <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-white" strokeWidth={3} />}
      </button>

      {/* Text or edit input */}
      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="flex-1 text-sm px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] bg-[var(--surface)] text-[var(--foreground)]"
        />
      ) : (
        <span
          onClick={() => !subtask.completed && setIsEditing(true)}
          className={`flex-1 text-sm leading-snug cursor-pointer ${
            subtask.completed ? 'text-[var(--text-light)] line-through' : 'text-[var(--foreground)] hover:text-[var(--accent)]'
          }`}
          title={subtask.completed ? undefined : 'Click to edit'}
        >
          {subtask.text}
        </span>
      )}

      {/* Estimated time */}
      {subtask.estimatedMinutes && !isEditing && (
        <span className="text-xs text-[var(--text-light)] whitespace-nowrap">{subtask.estimatedMinutes}m</span>
      )}

      {/* Edit button */}
      {!isEditing && !subtask.completed && (
        <button
          onClick={() => setIsEditing(true)}
          className="p-1.5 -m-1 text-[var(--text-light)] hover:text-[var(--accent)] active:text-[var(--accent-hover)] rounded transition-colors touch-manipulation opacity-100"
          aria-label={`Edit subtask: ${subtask.text}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Delete button */}
      <button
        onClick={() => onDelete(subtask.id)}
        className="p-1.5 -m-1 text-[var(--text-light)] hover:text-[var(--danger)] active:text-[var(--danger)] rounded transition-colors touch-manipulation"
        aria-label={`Delete subtask: ${subtask.text}`}
      >
        <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
      </button>
    </div>
  );
}
