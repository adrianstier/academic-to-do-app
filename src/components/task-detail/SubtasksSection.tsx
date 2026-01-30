'use client';

import { ListTree, Mail } from 'lucide-react';
import type { Subtask } from '@/types/todo';
import CollapsibleSection from './CollapsibleSection';
import SubtaskItem from './SubtaskItem';

interface SubtasksSectionProps {
  todoId: string;
  subtasks: Subtask[];
  completedSubtasks: number;
  subtaskProgress: number;
  newSubtaskText: string;
  onNewSubtaskTextChange: (text: string) => void;
  onToggleSubtask: (id: string) => void;
  onDeleteSubtask: (id: string) => void;
  onUpdateSubtaskText: (id: string, text: string) => void;
  onAddSubtask: () => void;
  onShowContentImporter: () => void;
}

export default function SubtasksSection({
  subtasks,
  completedSubtasks,
  subtaskProgress,
  newSubtaskText,
  onNewSubtaskTextChange,
  onToggleSubtask,
  onDeleteSubtask,
  onUpdateSubtaskText,
  onAddSubtask,
  onShowContentImporter,
}: SubtasksSectionProps) {
  return (
    <CollapsibleSection
      title="Subtasks"
      icon={<ListTree className="w-4 h-4" />}
      badge={subtasks.length > 0 ? `${completedSubtasks}/${subtasks.length}` : undefined}
      defaultOpen={subtasks.length > 0}
      accentColor="var(--accent)"
      actions={
        <button
          onClick={onShowContentImporter}
          className="text-xs px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent-gold-light)] hover:bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] font-medium flex items-center gap-1.5 transition-colors"
          aria-label="Import content as subtasks"
        >
          <Mail className="w-3.5 h-3.5" />
          Import
        </button>
      }
    >
      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="mb-3">
          <div className="h-2 bg-[var(--accent)]/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${subtaskProgress}%` }}
              role="progressbar"
              aria-valuenow={subtaskProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Subtask progress: ${subtaskProgress}%`}
            />
          </div>
        </div>
      )}

      {/* Subtask list */}
      {subtasks.length > 0 && (
        <div className="space-y-2 mb-3">
          {subtasks.map((subtask) => (
            <SubtaskItem
              key={subtask.id}
              subtask={subtask}
              onToggle={onToggleSubtask}
              onDelete={onDeleteSubtask}
              onUpdate={onUpdateSubtaskText}
            />
          ))}
        </div>
      )}

      {/* Add subtask input */}
      <input
        type="text"
        value={newSubtaskText}
        onChange={(e) => onNewSubtaskTextChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && newSubtaskText.trim()) {
            onAddSubtask();
          }
        }}
        placeholder="Add a subtask (press Enter)..."
        className="input-refined w-full text-sm px-3 py-2 text-[var(--foreground)] min-h-[44px]"
        aria-label="Add a new subtask"
      />
    </CollapsibleSection>
  );
}
