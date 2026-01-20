'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, Trash2, Calendar, User, Flag, Copy, MessageSquare, ChevronDown, ChevronUp, Repeat, ListTree, Plus, Mail, Pencil, FileText, Paperclip, Music, Mic, Clock, MoreVertical, AlertTriangle, Bell, BellOff } from 'lucide-react';
import { Todo, TodoPriority, TodoStatus, PRIORITY_CONFIG, RecurrencePattern, Subtask, Attachment, MAX_ATTACHMENTS_PER_TODO } from '@/types/todo';
import { Badge, Button, IconButton } from '@/components/ui';
import AttachmentList from './AttachmentList';
import AttachmentUpload from './AttachmentUpload';
import Celebration from './Celebration';
import ReminderPicker from './ReminderPicker';
import ContentToSubtasksImporter from './ContentToSubtasksImporter';

// Map priority levels to Badge variants
const PRIORITY_TO_BADGE_VARIANT: Record<TodoPriority, 'danger' | 'warning' | 'info' | 'default'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

// Subtask item component with inline editing
interface SubtaskItemProps {
  subtask: Subtask;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
}

function SubtaskItem({ subtask, onToggle, onDelete, onUpdate }: SubtaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(subtask.text);

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
      className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-2.5 rounded-[var(--radius-md)] transition-colors ${
        subtask.completed ? 'bg-[var(--surface-2)] opacity-60' : 'bg-[var(--surface)]'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(subtask.id)}
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
          className="p-1.5 -m-1 text-[var(--text-light)] hover:text-[var(--accent)] active:text-[var(--accent-hover)] rounded transition-colors touch-manipulation opacity-0 group-hover:opacity-100 sm:opacity-100"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Delete button */}
      <button
        onClick={() => onDelete(subtask.id)}
        className="p-1.5 -m-1 text-[var(--text-light)] hover:text-[var(--danger)] active:text-[var(--danger)] rounded transition-colors touch-manipulation"
      >
        <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
      </button>
    </div>
  );
}

interface TodoItemProps {
  todo: Todo;
  users: string[];
  currentUserName: string;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onStatusChange?: (id: string, status: TodoStatus) => void;
  onUpdateText?: (id: string, text: string) => void;
  onDuplicate?: (todo: Todo) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onSetRecurrence?: (id: string, recurrence: RecurrencePattern) => void;
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => void;
  onSaveAsTemplate?: (todo: Todo) => void;
  onUpdateAttachments?: (id: string, attachments: Attachment[], skipDbUpdate?: boolean) => void;
  onEmailCustomer?: (todo: Todo) => void;
  onSetReminder?: (id: string, reminderAt: string | null) => void;
}

const formatDueDate = (date: string, includeYear = false) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDay = new Date(d);
  dueDay.setHours(0, 0, 0, 0);

  if (dueDay.getTime() === today.getTime()) return 'Today';
  if (dueDay.getTime() === tomorrow.getTime()) return 'Tomorrow';

  // Use "Dec 18, 2025" format for clarity
  const options: Intl.DateTimeFormatOptions = includeYear
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-US', options);
};

// Calculate days overdue for severity display
const getDaysOverdue = (date: string): number => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = today.getTime() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const getDueDateStatus = (date: string, completed: boolean): 'overdue' | 'today' | 'upcoming' | 'future' => {
  if (completed) return 'future';
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  d.setHours(0, 0, 0, 0);

  if (d < today) return 'overdue';
  if (d.getTime() === today.getTime()) return 'today';
  if (d <= weekFromNow) return 'upcoming';
  return 'future';
};

