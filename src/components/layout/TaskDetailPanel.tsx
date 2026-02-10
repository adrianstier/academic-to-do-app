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
  Sparkles,
  Wand2,
  GitMerge,
  Loader2,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import { useTheme } from '@/contexts/ThemeContext';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Todo, TodoPriority, TodoStatus, Subtask, User as UserType, PRIORITY_CONFIG, STATUS_CONFIG } from '@/types/todo';
import { fetchWithCsrf } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { sanitizeTranscription } from '@/lib/sanitize';

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

  // AI Action states
  const [aiActionLoading, setAiActionLoading] = useState<string | null>(null);
  const [aiSubtasksPreview, setAiSubtasksPreview] = useState<Subtask[] | null>(null);
  const [aiEnhancedText, setAiEnhancedText] = useState<string | null>(null);
  const [showAiActions, setShowAiActions] = useState(true);

  // Close on Escape key press (only when not editing text/notes)
  useEscapeKey(onClose, { enabled: !isEditingText && !isEditingNotes });

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
    await onUpdate(task.id, { assigned_to: assignedTo || '' });
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

  // ═══════════════════════════════════════════════════════════════════════════
  // AI ACTION HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleBreakIntoSubtasks = useCallback(async () => {
    if (aiActionLoading) return;
    setAiActionLoading('subtasks');
    setAiSubtasksPreview(null);

    try {
      const response = await fetchWithCsrf('/api/ai/breakdown-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskText: task.text,
          taskContext: task.notes || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate subtasks');
      }

      const data = await response.json();
      if (data.subtasks && data.subtasks.length > 0) {
        // Convert to proper Subtask format with IDs
        const previewSubtasks: Subtask[] = data.subtasks.map((st: { text: string; priority?: string; estimatedMinutes?: number }, index: number) => ({
          id: `preview-${Date.now()}-${index}`,
          text: st.text,
          completed: false,
          priority: st.priority || 'medium',
          estimatedMinutes: st.estimatedMinutes,
        }));
        setAiSubtasksPreview(previewSubtasks);
      }
    } catch (error) {
      logger.error('Failed to break task into subtasks', error, { component: 'TaskDetailPanel' });
    } finally {
      setAiActionLoading(null);
    }
  }, [task.text, task.notes, aiActionLoading]);

  const handleApplySubtasks = useCallback(async () => {
    if (!aiSubtasksPreview) return;

    // Generate proper IDs for the subtasks
    const newSubtasks: Subtask[] = aiSubtasksPreview.map((st, index) => ({
      ...st,
      id: crypto.randomUUID(),
    }));

    await onUpdate(task.id, {
      subtasks: [...(task.subtasks || []), ...newSubtasks],
    });
    setAiSubtasksPreview(null);
  }, [task.id, task.subtasks, aiSubtasksPreview, onUpdate]);

  const handleImproveDescription = useCallback(async () => {
    if (aiActionLoading) return;
    setAiActionLoading('enhance');
    setAiEnhancedText(null);

    try {
      const response = await fetchWithCsrf('/api/ai/enhance-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: task.text,
          users: users.map(u => u.name),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to enhance task');
      }

      const data = await response.json();
      if (data.enhancedText) {
        setAiEnhancedText(data.enhancedText);
      }
    } catch (error) {
      logger.error('Failed to enhance task description', error, { component: 'TaskDetailPanel' });
    } finally {
      setAiActionLoading(null);
    }
  }, [task.text, users, aiActionLoading]);

  const handleApplyEnhancedText = useCallback(async () => {
    if (!aiEnhancedText) return;
    await onUpdate(task.id, { text: aiEnhancedText });
    setAiEnhancedText(null);
    setEditedText(aiEnhancedText);
  }, [task.id, aiEnhancedText, onUpdate]);

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

  const priorityConfig = PRIORITY_CONFIG[task.priority || 'medium'];
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
            aria-label={task.completed ? 'Mark task as incomplete' : 'Mark task as complete'}
            aria-pressed={task.completed}
            className={`
              w-6 h-6 rounded-lg border-2 flex items-center justify-center
              transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
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

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close task details"
            className={`
              p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
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
              htmlFor={`task-status-${task.id}`}
            >
              <select
                id={`task-status-${task.id}`}
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value as TodoStatus)}
                className={`
                  w-full px-3 py-2 rounded-lg border text-sm font-medium
                  cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
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
              htmlFor={`task-priority-${task.id}`}
            >
              <select
                id={`task-priority-${task.id}`}
                value={task.priority}
                onChange={(e) => handlePriorityChange(e.target.value as TodoPriority)}
                className={`
                  w-full px-3 py-2 rounded-lg border text-sm font-medium
                  cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
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
              htmlFor={`task-assignee-${task.id}`}
            >
              <select
                id={`task-assignee-${task.id}`}
                value={task.assigned_to || ''}
                onChange={(e) => handleAssigneeChange(e.target.value || null)}
                className={`
                  w-full px-3 py-2 rounded-lg border text-sm font-medium
                  cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
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
              htmlFor={`task-duedate-${task.id}`}
            >
              <div className="relative">
                <input
                  id={`task-duedate-${task.id}`}
                  type="date"
                  value={task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : ''}
                  onChange={(e) => onUpdate(task.id, {
                    due_date: e.target.value ? `${e.target.value}T12:00:00.000Z` : ''
                  })}
                  className={`
                    w-full px-3 py-2 rounded-lg border text-sm font-medium
                    cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
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
                    aria-label={subtask.completed ? `Mark "${subtask.text}" as incomplete` : `Mark "${subtask.text}" as complete`}
                    aria-pressed={subtask.completed}
                    className={`
                      w-5 h-5 rounded-md border-2 flex items-center justify-center
                      transition-all flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
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
                    aria-label={`Delete subtask "${subtask.text}"`}
                    className={`
                      p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
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
                &ldquo;{sanitizeTranscription(task.transcription)}&rdquo;
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

          {/* ═══════════════════════════════════════════════════════════════════════════
              AI ACTIONS SECTION
              Contextual AI-powered actions for the current task
              ═══════════════════════════════════════════════════════════════════════════ */}
          <CollapsibleSection
            title="AI Actions"
            icon={<Sparkles className="w-4 h-4 text-[var(--accent)]" />}
            isOpen={showAiActions}
            onToggle={() => setShowAiActions(!showAiActions)}
            darkMode={darkMode}
          >
            <div className="space-y-3">
              {/* AI Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                {/* Break into subtasks */}
                <button
                  onClick={handleBreakIntoSubtasks}
                  disabled={aiActionLoading !== null}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all
                    ${darkMode
                      ? 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white border border-white/10'
                      : 'bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--surface-3)] border border-[var(--border)]'
                    }
                    ${aiActionLoading === 'subtasks' ? 'opacity-70' : ''}
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {aiActionLoading === 'subtasks' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ListChecks className="w-4 h-4 text-[var(--accent)]" />
                  )}
                  <span className="truncate">Break into subtasks</span>
                </button>

                {/* Improve description */}
                <button
                  onClick={handleImproveDescription}
                  disabled={aiActionLoading !== null}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all
                    ${darkMode
                      ? 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white border border-white/10'
                      : 'bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--surface-3)] border border-[var(--border)]'
                    }
                    ${aiActionLoading === 'enhance' ? 'opacity-70' : ''}
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {aiActionLoading === 'enhance' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4 text-[var(--accent)]" />
                  )}
                  <span className="truncate">Improve description</span>
                </button>

                {/* Draft email */}
                {onGenerateEmail && (
                  <button
                    onClick={() => onGenerateEmail(task)}
                    disabled={aiActionLoading !== null}
                    className={`
                      flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all
                      ${darkMode
                        ? 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white border border-white/10'
                        : 'bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--surface-3)] border border-[var(--border)]'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <Mail className="w-4 h-4 text-[var(--accent)]" />
                    <span className="truncate">Draft customer email</span>
                  </button>
                )}

                {/* Find duplicates (placeholder - would need duplicate detection logic) */}
                <button
                  disabled={true}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all
                    ${darkMode
                      ? 'bg-white/5 text-white/80 border border-white/10'
                      : 'bg-[var(--surface-2)] text-[var(--foreground)] border border-[var(--border)]'
                    }
                    opacity-50 cursor-not-allowed
                  `}
                  title="Coming soon"
                >
                  <GitMerge className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="truncate">Find duplicates</span>
                </button>
              </div>

              {/* AI Subtasks Preview */}
              <AnimatePresence>
                {aiSubtasksPreview && aiSubtasksPreview.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`
                      rounded-lg border overflow-hidden
                      ${darkMode
                        ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30'
                        : 'bg-[var(--accent)]/5 border-[var(--accent)]/20'
                      }
                    `}
                  >
                    <div className="px-3 py-2 border-b border-[var(--accent)]/20">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                        <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                          AI suggests {aiSubtasksPreview.length} subtask{aiSubtasksPreview.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      {aiSubtasksPreview.map((subtask, index) => (
                        <div
                          key={subtask.id}
                          className={`
                            flex items-center gap-2 text-sm
                            ${darkMode ? 'text-white/80' : 'text-[var(--foreground)]'}
                          `}
                        >
                          <CheckCircle2 className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                          <span>{subtask.text}</span>
                          {subtask.estimatedMinutes && (
                            <span className={`text-xs ml-auto ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
                              ~{subtask.estimatedMinutes}m
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 border-t border-[var(--accent)]/20 flex items-center justify-end gap-2">
                      <button
                        onClick={() => setAiSubtasksPreview(null)}
                        className={`
                          px-3 py-1.5 rounded-lg text-sm font-medium
                          ${darkMode
                            ? 'text-white/60 hover:text-white hover:bg-white/10'
                            : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                          }
                        `}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleApplySubtasks}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--accent)] hover:brightness-110"
                      >
                        Apply
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI Enhanced Text Preview */}
              <AnimatePresence>
                {aiEnhancedText && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`
                      rounded-lg border overflow-hidden
                      ${darkMode
                        ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30'
                        : 'bg-[var(--accent)]/5 border-[var(--accent)]/20'
                      }
                    `}
                  >
                    <div className="px-3 py-2 border-b border-[var(--accent)]/20">
                      <div className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-[var(--accent)]" />
                        <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                          Improved description
                        </span>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className={`text-sm ${darkMode ? 'text-white/80' : 'text-[var(--foreground)]'}`}>
                        {aiEnhancedText}
                      </p>
                      <div className="mt-2 pt-2 border-t border-[var(--accent)]/10">
                        <p className={`text-xs ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
                          Original: {task.text}
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-2 border-t border-[var(--accent)]/20 flex items-center justify-end gap-2">
                      <button
                        onClick={() => setAiEnhancedText(null)}
                        className={`
                          px-3 py-1.5 rounded-lg text-sm font-medium
                          ${darkMode
                            ? 'text-white/60 hover:text-white hover:bg-white/10'
                            : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                          }
                        `}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleApplyEnhancedText}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--accent)] hover:brightness-110"
                      >
                        Apply
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CollapsibleSection>
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
          onClick={() => {
            if (window.confirm('Are you sure you want to delete this task?')) {
              onDelete(task.id);
            }
          }}
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
            onClick={() => {
              const url = `${window.location.origin}?task=${task.id}`;
              navigator.clipboard.writeText(url).catch(() => {});
            }}
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
            onClick={() => {
              const url = `${window.location.origin}?task=${task.id}`;
              if (navigator.share) {
                navigator.share({ title: task.text, url }).catch(() => {});
              } else {
                navigator.clipboard.writeText(url).catch(() => {});
              }
            }}
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
  htmlFor,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  darkMode: boolean;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
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
