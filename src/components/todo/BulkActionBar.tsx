'use client';

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { X, Trash2, Check, Calendar, User, GitMerge, Zap } from 'lucide-react';
import { TodoPriority } from '@/types/todo';

interface BulkActionBarProps {
  selectedCount: number;
  users: string[];
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkComplete: () => void;
  onBulkAssign: (assignedTo: string) => void;
  onBulkReschedule: (date: string) => void;
  onBulkSetPriority: (priority: TodoPriority) => void;
  onInitiateMerge: () => void;
}

function BulkActionBar({
  selectedCount,
  users,
  onClearSelection,
  onBulkDelete,
  onBulkComplete,
  onBulkAssign,
  onBulkReschedule,
  onBulkSetPriority,
  onInitiateMerge,
}: BulkActionBarProps) {
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [showRescheduleDropdown, setShowRescheduleDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const barRef = useRef<HTMLDivElement>(null!);

  // Close all dropdowns
  const closeAllDropdowns = useCallback(() => {
    setShowAssignDropdown(false);
    setShowRescheduleDropdown(false);
    setShowPriorityDropdown(false);
  }, []);

  // Mutual exclusion: opening one dropdown closes others
  const toggleAssignDropdown = useCallback(() => {
    setShowRescheduleDropdown(false);
    setShowPriorityDropdown(false);
    setShowAssignDropdown(prev => !prev);
  }, []);

  const toggleRescheduleDropdown = useCallback(() => {
    setShowAssignDropdown(false);
    setShowPriorityDropdown(false);
    setShowRescheduleDropdown(prev => !prev);
  }, []);

  const togglePriorityDropdown = useCallback(() => {
    setShowAssignDropdown(false);
    setShowRescheduleDropdown(false);
    setShowPriorityDropdown(prev => !prev);
  }, []);

  // Click-outside handler to close dropdowns
  useEffect(() => {
    const anyOpen = showAssignDropdown || showRescheduleDropdown || showPriorityDropdown;
    if (!anyOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        closeAllDropdowns();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssignDropdown, showRescheduleDropdown, showPriorityDropdown, closeAllDropdowns]);

  // Helper to get date offset
  const getDateOffset = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  return (
    <div ref={barRef} className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-xl)] px-4 py-3 flex items-center gap-3 backdrop-blur-xl">
        <div className="flex items-center gap-2 pr-3 border-r border-[var(--border)]">
          <button
            onClick={onClearSelection}
            className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg transition-colors"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
          <span className="text-sm font-medium text-[var(--foreground)]">
            {selectedCount} selected
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Complete */}
          <button
            onClick={onBulkComplete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--success)] hover:bg-[var(--success-light)] rounded-lg transition-colors"
            title="Mark all as complete"
          >
            <Check className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Complete</span>
          </button>

          {/* Assign dropdown */}
          <div className="relative">
            <button
              onClick={toggleAssignDropdown}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-light)] rounded-lg transition-colors"
              title="Assign to user"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Assign</span>
            </button>
            {showAssignDropdown && (
              <div className="absolute bottom-full left-0 mb-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-1 min-w-[120px]">
                {users.map((user) => (
                  <button
                    key={user}
                    onClick={() => {
                      onBulkAssign(user);
                      setShowAssignDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface-2)] rounded transition-colors"
                  >
                    {user}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reschedule dropdown */}
          <div className="relative">
            <button
              onClick={toggleRescheduleDropdown}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--warning)] hover:bg-[var(--warning-light)] rounded-lg transition-colors"
              title="Reschedule"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reschedule</span>
            </button>
            {showRescheduleDropdown && (
              <div className="absolute bottom-full left-0 mb-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-1 min-w-[120px]">
                <button
                  onClick={() => {
                    onBulkReschedule(getDateOffset(0));
                    setShowRescheduleDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface-2)] rounded transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    onBulkReschedule(getDateOffset(1));
                    setShowRescheduleDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface-2)] rounded transition-colors"
                >
                  Tomorrow
                </button>
                <button
                  onClick={() => {
                    onBulkReschedule(getDateOffset(7));
                    setShowRescheduleDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface-2)] rounded transition-colors"
                >
                  Next week
                </button>
              </div>
            )}
          </div>

          {/* Priority dropdown */}
          <div className="relative">
            <button
              onClick={togglePriorityDropdown}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] rounded-lg transition-colors"
              title="Set priority"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Priority</span>
            </button>
            {showPriorityDropdown && (
              <div className="absolute bottom-full left-0 mb-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-1 min-w-[100px]">
                <button
                  onClick={() => {
                    onBulkSetPriority('urgent');
                    setShowPriorityDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface-2)] rounded transition-colors text-[var(--danger)]"
                >
                  Urgent
                </button>
                <button
                  onClick={() => {
                    onBulkSetPriority('high');
                    setShowPriorityDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface-2)] rounded transition-colors text-[var(--warning)]"
                >
                  High
                </button>
                <button
                  onClick={() => {
                    onBulkSetPriority('medium');
                    setShowPriorityDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface-2)] rounded transition-colors text-[var(--accent)]"
                >
                  Medium
                </button>
                <button
                  onClick={() => {
                    onBulkSetPriority('low');
                    setShowPriorityDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface-2)] rounded transition-colors text-[var(--text-muted)]"
                >
                  Low
                </button>
              </div>
            )}
          </div>

          {/* Merge (only if 2+ selected) */}
          {selectedCount >= 2 && (
            <button
              onClick={onInitiateMerge}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] rounded-lg transition-colors"
              title="Merge selected tasks"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Merge</span>
            </button>
          )}

          {/* Delete */}
          <button
            onClick={onBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-light)] rounded-lg transition-colors"
            title="Delete selected"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(BulkActionBar);
