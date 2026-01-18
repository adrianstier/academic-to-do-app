'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Check,
  Calendar,
  User,
  Flag,
  Clock,
  Paperclip,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Edit3,
  Save,
  MoreHorizontal,
  ArrowRight,
  ListChecks,
  FileText,
  Mic,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Archive,
  Copy,
  Share2,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import { useTheme } from '@/contexts/ThemeContext';
import { Todo, TodoPriority, TodoStatus, Subtask, User as UserType, PRIORITY_CONFIG, STATUS_CONFIG } from '@/types/todo';

// ═══════════════════════════════════════════════════════════════════════════
// TASK DETAIL PANEL
// A slide-over panel for viewing and editing task details
// Maintains context while providing full task information
// Features:
// - Header with quick actions
// - Inline editable fields
// - Subtask management
// - Notes/attachments/transcription sections
// - Activity timeline (optional)
// ═══════════════════════════════════════════════════════════════════════════

interface TaskDetailPanelProps {
  task: Todo;
  users: UserType[];
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<Todo>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onArchive?: (taskId: string) => Promise<void>;
  onGenerateEmail?: (task: Todo) => void;
}

export default function TaskDetailPanel({
  task,
  users,
  onClose,
  onUpdate,
  onDelete,
  onArchive,
  onGenerateEmail,
}: TaskDetailPanelProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';

  // Editing states
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState(task.text);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(task.notes || '');
  const [newSubtask, setNewSubtask] = useState('');
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [showAttachments, setShowAttachments] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [saving, setSaving] = useState(false);

  // Update local state when task changes
  useEffect(() => {
    setEditedText(task.text);
    setEditedNotes(task.notes || '');
  }, [task.id, task.text, task.notes]);

  const handleSaveText = useCallback(async () => {
    if (editedText.trim() && editedText !== task.text) {
      setSaving(true);
      await onUpdate(task.id, { text: editedText.trim() });
      setSaving(false);
    }
    setIsEditingText(false);
  }, [task.id, task.text, editedText, onUpdate]);

  const handleSaveNotes = useCallback(async () => {
    if (editedNotes !== (task.notes || '')) {
      setSaving(true);
      await onUpdate(task.id, { notes: editedNotes });
      setSaving(false);
    }
    setIsEditingNotes(false);
  }, [task.id, task.notes, editedNotes, onUpdate]);

  const handleToggleComplete = useCallback(async () => {
    await onUpdate(task.id, { completed: !task.completed });
  }, [task.id, task.completed, onUpdate]);

  const handlePriorityChange = useCallback(async (priority: TodoPriority) => {
    await onUpdate(task.id, { priority });
  }, [task.id, onUpdate]);

  const handleStatusChange = useCallback(async (status: TodoStatus) => {
    await onUpdate(task.id, { status });
  }, [task.id, onUpdate]);

  const handleAssigneeChange = useCallback(async (assignedTo: string | null) => {
    await onUpdate(task.id, { assigned_to: assignedTo || undefined });
  }, [task.id, onUpdate]);

  const handleAddSubtask = useCallback(async () => {
    if (!newSubtask.trim()) return;

    const newSubtaskItem: Subtask = {
      id: crypto.randomUUID(),
      text: newSubtask.trim(),
      completed: false,
      priority: 'medium',
    };

    await onUpdate(task.id, {
      subtasks: [...(task.subtasks || []), newSubtaskItem],
    });
    setNewSubtask('');
  }, [task.id, task.subtasks, newSubtask, onUpdate]);

  const handleToggleSubtask = useCallback(async (subtaskId: string) => {
    const updatedSubtasks = task.subtasks?.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    await onUpdate(task.id, { subtasks: updatedSubtasks });
  }, [task.id, task.subtasks, onUpdate]);

  const handleDeleteSubtask = useCallback(async (subtaskId: string) => {
    const updatedSubtasks = task.subtasks?.filter(s => s.id !== subtaskId);
    await onUpdate(task.id, { subtasks: updatedSubtasks });
  }, [task.id, task.subtasks, onUpdate]);

  // Due date info
  const dueDateInfo = task.due_date ? (() => {
    const dueDate = new Date(task.due_date);
    const isOverdue = isPast(dueDate) && !isToday(dueDate) && !task.completed;
    return {
      formatted: format(dueDate, 'MMM d, yyyy'),
      relative: formatDistanceToNow(dueDate, { addSuffix: true }),
      isOverdue,
      isToday: isToday(dueDate),
    };
  })() : null;

  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const statusConfig = STATUS_CONFIG[task.status];
  const assignedUser = users.find(u => u.name === task.assigned_to);
  const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ─── Header ─── */}
      <header
        className={`
          flex items-center justify-between px-6 py-4 border-b flex-shrink-0
          ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}
        `}
      >
        <div className="flex items-center gap-3">
          {/* Complete checkbox */}
          <button
            onClick={handleToggleComplete}
            className={`
              w-6 h-6 rounded-lg border-2 flex items-center justify-center
              transition-all
              ${task.completed
                ? 'bg-[var(--success)] border-[var(--success)]'
                : 'border-[var(--border)] hover:border-[var(--accent)]'
              }
            `}
          >
            {task.completed && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
          </button>

          <h2 className={`font-semibold ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
            Task Details
          </h2>
        </div>

        <div className="flex items-center gap-1">
          {/* Generate email button */}
          {onGenerateEmail && (
            <button
              onClick={() => onGenerateEmail(task)}
              className={`
                p-2 rounded-lg transition-colors
                ${darkMode
                  ? 'text-white/60 hover:text-white hover:bg-white/10'
                  : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                }
              `}
              title="Generate customer email"
            >
              <Mail className="w-5 h-5" />
            </button>
          )}

          {/* Archive button */}
          {onArchive && (
            <button
              onClick={() => onArchive(task.id)}
              className={`
                p-2 rounded-lg transition-colors
                ${darkMode
                  ? 'text-white/60 hover:text-white hover:bg-white/10'
                  : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                }
              `}
              title="Archive task"
            >
              <Archive className="w-5 h-5" />
            </button>
          )}

          {/* More options */}
          <button
            className={`
              p-2 rounded-lg transition-colors
              ${darkMode
                ? 'text-white/60 hover:text-white hover:bg-white/10'
                : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
              }
            `}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className={`
              p-2 rounded-lg transition-colors
              ${darkMode
                ? 'text-white/60 hover:text-white hover:bg-white/10'
                : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
              }
            `}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-6">
          {/* Task Title */}
          <section>
            {isEditingText ? (
              <div className="space-y-2">
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveText();
                    }
                    if (e.key === 'Escape') {
                      setEditedText(task.text);
                      setIsEditingText(false);
                    }
                  }}
                  autoFocus
                  className={`
                    w-full px-3 py-2 rounded-lg border text-lg font-medium
                    resize-none
                    ${darkMode
                      ? 'bg-white/5 border-white/20 text-white focus:border-[var(--accent)]'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] focus:border-[var(--accent)]'
                    }
                  `}
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveText}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:brightness-110"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditedText(task.text);
                      setIsEditingText(false);
                    }}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-medium
                      ${darkMode
                        ? 'bg-white/10 text-white/80'
                        : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                      }
                    `}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingText(true)}
                className={`
                  w-full text-left text-lg font-medium p-2 -m-2 rounded-lg
                  transition-colors group
                  ${task.completed ? 'line-through opacity-60' : ''}
                  ${darkMode
                    ? 'text-white hover:bg-white/5'
                    : 'text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                  }
                `}
              >
                {task.text}
                <Edit3 className={`
                  inline-block w-4 h-4 ml-2 opacity-0 group-hover:opacity-50
                  ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}
                `} />
              </button>
            )}
          </section>

          {/* Properties Grid */}
          <section className="grid grid-cols-2 gap-4">
            {/* Status */}
            <PropertyField
              label="Status"
              icon={<Clock className="w-4 h-4" />}
              darkMode={darkMode}
            >
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value as TodoStatus)}
                className={`
                  w-full px-3 py-2 rounded-lg border text-sm font-medium
                  cursor-pointer
                  ${darkMode
                    ? 'bg-white/5 border-white/10 text-white'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]'
                  }
                `}
              >
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <option key={value} value={value}>{config.label}</option>
                ))}
              </select>
            </PropertyField>

            {/* Priority */}
            <PropertyField
              label="Priority"
              icon={<Flag className="w-4 h-4" />}
              darkMode={darkMode}
            >
              <select
                value={task.priority}
                onChange={(e) => handlePriorityChange(e.target.value as TodoPriority)}
                className={`
                  w-full px-3 py-2 rounded-lg border text-sm font-medium
                  cursor-pointer
                  ${darkMode
                    ? 'bg-white/5 border-white/10 text-white'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]'
                  }
                `}
                style={{ color: priorityConfig.color }}
              >
                {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                  <option key={value} value={value} style={{ color: config.color }}>
                    {config.label}
                  </option>
                ))}
              </select>
            </PropertyField>

            {/* Assignee */}
            <PropertyField
              label="Assigned to"
              icon={<User className="w-4 h-4" />}
              darkMode={darkMode}
            >
              <select
                value={task.assigned_to || ''}
                onChange={(e) => handleAssigneeChange(e.target.value || null)}
                className={`
                  w-full px-3 py-2 rounded-lg border text-sm font-medium
                  cursor-pointer
                  ${darkMode
                    ? 'bg-white/5 border-white/10 text-white'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]'
                  }
                `}
              >
                <option value="">Unassigned</option>
                {users.map(user => (
                  <option key={user.id} value={user.name}>{user.name}</option>
                ))}
              </select>
            </PropertyField>

            {/* Due Date */}
            <PropertyField
              label="Due date"
              icon={<Calendar className="w-4 h-4" />}
              darkMode={darkMode}
            >
              <div className="relative">
                <input
                  type="date"
                  value={task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : ''}
                  onChange={(e) => onUpdate(task.id, {
                    due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined
                  })}
                  className={`
                    w-full px-3 py-2 rounded-lg border text-sm font-medium
                    cursor-pointer
                    ${darkMode
                      ? 'bg-white/5 border-white/10 text-white'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]'
                    }
                    ${dueDateInfo?.isOverdue ? 'text-[var(--danger)]' : ''}
                  `}
                />
                {dueDateInfo?.isOverdue && (
                  <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--danger)]" />
                )}
              </div>
            </PropertyField>
          </section>

          {/* Subtasks Section */}
          <CollapsibleSection
            title="Subtasks"
            icon={<ListChecks className="w-4 h-4" />}
            count={totalSubtasks > 0 ? `${completedSubtasks}/${totalSubtasks}` : undefined}
            isOpen={showSubtasks}
            onToggle={() => setShowSubtasks(!showSubtasks)}
            darkMode={darkMode}
          >
            <div className="space-y-2">
              {/* Existing subtasks */}
              {task.subtasks?.map(subtask => (
                <div
                  key={subtask.id}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg group
                    ${darkMode ? 'hover:bg-white/5' : 'hover:bg-[var(--surface-2)]'}
                  `}
                >
                  <button
                    onClick={() => handleToggleSubtask(subtask.id)}
                    className={`
                      w-5 h-5 rounded-md border-2 flex items-center justify-center
                      transition-all flex-shrink-0
                      ${subtask.completed
                        ? 'bg-[var(--success)] border-[var(--success)]'
                        : 'border-[var(--border)] hover:border-[var(--accent)]'
                      }
                    `}
                  >
                    {subtask.completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </button>

                  <span
                    className={`
                      flex-1 text-sm
                      ${subtask.completed
                        ? 'line-through opacity-50'
                        : ''
                      }
                      ${darkMode ? 'text-white/80' : 'text-[var(--foreground)]'}
                    `}
                  >
                    {subtask.text}
                  </span>

                  <button
                    onClick={() => handleDeleteSubtask(subtask.id)}
                    className={`
                      p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity
                      ${darkMode
                        ? 'text-white/40 hover:text-white hover:bg-white/10'
                        : 'text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)]'
                      }
                    `}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Add subtask input */}
              <div className="flex items-center gap-2 pt-2">
                <Plus className={`w-4 h-4 ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`} />
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  placeholder="Add a subtask..."
                  className={`
                    flex-1 px-2 py-1.5 text-sm bg-transparent border-none outline-none
                    ${darkMode
                      ? 'text-white placeholder-white/40'
                      : 'text-[var(--foreground)] placeholder-[var(--text-muted)]'
                    }
                  `}
                />
                {newSubtask.trim() && (
                  <button
                    onClick={handleAddSubtask}
                    className="px-2 py-1 rounded bg-[var(--accent)] text-white text-xs font-medium"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Notes Section */}
          <CollapsibleSection
            title="Notes"
            icon={<FileText className="w-4 h-4" />}
            isOpen={showNotes}
            onToggle={() => setShowNotes(!showNotes)}
            darkMode={darkMode}
          >
            {isEditingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="Add notes..."
                  autoFocus
                  className={`
                    w-full px-3 py-2 rounded-lg border text-sm
                    resize-none min-h-[100px]
                    ${darkMode
                      ? 'bg-white/5 border-white/20 text-white placeholder-white/40 focus:border-[var(--accent)]'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] placeholder-[var(--text-muted)] focus:border-[var(--accent)]'
                    }
                  `}
                  rows={4}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNotes}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:brightness-110"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditedNotes(task.notes || '');
                      setIsEditingNotes(false);
                    }}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-medium
                      ${darkMode
                        ? 'bg-white/10 text-white/80'
                        : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                      }
                    `}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingNotes(true)}
                className={`
                  w-full text-left text-sm p-3 rounded-lg
                  transition-colors
                  ${task.notes
                    ? darkMode
                      ? 'text-white/80 hover:bg-white/5'
                      : 'text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                    : darkMode
                      ? 'text-white/40 hover:bg-white/5 italic'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] italic'
                  }
                `}
              >
                {task.notes || 'Click to add notes...'}
              </button>
            )}
          </CollapsibleSection>

          {/* Transcription Section (if available) */}
          {task.transcription && (
            <CollapsibleSection
              title="Voicemail Transcription"
              icon={<Mic className="w-4 h-4" />}
              isOpen={true}
              onToggle={() => {}}
              darkMode={darkMode}
            >
              <div
                className={`
                  p-3 rounded-lg text-sm italic
                  ${darkMode
                    ? 'bg-white/5 text-white/70'
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                  }
                `}
              >
                &ldquo;{task.transcription}&rdquo;
              </div>
            </CollapsibleSection>
          )}

          {/* Attachments Section */}
          {task.attachments && task.attachments.length > 0 && (
            <CollapsibleSection
              title="Attachments"
              icon={<Paperclip className="w-4 h-4" />}
              count={task.attachments.length.toString()}
              isOpen={showAttachments}
              onToggle={() => setShowAttachments(!showAttachments)}
              darkMode={darkMode}
            >
              <div className="space-y-2">
                {task.attachments.map(attachment => (
                  <div
                    key={attachment.id}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg
                      ${darkMode ? 'bg-white/5' : 'bg-[var(--surface-2)]'}
                    `}
                  >
                    <div
                      className={`
                        w-8 h-8 rounded-lg flex items-center justify-center
                        ${darkMode ? 'bg-white/10' : 'bg-[var(--surface-3)]'}
                      `}
                    >
                      <Paperclip className={`w-4 h-4 ${darkMode ? 'text-white/60' : 'text-[var(--text-muted)]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                        {attachment.file_name}
                      </p>
                      <p className={`text-xs ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
                        {(attachment.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Metadata */}
          <section
            className={`
              pt-4 border-t text-xs space-y-1
              ${darkMode ? 'border-white/10 text-white/40' : 'border-[var(--border)] text-[var(--text-light)]'}
            `}
          >
            <p>Created by {task.created_by} {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</p>
            {task.updated_at && task.updated_by && (
              <p>Updated by {task.updated_by} {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}</p>
            )}
          </section>
        </div>
      </div>

      {/* ─── Footer Actions ─── */}
      <footer
        className={`
          flex items-center justify-between px-6 py-4 border-t flex-shrink-0
          ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}
        `}
      >
        <button
          onClick={() => onDelete(task.id)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
            transition-colors
            ${darkMode
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-[var(--danger)] hover:bg-[var(--danger-light)]'
            }
          `}
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>

        <div className="flex items-center gap-2">
          <button
            className={`
              p-2 rounded-lg transition-colors
              ${darkMode
                ? 'text-white/60 hover:text-white hover:bg-white/10'
                : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
              }
            `}
            title="Copy link"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            className={`
              p-2 rounded-lg transition-colors
              ${darkMode
                ? 'text-white/60 hover:text-white hover:bg-white/10'
                : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
              }
            `}
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function PropertyField({
  label,
  icon,
  children,
  darkMode,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  darkMode: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label
        className={`
          flex items-center gap-2 text-xs font-medium
          ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}
        `}
      >
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  count,
  isOpen,
  onToggle,
  children,
  darkMode,
}: {
  title: string;
  icon: React.ReactNode;
  count?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  darkMode: boolean;
}) {
  return (
    <section>
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center gap-2 py-2 text-sm font-medium
          transition-colors
          ${darkMode ? 'text-white/70 hover:text-white' : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'}
        `}
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {count && (
          <span
            className={`
              px-2 py-0.5 rounded-full text-xs
              ${darkMode ? 'bg-white/10' : 'bg-[var(--surface-2)]'}
            `}
          >
            {count}
          </span>
        )}
        {isOpen ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