export default function TodoItem({
  todo,
  users,
  currentUserName,
  selected,
  onSelect,
  onToggle,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority,
  onStatusChange,
  onUpdateText,
  onDuplicate,
  onUpdateNotes,
  onSetRecurrence,
  onUpdateSubtasks,
  onSaveAsTemplate,
  onUpdateAttachments,
  onEmailCustomer,
  onSetReminder,
}: TodoItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [notes, setNotes] = useState(todo.notes || '');
  const [showNotes, setShowNotes] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [showContentImporter, setShowContentImporter] = useState(false);
  const [showAttachmentUpload, setShowAttachmentUpload] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [text, setText] = useState(todo.text);
  const menuRef = useRef<HTMLDivElement>(null);
  const priority = todo.priority || 'medium';
  const status = todo.status || 'todo';
  void status; // Used for status-based logic elsewhere

  // Close menu when clicking outside
  useEffect(() => {
    if (!showActionsMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
        setShowSnoozeMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActionsMenu]);

  // Helper to get date offset for snooze
  const getSnoozeDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const handleSnooze = (days: number) => {
    onSetDueDate(todo.id, getSnoozeDate(days));
    setShowSnoozeMenu(false);
  };
  const priorityConfig = PRIORITY_CONFIG[priority];
  const dueDateStatus = todo.due_date ? getDueDateStatus(todo.due_date, todo.completed) : null;

  const handleToggle = () => {
    if (!todo.completed) {
      setCelebrating(true);
    }
    onToggle(todo.id, !todo.completed);
  };

  const handleSaveText = () => {
    const trimmed = text.trim();
    if (onUpdateText && trimmed && trimmed !== todo.text) {
      onUpdateText(todo.id, trimmed);
    }
    setEditingText(false);
  };

  const handleNotesBlur = () => {
    if (onUpdateNotes && notes !== todo.notes) {
      onUpdateNotes(todo.id, notes);
    }
  };

  // Subtask functions
  const subtasks = todo.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  const toggleSubtask = (subtaskId: string) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    onUpdateSubtasks(todo.id, updated);
  };

  const deleteSubtask = (subtaskId: string) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.filter(s => s.id !== subtaskId);
    onUpdateSubtasks(todo.id, updated);
  };

  const updateSubtaskText = (subtaskId: string, newText: string) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.map(s =>
      s.id === subtaskId ? { ...s, text: newText } : s
    );
    onUpdateSubtasks(todo.id, updated);
  };

  const addManualSubtask = () => {
    if (!onUpdateSubtasks || !newSubtaskText.trim()) return;
    const newSubtask: Subtask = {
      id: `${todo.id}-sub-${Date.now()}`,
      text: newSubtaskText.trim(),
      completed: false,
      priority: 'medium',
    };
    onUpdateSubtasks(todo.id, [...subtasks, newSubtask]);
    setNewSubtaskText('');
  };

  const handleAddImportedSubtasks = (importedSubtasks: Subtask[]) => {
    if (!onUpdateSubtasks) return;
    // Merge imported subtasks with existing ones
    onUpdateSubtasks(todo.id, [...subtasks, ...importedSubtasks]);
    setShowSubtasks(true);
    setShowContentImporter(false);
  };

  // Sync local text state with todo.text when not editing - correct sync pattern
  useEffect(() => {
    if (!editingText) {
      setText(todo.text);
    }
  }, [todo.text, editingText]);

  // Priority-based left border color - always visible for quick scanning
  const getPriorityBorderClass = () => {
    switch (priority) {
      case 'urgent': return 'border-l-4 border-l-red-500';
      case 'high': return 'border-l-4 border-l-orange-500';
      case 'medium': return 'border-l-4 border-l-yellow-500';
      case 'low': return 'border-l-4 border-l-blue-400';
      default: return 'border-l-4 border-l-slate-300 dark:border-l-slate-600';
    }
  };

  // Card styling based on priority × overdue status
  const getCardStyle = () => {
    const priorityBorder = getPriorityBorderClass();

    // Completed tasks - keep priority bar but fade overall
    if (todo.completed) {
      return `bg-[var(--surface)] border-[var(--border-subtle)] opacity-60 ${priorityBorder}`;
    }
    // Selected state
    if (selected) {
      return `border-[var(--accent)] bg-[var(--accent-light)] ${priorityBorder}`;
    }
    // Overdue severity hierarchy
    if (dueDateStatus === 'overdue') {
      const isHighPriority = priority === 'urgent' || priority === 'high';
      if (isHighPriority) {
        // CRITICAL: Full red background for high-priority overdue
        return `bg-red-500/10 dark:bg-red-500/15 border-red-500/30 ${priorityBorder}`;
      }
      // Medium/Low overdue - priority bar + subtle styling
      return `bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-md)] ${priorityBorder}`;
    }
    // Default card with priority border
    return `bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-md)] ${priorityBorder}`;
  };

  return (
    <div
      id={`todo-${todo.id}`}
      role="listitem"
      className={`group relative rounded-[var(--radius-xl)] border transition-all duration-200 ${getCardStyle()} ${showActionsMenu ? 'z-[100]' : ''}`}
    >
      <Celebration trigger={celebrating} onComplete={() => setCelebrating(false)} />
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Selection checkbox (for bulk actions) */}
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(todo.id, e.target.checked)}
            className="w-4 h-4 rounded-[var(--radius-sm)] border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
          />
        )}

        {/* Completion checkbox - prominent one-click complete */}
        <button
          onClick={handleToggle}
          className={`w-8 h-8 sm:w-7 sm:h-7 rounded-[var(--radius-md)] border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 touch-manipulation hover:scale-110 active:scale-95 ${
            todo.completed
              ? 'bg-[var(--success)] border-[var(--success)] shadow-sm'
              : 'border-[var(--border)] hover:border-[var(--success)] hover:bg-[var(--success)]/10 hover:shadow-md active:border-[var(--success)]'
          }`}
          title={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {todo.completed && <Check className="w-5 h-5 sm:w-4 sm:h-4 text-white" strokeWidth={3} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
          {editingText ? (
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={handleSaveText}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveText();
                if (e.key === 'Escape') {
                  setText(todo.text);
                  setEditingText(false);
                }
              }}
              autoFocus
              className="input-refined w-full text-base sm:text-sm px-3 py-2 text-[var(--foreground)]"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p
              className={`font-semibold cursor-pointer line-clamp-2 ${
                todo.completed
                  ? 'text-[var(--text-light)] line-through'
                  : 'text-[var(--foreground)]'
              }`}
              title={todo.text}
            >
              {todo.text}
            </p>
          )}

          {/* Meta row - grouped with better spacing */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Priority + Date group */}
            <div className="flex items-center gap-2">
              <Badge
                variant={PRIORITY_TO_BADGE_VARIANT[priority]}
                size="sm"
                icon={<Flag className="w-3 h-3" />}
              >
                {priorityConfig.label}
              </Badge>

              {/* Due date - improved color coding with days overdue */}
              {todo.due_date && dueDateStatus && (() => {
                const daysOverdue = dueDateStatus === 'overdue' ? getDaysOverdue(todo.due_date) : 0;
                // Map due date status to Badge variant
                const dueDateVariant = todo.completed
                  ? 'default'
                  : dueDateStatus === 'overdue'
                    ? 'danger'
                    : dueDateStatus === 'today'
                      ? 'warning'
                      : dueDateStatus === 'upcoming'
                        ? 'warning'
                        : 'default';
                const dueDateIcon = dueDateStatus === 'overdue' && !todo.completed
                  ? <AlertTriangle className="w-3 h-3" />
                  : <Calendar className="w-3 h-3" />;
                const overdueText = dueDateStatus === 'overdue' && !todo.completed
                  ? ` (${daysOverdue === 1 ? '1 day' : `${daysOverdue} days`})`
                  : '';
                return (
                  <Badge
                    variant={dueDateVariant}
                    size="sm"
                    icon={dueDateIcon}
                    pulse={dueDateStatus === 'overdue' && !todo.completed}
                  >
                    {formatDueDate(todo.due_date)}{overdueText}
                  </Badge>
                );
              })()}

              {/* Recurrence indicator */}
              {todo.recurrence && (
                <Badge
                  variant="primary"
                  size="sm"
                  icon={<Repeat className="w-3 h-3" />}
                >
                  {todo.recurrence}
                </Badge>
              )}

              {/* Reminder indicator */}
              {todo.reminder_at && !todo.reminder_sent && !todo.completed && (
                <Badge
                  variant="info"
                  size="sm"
                  icon={<Bell className="w-3 h-3" />}
                >
                  {(() => {
                    const reminderDate = new Date(todo.reminder_at);
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
                    const diffDays = Math.round((reminderDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) {
                      return `Today ${reminderDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
                    } else if (diffDays === 1) {
                      return `Tomorrow ${reminderDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
                    } else if (diffDays < 0) {
                      return 'Past';
                    } else {
                      return reminderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }
                  })()}
                </Badge>
              )}
            </div>

            {/* Separator - only show if there are metadata badges (hidden on mobile) */}
            {(todo.assigned_to || subtasks.length > 0 || todo.notes || todo.transcription || (todo.attachments && todo.attachments.length > 0)) && (
              <div className="w-px h-4 bg-[var(--border)] mx-1 hidden sm:block" />
            )}

            {/* Assignment + Metadata group - secondary items hidden on mobile for density */}
            <div className="flex items-center gap-2">
              {/* Assigned to - hidden on mobile, shown in expanded view */}
              {todo.assigned_to && (
                <span className="hidden sm:inline-flex">
                  <Badge
                    variant="brand"
                    size="sm"
                    icon={<User className="w-3 h-3" />}
                  >
                    {todo.assigned_to}
                  </Badge>
                </span>
              )}

              {/* Subtasks indicator - always visible as it's actionable */}
              {subtasks.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSubtasks(!showSubtasks); }}
                  className="inline-flex items-center gap-1.5 touch-manipulation"
                >
                  <Badge
                    variant={subtaskProgress === 100 ? 'success' : 'primary'}
                    size="sm"
                    icon={<ListTree className="w-3 h-3" />}
                    interactive
                  >
                    {completedSubtasks}/{subtasks.length}
                    {subtaskProgress === 100 && <Check className="w-3 h-3 ml-0.5" />}
                  </Badge>
                </button>
              )}

              {/* Notes indicator - icon-only on mobile */}
              {todo.notes && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowNotes(!showNotes); }}
                  className="touch-manipulation"
                >
                  <Badge
                    variant="default"
                    size="sm"
                    icon={<MessageSquare className="w-3 h-3" />}
                    interactive
                  >
                    <span className="hidden sm:inline">Note</span>
                  </Badge>
                </button>
              )}

              {/* Transcription indicator - icon-only on mobile */}
              {todo.transcription && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowTranscription(!showTranscription); }}
                  className="touch-manipulation"
                >
                  <Badge
                    variant="info"
                    size="sm"
                    icon={<Mic className="w-3 h-3" />}
                    interactive
                  >
                    <span className="hidden sm:inline">Voicemail</span>
                  </Badge>
                </button>
              )}

              {/* Attachments indicator - always show count as it's important */}
              {todo.attachments && todo.attachments.length > 0 && (() => {
                const hasAudio = todo.attachments.some(a => a.file_type === 'audio');
                const AttachmentIcon = hasAudio ? Music : Paperclip;
                return (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAttachments(!showAttachments); }}
                    className="inline-flex items-center gap-1.5 touch-manipulation"
                  >
                    <Badge
                      variant={hasAudio ? 'info' : 'warning'}
                      size="sm"
                      icon={<AttachmentIcon className="w-3 h-3" />}
                      interactive
                    >
                      {todo.attachments.length}
                    </Badge>
                  </button>
                );
              })()}
            </div>

          </div>

          {/* Quick inline actions - visible on hover for incomplete tasks (hide when menu is open) */}
          {!todo.completed && !showActionsMenu && (
            <div
              className="hidden sm:flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="date"
                value={todo.due_date ? todo.due_date.split('T')[0] : ''}
                onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
                className="text-xs px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                title="Set due date"
              />
              <select
                value={todo.assigned_to || ''}
                onChange={(e) => onAssign(todo.id, e.target.value || null)}
                className="text-xs px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none min-w-[90px]"
                title="Assign to"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
              <select
                value={priority}
                onChange={(e) => onSetPriority(todo.id, e.target.value as TodoPriority)}
                className="text-xs px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                title="Set priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          )}
        </div>

        {/* Action buttons - expand and three-dot menu */}
        <div className="flex items-center gap-1">
          {/* Expand/collapse */}
          <IconButton
            variant="ghost"
            size="md"
            icon={expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse task details' : 'Expand task details'}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          />

          {/* Three-dot menu */}
          <div className="relative" ref={menuRef}>
            <IconButton
              variant="ghost"
              size="md"
              icon={<MoreVertical className="w-4 h-4" />}
              onClick={(e) => { e.stopPropagation(); setShowActionsMenu(!showActionsMenu); }}
              aria-label="Task actions"
              aria-haspopup="true"
              aria-expanded={showActionsMenu}
              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            />

            {showActionsMenu && (
              <div
                className="absolute right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-xl z-[110] py-1 min-w-[180px]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Edit */}
                {onUpdateText && (
                  <button
                    onClick={() => { setEditingText(true); setExpanded(true); setShowActionsMenu(false); }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--foreground)] flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4 text-[var(--text-muted)]" />
                    Edit
                  </button>
                )}

                {/* Duplicate */}
                {onDuplicate && (
                  <button
                    onClick={() => { onDuplicate(todo); setShowActionsMenu(false); }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--foreground)] flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                    Duplicate
                  </button>
                )}

                {/* Snooze submenu */}
                {!todo.completed && (
                  <div className="relative group/snooze">
                    <button
                      onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--foreground)] flex items-center gap-2"
                    >
                      <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                      Snooze
                      <ChevronDown className="w-3 h-3 ml-auto text-[var(--text-muted)]" />
                    </button>
                    {showSnoozeMenu && (
                      <div className="pl-6 py-1 border-t border-[var(--border)]">
                        <button onClick={() => { handleSnooze(1); setShowActionsMenu(false); }} className="w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--text-muted)]">Tomorrow</button>
                        <button onClick={() => { handleSnooze(2); setShowActionsMenu(false); }} className="w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--text-muted)]">In 2 Days</button>
                        <button onClick={() => { handleSnooze(7); setShowActionsMenu(false); }} className="w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--text-muted)]">Next Week</button>
                        <button onClick={() => { handleSnooze(30); setShowActionsMenu(false); }} className="w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--text-muted)]">Next Month</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="h-px bg-[var(--border)] my-1" />

                {/* Save as Template */}
                {onSaveAsTemplate && (
                  <button
                    onClick={() => { onSaveAsTemplate(todo); setShowActionsMenu(false); }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--foreground)] flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                    Save as Template
                  </button>
                )}

                {/* Email Customer */}
                {onEmailCustomer && (
                  <button
                    onClick={() => { onEmailCustomer(todo); setShowActionsMenu(false); }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--foreground)] flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                    Email Summary
                  </button>
                )}

                <div className="h-px bg-[var(--border)] my-1" />

                {/* Delete - shows confirmation */}
                <button
                  onClick={() => { setShowDeleteConfirm(true); setShowActionsMenu(false); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--danger-light)] text-[var(--danger)] flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div
            className="bg-[var(--surface)] rounded-[var(--radius-xl)] shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">Delete Task?</h3>
                <p className="text-sm text-[var(--text-muted)]">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-6 line-clamp-2">
              &ldquo;{todo.text}&rdquo;
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowDeleteConfirm(false)}
                fullWidth
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => { onDelete(todo.id); setShowDeleteConfirm(false); }}
                fullWidth
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notes display */}
      {showNotes && todo.notes && (
        <div className="mx-4 mb-3 p-3 bg-[var(--surface-2)] rounded-[var(--radius-md)] text-sm text-[var(--text-muted)]">
          {todo.notes}
        </div>
      )}

      {/* Transcription display */}
      {showTranscription && todo.transcription && (
        <div className="mx-3 sm:mx-4 mb-3 p-3 bg-purple-500/5 rounded-[var(--radius-lg)] border border-purple-500/10">
          <div className="flex items-center gap-2 mb-2">
            <Mic className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-500">Voicemail Transcription</span>
          </div>
          <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
            {todo.transcription}
          </p>
        </div>
      )}

      {/* Subtasks display - separate toggle when not expanded */}
      {!expanded && showSubtasks && subtasks.length > 0 && (
        <div className="mx-3 sm:mx-4 mb-3 p-3 bg-[var(--accent-light)] rounded-[var(--radius-lg)] border border-[var(--accent)]/10">
          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-[var(--accent)] mb-1">
              <span>Progress</span>
              <span>{subtaskProgress}%</span>
            </div>
            <div className="h-2 bg-[var(--accent)]/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${subtaskProgress}%` }}
              />
            </div>
          </div>

          {/* Subtask list */}
          <div className="space-y-2">
            {subtasks.map((subtask) => (
              <SubtaskItem
                key={subtask.id}
                subtask={subtask}
                onToggle={toggleSubtask}
                onDelete={deleteSubtask}
                onUpdate={updateSubtaskText}
              />
            ))}
          </div>
        </div>
      )}

      {/* Attachments display - separate toggle when not expanded */}
      {!expanded && showAttachments && todo.attachments && todo.attachments.length > 0 && (
        <div className="mx-3 sm:mx-4 mb-3 p-3 bg-[var(--accent-gold-light)] rounded-[var(--radius-lg)] border border-[var(--accent-gold)]/10">
          <div className="flex items-center gap-2 mb-3">
            <Paperclip className="w-4 h-4 text-[var(--accent-gold)]" />
            <span className="text-sm font-medium text-[var(--accent-gold)]">Attachments</span>
            <span className="text-xs text-[var(--accent-gold)]/70">({todo.attachments.length})</span>
          </div>
          <AttachmentList
            attachments={todo.attachments}
            todoId={todo.id}
            onRemove={(attachmentId) => {
              if (onUpdateAttachments) {
                // skipDbUpdate=true because the DELETE API already updated the database
                const updated = todo.attachments?.filter(a => a.id !== attachmentId) || [];
                onUpdateAttachments(todo.id, updated, true);
              }
            }}
            canRemove={!!onUpdateAttachments && !todo.completed}
          />
        </div>
      )}

      {/* Expanded actions - redesigned with clear sections */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-[var(--border-subtle)]">

          {/* PRIMARY ACTION - Mark Done/Reopen prominently displayed */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant={todo.completed ? 'secondary' : 'success'}
              size="md"
              leftIcon={<Check className="w-4 h-4" />}
              onClick={handleToggle}
            >
              {todo.completed ? 'Reopen Task' : 'Mark Done'}
            </Button>

            {/* Secondary actions: Duplicate, Save Template */}
            <div className="flex items-center gap-2">
              {onDuplicate && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<Copy className="w-4 h-4" />}
                  onClick={() => onDuplicate(todo)}
                  aria-label="Duplicate task"
                />
              )}
              {onSaveAsTemplate && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<FileText className="w-4 h-4" />}
                  onClick={() => onSaveAsTemplate(todo)}
                  aria-label="Save as template"
                />
              )}
              {onEmailCustomer && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<Mail className="w-4 h-4" />}
                  onClick={() => onEmailCustomer(todo)}
                  aria-label="Email summary"
                />
              )}
            </div>
          </div>

          {/* SECTION 1: Core Fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              {onStatusChange && (
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">Status</label>
                  <select
                    value={status}
                    onChange={(e) => onStatusChange(todo.id, e.target.value as TodoStatus)}
                    className="input-refined w-full text-sm px-3 py-2 text-[var(--foreground)]"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => onSetPriority(todo.id, e.target.value as TodoPriority)}
                  className="input-refined w-full text-sm px-3 py-2 text-[var(--foreground)]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Due date with overdue warning */}
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block flex items-center gap-1.5">
                  Due Date
                  {dueDateStatus === 'overdue' && !todo.completed && (
                    <span className="inline-flex items-center gap-1 text-red-500">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">OVERDUE</span>
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={todo.due_date ? todo.due_date.split('T')[0] : ''}
                  onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
                  className={`input-refined w-full text-sm px-3 py-2 text-[var(--foreground)] ${
                    dueDateStatus === 'overdue' && !todo.completed ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''
                  }`}
                />
              </div>

              {/* Assign to */}
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">Assigned To</label>
                <select
                  value={todo.assigned_to || ''}
                  onChange={(e) => onAssign(todo.id, e.target.value || null)}
                  className="input-refined w-full text-sm px-3 py-2 text-[var(--foreground)]"
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Recurrence - full width */}
            {onSetRecurrence && (
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">Repeat</label>
                <select
                  value={todo.recurrence || ''}
                  onChange={(e) => onSetRecurrence(todo.id, (e.target.value || null) as RecurrencePattern)}
                  className="input-refined w-full text-sm px-3 py-2 text-[var(--foreground)]"
                >
                  <option value="">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}

            {/* Reminder */}
            {onSetReminder && !todo.completed && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">Reminder</label>
                <ReminderPicker
                  value={todo.reminder_at || undefined}
                  dueDate={todo.due_date || undefined}
                  onChange={(time) => onSetReminder(todo.id, time)}
                  compact
                />
              </div>
            )}
          </div>

          {/* SECTION DIVIDER */}
          <div className="h-px bg-[var(--border)] my-4" />

          {/* SECTION 2: Notes */}
          {onUpdateNotes && (
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--text-muted)] mb-1.5 block">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add notes or context..."
                className="input-refined w-full text-sm px-3 py-2.5 text-[var(--foreground)] resize-none"
                rows={2}
              />
            </div>
          )}

          {/* SECTION 3: Subtasks */}
          {onUpdateSubtasks && (
            <div className="mb-4 p-3 bg-[var(--accent-light)] rounded-[var(--radius-lg)] border border-[var(--accent)]/10">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ListTree className="w-4 h-4 text-[var(--accent)]" />
                  <span className="text-sm font-medium text-[var(--accent)]">Subtasks</span>
                  {subtasks.length > 0 && (
                    <span className="text-xs text-[var(--accent)]/70">({completedSubtasks}/{subtasks.length})</span>
                  )}
                </div>
                <button
                  onClick={() => setShowContentImporter(true)}
                  className="text-xs px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent-gold-light)] hover:bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Import
                </button>
              </div>

              {/* Progress bar */}
              {subtasks.length > 0 && (
                <div className="mb-3">
                  <div className="h-2 bg-[var(--accent)]/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${subtaskProgress}%` }}
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
                      onToggle={toggleSubtask}
                      onDelete={deleteSubtask}
                      onUpdate={updateSubtaskText}
                    />
                  ))}
                </div>
              )}

              {/* Add subtask input - Enter to add, no separate button */}
              <input
                type="text"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSubtaskText.trim()) {
                    addManualSubtask();
                  }
                }}
                placeholder="Add a subtask (press Enter)..."
                className="input-refined w-full text-sm px-3 py-2 text-[var(--foreground)]"
              />
            </div>
          )}

          {/* SECTION 4: Attachments */}
          {onUpdateAttachments && (
            <div className="mb-4 p-3 bg-[var(--accent-gold-light)] rounded-[var(--radius-lg)] border border-[var(--accent-gold)]/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-[var(--accent-gold)]" />
                  <span className="text-sm font-medium text-[var(--accent-gold)]">Attachments</span>
                  {todo.attachments && todo.attachments.length > 0 && (
                    <span className="text-xs text-[var(--accent-gold)]/70">
                      ({todo.attachments.length}/{MAX_ATTACHMENTS_PER_TODO})
                    </span>
                  )}
                </div>
                {(todo.attachments?.length || 0) < MAX_ATTACHMENTS_PER_TODO && (
                  <button
                    onClick={() => setShowAttachmentUpload(true)}
                    className="text-xs px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                )}
              </div>

              {/* Attachment list or drop zone */}
              {todo.attachments && todo.attachments.length > 0 ? (
                <AttachmentList
                  attachments={todo.attachments}
                  todoId={todo.id}
                  onRemove={(attachmentId) => {
                    const updated = todo.attachments?.filter(a => a.id !== attachmentId) || [];
                    onUpdateAttachments(todo.id, updated, true);
                  }}
                  canRemove={true}
                />
              ) : (
                <button
                  onClick={() => setShowAttachmentUpload(true)}
                  className="w-full p-4 border-2 border-dashed border-[var(--accent-gold)]/30 rounded-[var(--radius-md)] text-center hover:border-[var(--accent-gold)]/50 hover:bg-[var(--accent-gold)]/5 transition-colors cursor-pointer"
                >
                  <Paperclip className="w-5 h-5 text-[var(--accent-gold)]/50 mx-auto mb-1" />
                  <p className="text-xs text-[var(--accent-gold)]/70">
                    Drop files here or click to browse
                  </p>
                </button>
              )}
            </div>
          )}

          {/* SECTION 5: Metadata footer */}
          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-3">
              <span>Created by {todo.created_by}</span>
              {todo.created_at && (
                <span>• {new Date(todo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              )}
              {todo.updated_at && todo.updated_by && (
                <span className="hidden sm:inline">• Updated by {todo.updated_by}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => setShowDeleteConfirm(true)}
                className="text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)]"
              >
                Delete
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setExpanded(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content to Subtasks Importer Modal */}
      {showContentImporter && (
        <ContentToSubtasksImporter
          onClose={() => setShowContentImporter(false)}
          onAddSubtasks={handleAddImportedSubtasks}
          parentTaskText={todo.text}
        />
      )}

      {/* Attachment Upload Modal */}
      {showAttachmentUpload && onUpdateAttachments && (
        <AttachmentUpload
          todoId={todo.id}
          userName={currentUserName}
          onUploadComplete={(newAttachment) => {
            // Update local state with the new attachment and trigger activity logging
            // skipDbUpdate=true because the API already saved to database
            const updatedAttachments = [...(todo.attachments || []), newAttachment];
            onUpdateAttachments(todo.id, updatedAttachments, true);
          }}
          onClose={() => setShowAttachmentUpload(false)}
          currentAttachmentCount={todo.attachments?.length || 0}
          maxAttachments={MAX_ATTACHMENTS_PER_TODO}
        />
      )}
    </div>
  );
}
