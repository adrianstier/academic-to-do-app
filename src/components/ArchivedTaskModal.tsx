'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { X, User, Calendar, Flag, Repeat, FileText, Paperclip, Clock, MessageSquare, Mic, Circle, Loader2, CheckCircle, Copy, Check, AlertCircle } from 'lucide-react';
import { Todo, PRIORITY_CONFIG, STATUS_CONFIG, Subtask } from '@/types/todo';
import AttachmentList from './AttachmentList';
import { generateSummary, copyToClipboard } from '@/lib/summaryGenerator';

interface ArchivedTaskModalProps {
  todo: Todo;
  onClose: () => void;
}

// Copy button states
type CopyState = 'idle' | 'success' | 'error';

export default function ArchivedTaskModal({ todo, onClose }: ArchivedTaskModalProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      // Generate summary - use the assigned_to or created_by as completedBy
      const completedBy = todo.assigned_to || todo.created_by;
      const summaryText = generateSummary(todo, completedBy, 'text');
      const success = await copyToClipboard(summaryText);

      if (success) {
        setCopyState('success');
        // Auto-clear success state after 2 seconds
        timeoutRef.current = setTimeout(() => {
          setCopyState('idle');
          timeoutRef.current = null;
        }, 2000);
      } else {
        throw new Error('Copy operation failed');
      }
    } catch {
      setCopyState('error');
      // Auto-clear error state after 4 seconds
      timeoutRef.current = setTimeout(() => {
        setCopyState('idle');
        timeoutRef.current = null;
      }, 4000);
    }
  }, [todo]);

  const getCompletedAtMs = (t: Todo): number | null => {
    // Try updated_at first if task is completed
    if (t.completed && t.updated_at) {
      const updatedMs = new Date(t.updated_at).getTime();
      if (!isNaN(updatedMs)) return updatedMs;
    }
    // Fallback to created_at
    if (t.created_at) {
      const createdMs = new Date(t.created_at).getTime();
      if (!isNaN(createdMs)) return createdMs;
    }
    return null;
  };

  const completedAt = getCompletedAtMs(todo);
  const priorityConfig = PRIORITY_CONFIG[todo.priority || 'medium'];
  const statusConfig = STATUS_CONFIG[todo.status || 'todo'];

  const completedSubtasks = (todo.subtasks || []).filter((st: Subtask) => st.completed).length;
  const totalSubtasks = (todo.subtasks || []).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-2xl)]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-[var(--foreground)] truncate">Archived Task</h2>
            {completedAt && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Completed {new Date(completedAt).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 ml-4 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Task Title */}
          <div>
            <h3 className="text-xl font-bold text-[var(--foreground)] leading-snug">{todo.text}</h3>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                {todo.status === 'done' ? (
                  <CheckCircle className="w-4 h-4" style={{ color: statusConfig.color }} />
                ) : todo.status === 'in_progress' ? (
                  <Loader2 className="w-4 h-4" style={{ color: statusConfig.color }} />
                ) : (
                  <Circle className="w-4 h-4" style={{ color: statusConfig.color }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-muted)]">Status</p>
                <p className="text-sm font-medium text-[var(--foreground)] capitalize">{todo.status || 'todo'}</p>
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                <Flag className="w-4 h-4" style={{ color: priorityConfig.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-muted)]">Priority</p>
                <p className="text-sm font-medium text-[var(--foreground)] capitalize">{todo.priority || 'medium'}</p>
              </div>
            </div>

            {/* Assigned To */}
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                <User className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-muted)]">Assigned To</p>
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{todo.assigned_to || 'Unassigned'}</p>
              </div>
            </div>

            {/* Created By */}
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                <User className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-muted)]">Created By</p>
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{todo.created_by}</p>
              </div>
            </div>

            {/* Due Date */}
            {todo.due_date && (
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                  <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-muted)]">Due Date</p>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {new Date(todo.due_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {/* Recurrence */}
            {todo.recurrence && (
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                  <Repeat className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-muted)]">Recurrence</p>
                  <p className="text-sm font-medium text-[var(--foreground)] capitalize">{todo.recurrence}</p>
                </div>
              </div>
            )}

            {/* Created At */}
            {todo.created_at && (
              <div className="flex items-center gap-2 col-span-2">
                <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                  <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-muted)]">Created At</p>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {new Date(todo.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {todo.notes && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                <h4 className="text-sm font-semibold text-[var(--foreground)]">Notes</h4>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{todo.notes}</p>
              </div>
            </div>
          )}

          {/* Transcription */}
          {todo.transcription && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-[var(--text-muted)]" />
                <h4 className="text-sm font-semibold text-[var(--foreground)]">Voicemail Transcription</h4>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed italic">{todo.transcription}</p>
              </div>
            </div>
          )}

          {/* Subtasks */}
          {totalSubtasks > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[var(--text-muted)]" />
                  <h4 className="text-sm font-semibold text-[var(--foreground)]">Subtasks</h4>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {completedSubtasks} of {totalSubtasks} completed
                </span>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-2">
                {(todo.subtasks || []).map((subtask: Subtask) => (
                  <div
                    key={subtask.id}
                    className={`flex items-start gap-3 p-2.5 rounded-[var(--radius-md)] ${
                      subtask.completed ? 'bg-[var(--surface)] opacity-60' : 'bg-[var(--surface)]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 mt-0.5 rounded-[var(--radius-sm)] border-2 flex items-center justify-center flex-shrink-0 ${
                        subtask.completed
                          ? 'bg-[var(--accent)] border-[var(--accent)]'
                          : 'border-[var(--border)]'
                      }`}
                    >
                      {subtask.completed && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug ${
                          subtask.completed
                            ? 'text-[var(--text-light)] line-through'
                            : 'text-[var(--foreground)]'
                        }`}
                      >
                        {subtask.text}
                      </p>
                      {subtask.estimatedMinutes && (
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          Estimated: {subtask.estimatedMinutes} min
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {todo.attachments && todo.attachments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-[var(--text-muted)]" />
                <h4 className="text-sm font-semibold text-[var(--foreground)]">Attachments</h4>
                <span className="text-xs text-[var(--text-muted)]">({todo.attachments.length})</span>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <AttachmentList
                  attachments={todo.attachments}
                  todoId={todo.id}
                  onRemove={() => {}} // Read-only in archive
                  canRemove={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)]">
          <button
            onClick={handleCopy}
            disabled={copyState === 'success'}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              copyState === 'success'
                ? 'bg-green-500 text-white cursor-default'
                : copyState === 'error'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white'
            }`}
          >
            {copyState === 'success' ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : copyState === 'error' ? (
              <>
                <AlertCircle className="w-4 h-4" />
                Try Again
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Summary
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
