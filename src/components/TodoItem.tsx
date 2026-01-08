'use client';

import { useState, useEffect } from 'react';
import { Check, Trash2, Calendar, User, Flag, Copy, MessageSquare, ChevronDown, ChevronUp, Repeat, ListTree, Plus, Mail, Pencil, FileText, Paperclip, Music, Mic, Clock } from 'lucide-react';
import { Todo, TodoPriority, TodoStatus, PRIORITY_CONFIG, STATUS_CONFIG, RecurrencePattern, Subtask, Attachment, MAX_ATTACHMENTS_PER_TODO } from '@/types/todo';
import AttachmentList from './AttachmentList';
import AttachmentUpload from './AttachmentUpload';
import Celebration from './Celebration';
import ContentToSubtasksImporter from './ContentToSubtasksImporter';

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
  darkMode?: boolean;
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
}

const formatDueDate = (date: string) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDay = new Date(d);
  dueDay.setHours(0, 0, 0, 0);

  if (dueDay.getTime() === today.getTime()) return 'Today';
  if (dueDay.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

const dueDateStyles = {
  overdue: 'bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/20',
  today: 'bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning)]/20',
  upcoming: 'bg-[var(--accent-gold-light)] text-[var(--accent-gold)] border border-[var(--accent-gold)]/20',
  future: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
};

export default function TodoItem({
  todo,
  users,
  currentUserName,
  darkMode = true,
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
  const [editingText, setEditingText] = useState(false);
  const [text, setText] = useState(todo.text);
  const priority = todo.priority || 'medium';
  const status = todo.status || 'todo';
  const statusConfig = STATUS_CONFIG[status];

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

  useEffect(() => {
    if (!editingText) {
      setText(todo.text);
    }
  }, [todo.text, editingText]);

  return (
    <div
      role="listitem"
      className={`group relative rounded-[var(--radius-xl)] border transition-all duration-200 ${
        todo.completed
          ? 'bg-[var(--surface)] border-[var(--border-subtle)] opacity-60'
          : dueDateStatus === 'overdue'
            ? 'border-[var(--danger)]/30 bg-[var(--danger-light)]'
            : selected
              ? 'border-[var(--accent)] bg-[var(--accent-light)]'
              : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-md)]'
      }`}
    >
      <Celebration trigger={celebrating} onComplete={() => setCelebrating(false)} />
      <div className="flex items-center gap-3 p-4">
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
            <p className={`font-medium cursor-pointer ${
              todo.completed
                ? 'text-[var(--text-light)] line-through'
                : 'text-[var(--foreground)]'
            }`}>
              {todo.text}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Priority + Due date combined */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
            >
              <Flag className="w-3 h-3" />
              {priorityConfig.label}
            </span>

            {/* Due date - improved color coding */}
            {todo.due_date && dueDateStatus && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                todo.completed
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                  : dueDateStatus === 'overdue'
                    ? 'bg-red-500 text-white'
                    : dueDateStatus === 'today'
                      ? 'bg-orange-500 text-white'
                      : dueDateStatus === 'upcoming'
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'text-[var(--text-muted)]'
              }`}>
                <Calendar className="w-3 h-3" />
                {formatDueDate(todo.due_date)}
                {dueDateStatus === 'overdue' && !todo.completed && ' (overdue)'}
              </span>
            )}

            {/* Recurrence indicator */}
            {todo.recurrence && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-700">
                <Repeat className="w-3 h-3" />
                {todo.recurrence}
              </span>
            )}

            {/* Notes indicator */}
            {todo.notes && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowNotes(!showNotes); }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
              >
                <MessageSquare className="w-3 h-3" />
                Note
              </button>
            )}

            {/* Transcription indicator */}
            {todo.transcription && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowTranscription(!showTranscription); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-[var(--radius-sm)] text-xs font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/15 active:bg-purple-500/20 touch-manipulation"
              >
                <Mic className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                Voicemail
              </button>
            )}

            {/* Subtasks indicator - larger touch target */}
            {subtasks.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowSubtasks(!showSubtasks); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--accent-light)] text-[var(--accent)] hover:bg-[var(--accent)]/15 active:bg-[var(--accent)]/20 touch-manipulation"
              >
                <ListTree className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                {completedSubtasks}/{subtasks.length}
                {subtaskProgress === 100 && <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 ml-0.5" />}
              </button>
            )}

            {/* Attachments indicator */}
            {todo.attachments && todo.attachments.length > 0 && (() => {
              const hasAudio = todo.attachments.some(a => a.file_type === 'audio');
              const AttachmentIcon = hasAudio ? Music : Paperclip;
              const iconColor = hasAudio ? 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/15 active:bg-purple-500/20' : 'bg-[var(--accent-gold-light)] text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/15 active:bg-[var(--accent-gold)]/20';
              return (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAttachments(!showAttachments); }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-[var(--radius-sm)] text-xs font-medium touch-manipulation ${iconColor}`}
                >
                  <AttachmentIcon className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  {todo.attachments.length}
                </button>
              );
            })()}

            {/* Assigned to */}
            {todo.assigned_to && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--accent-gold-light)] text-[var(--accent-gold)]">
                <User className="w-3 h-3" />
                {todo.assigned_to}
              </span>
            )}

          </div>

          {/* Quick inline actions - visible on hover for incomplete tasks */}
          {!todo.completed && (
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

        {/* Action buttons - always visible on mobile, hover on desktop */}
        <div className="flex items-center gap-1">
          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-[var(--radius-md)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse task details' : 'Expand task details'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Edit title */}
          {onUpdateText && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingText(true);
                setExpanded(true);
              }}
              className="p-2 rounded-[var(--radius-md)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
              aria-label="Edit task title"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}

          {/* Save as Template */}
          {onSaveAsTemplate && (
            <button
              onClick={() => onSaveAsTemplate(todo)}
              className="p-2 rounded-[var(--radius-md)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-[var(--accent-light)] text-[var(--text-muted)] hover:text-[var(--accent)]"
              aria-label="Save as template"
              title="Save as template"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}

          {/* Duplicate */}
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(todo)}
              className="p-2 rounded-[var(--radius-md)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
              aria-label="Duplicate task"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}

          {/* Snooze - only show for incomplete tasks */}
          {!todo.completed && (
            <div className="relative">
              <button
                onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                className="p-2 rounded-[var(--radius-md)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-amber-50 dark:hover:bg-amber-500/10 text-[var(--text-muted)] hover:text-amber-600"
                aria-label="Snooze task"
                title="Snooze (reschedule)"
              >
                <Clock className="w-4 h-4" />
              </button>
              {showSnoozeMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-lg z-50 py-1 min-w-[140px]">
                  <button
                    onClick={() => handleSnooze(1)}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--foreground)]"
                  >
                    Tomorrow
                  </button>
                  <button
                    onClick={() => handleSnooze(2)}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--foreground)]"
                  >
                    In 2 Days
                  </button>
                  <button
                    onClick={() => handleSnooze(7)}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--foreground)]"
                  >
                    Next Week
                  </button>
                  <button
                    onClick={() => handleSnooze(30)}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)] text-[var(--foreground)]"
                  >
                    Next Month
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Email Customer */}
          {onEmailCustomer && (
            <button
              onClick={() => onEmailCustomer(todo)}
              className="p-2 rounded-[var(--radius-md)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-500/10 text-[var(--text-muted)] hover:text-blue-500"
              aria-label="Email customer update"
              title="Generate customer email"
            >
              <Mail className="w-4 h-4" />
            </button>
          )}

          {/* Delete button */}
          <button
            onClick={() => onDelete(todo.id)}
            className="p-2 rounded-[var(--radius-md)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-[var(--danger-light)] text-[var(--text-muted)] hover:text-[var(--danger)]"
            aria-label="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

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

      {/* Expanded actions */}
      {expanded && (
        <div className="px-3 sm:px-4 pb-4 pt-3 border-t border-[var(--border-subtle)] space-y-3">
          {/* Row 1: Status, Priority, Due date, Assign, Recurrence - grid on mobile for better layout */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            {/* Status */}
            {onStatusChange && (
              <select
                value={status}
                onChange={(e) => onStatusChange(todo.id, e.target.value as TodoStatus)}
                className="input-refined text-base sm:text-sm px-3 py-2.5 sm:py-2 text-[var(--foreground)]"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            )}

            {/* Priority selector */}
            <select
              value={priority}
              onChange={(e) => onSetPriority(todo.id, e.target.value as TodoPriority)}
              className="input-refined text-base sm:text-sm px-3 py-2.5 sm:py-2 text-[var(--foreground)]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            {/* Due date */}
            <input
              type="date"
              value={todo.due_date ? todo.due_date.split('T')[0] : ''}
              onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
              className="input-refined text-base sm:text-sm px-3 py-2.5 sm:py-2 text-[var(--foreground)]"
            />

            {/* Assign to */}
            <select
              value={todo.assigned_to || ''}
              onChange={(e) => onAssign(todo.id, e.target.value || null)}
              className="input-refined text-base sm:text-sm px-3 py-2.5 sm:py-2 text-[var(--foreground)]"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>

            {/* Recurrence */}
            {onSetRecurrence && (
              <select
                value={todo.recurrence || ''}
                onChange={(e) => onSetRecurrence(todo.id, (e.target.value || null) as RecurrencePattern)}
                className="input-refined text-base sm:text-sm px-3 py-2.5 sm:py-2 text-[var(--foreground)]"
              >
                <option value="">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>

          {/* Subtasks section - always visible in expanded view */}
          {onUpdateSubtasks && (
            <div className="p-3 bg-[var(--accent-light)] rounded-[var(--radius-lg)] border border-[var(--accent)]/10 overflow-hidden">
              {/* Header with AI buttons - stacks on mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <ListTree className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                  <span className="text-sm font-medium text-[var(--accent)]">Subtasks</span>
                  {subtasks.length > 0 && (
                    <span className="text-xs text-[var(--accent)]/70">({completedSubtasks}/{subtasks.length})</span>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {/* Import button */}
                  <button
                    onClick={() => setShowContentImporter(true)}
                    className="text-xs px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent-gold-light)] hover:bg-[var(--accent-gold)]/20 active:bg-[var(--accent-gold)]/25 text-[var(--accent-gold)] font-medium flex items-center gap-1.5 transition-colors touch-manipulation"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Import</span>
                  </button>
                </div>
              </div>

              {/* Progress bar - only show if subtasks exist */}
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

              {/* Subtask list with checkboxes */}
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

              {/* Add manual subtask input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubtaskText}
                  onChange={(e) => setNewSubtaskText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addManualSubtask()}
                  placeholder="Add a subtask..."
                  className="input-refined flex-1 text-base sm:text-sm px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 touch-manipulation text-[var(--foreground)]"
                />
                <button
                  onClick={addManualSubtask}
                  disabled={!newSubtaskText.trim()}
                  className="px-3 py-2.5 sm:py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--surface-2)] text-white disabled:text-[var(--text-light)] rounded-[var(--radius-lg)] text-sm font-medium transition-colors touch-manipulation min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          {onUpdateNotes && (
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add notes or context..."
                className="input-refined w-full text-base sm:text-sm px-3 py-2.5 sm:py-2 text-[var(--foreground)] resize-none"
                rows={2}
              />
            </div>
          )}

          {/* Attachments section */}
          {onUpdateAttachments && (
            <div className="p-3 bg-[var(--accent-gold-light)] rounded-[var(--radius-lg)] border border-[var(--accent-gold)]/10">
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
                <button
                  onClick={() => setShowAttachmentUpload(true)}
                  disabled={(todo.attachments?.length || 0) >= MAX_ATTACHMENTS_PER_TODO}
                  className="text-xs px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium flex items-center gap-1.5 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              {/* Attachment list */}
              {todo.attachments && todo.attachments.length > 0 ? (
                <AttachmentList
                  attachments={todo.attachments}
                  todoId={todo.id}
                  onRemove={(attachmentId) => {
                    // skipDbUpdate=true because the DELETE API already updated the database
                    const updated = todo.attachments?.filter(a => a.id !== attachmentId) || [];
                    onUpdateAttachments(todo.id, updated, true);
                  }}
                  canRemove={true}
                />
              ) : (
                <p className="text-xs text-[var(--accent-gold)]/70 text-center py-3">
                  No attachments yet. Click &quot;Add&quot; to upload files.
                </p>
              )}
            </div>
          )}
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
