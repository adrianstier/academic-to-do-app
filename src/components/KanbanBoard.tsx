'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '@/lib/logger';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Flag,
  User,
  Trash2,
  Clock,
  AlertCircle,
  X,
  FileText,
  Edit3,
  CheckSquare,
  Square,
  Plus,
  Paperclip,
  Music,
  ClipboardList,
  Zap,
  CheckCircle2,
  LucideIcon,
  Copy,
  Repeat,
  BookmarkPlus,
  Mail,
  Upload,
  File,
  Image,
  Video,
  Mic,
  AlertTriangle,
  Calendar,
  CalendarClock,
  CalendarX,
} from 'lucide-react';
import { Todo, TodoStatus, TodoPriority, PRIORITY_CONFIG, Subtask, RecurrencePattern, Attachment } from '@/types/todo';
import Celebration from './Celebration';
import ContentToSubtasksImporter from './ContentToSubtasksImporter';

interface KanbanBoardProps {
  todos: Todo[];
  users: string[];
  darkMode?: boolean;
  onStatusChange: (id: string, status: TodoStatus) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onSetReminder?: (id: string, reminderAt: string | null) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onUpdateText?: (id: string, text: string) => void;
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => void;
  onToggle?: (id: string, completed: boolean) => void;
  onDuplicate?: (todo: Todo) => void;
  onSetRecurrence?: (id: string, recurrence: RecurrencePattern) => void;
  onUpdateAttachments?: (id: string, attachments: Attachment[], skipDbUpdate?: boolean) => void;
  onSaveAsTemplate?: (todo: Todo) => void;
  onEmailCustomer?: (todo: Todo) => void;
  // Selection support
  showBulkActions?: boolean;
  selectedTodos?: Set<string>;
  onSelectTodo?: (id: string, selected: boolean) => void;
  // Sectioned view - groups tasks by date within each column
  useSectionedView?: boolean;
}

const columns: { id: TodoStatus; title: string; Icon: LucideIcon; color: string; bgColor: string }[] = [
  { id: 'todo', title: 'To Do', Icon: ClipboardList, color: 'var(--accent)', bgColor: 'var(--accent-light)' },
  { id: 'in_progress', title: 'In Progress', Icon: Zap, color: 'var(--warning)', bgColor: 'var(--warning-light)' },
  { id: 'done', title: 'Done', Icon: CheckCircle2, color: 'var(--success)', bgColor: 'var(--success-light)' },
];

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

const isOverdue = (date: string) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
};

const isDueToday = (date: string) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
};

const isDueSoon = (date: string) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  return d > today && d <= threeDaysFromNow;
};

interface SortableCardProps {
  todo: Todo;
  users: string[];
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onCardClick: (todo: Todo) => void;
  // Selection support
  showBulkActions?: boolean;
  isSelected?: boolean;
  onSelectTodo?: (id: string, selected: boolean) => void;
}

function SortableCard({ todo, users, onDelete, onAssign, onSetDueDate, onSetPriority, onCardClick, showBulkActions, isSelected, onSelectTodo }: SortableCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

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

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const overdue = todo.due_date && !todo.completed && isOverdue(todo.due_date);
  const hasNotes = todo.notes && todo.notes.trim().length > 0;
  const hasTranscription = todo.transcription && todo.transcription.trim().length > 0;
  const subtaskCount = todo.subtasks?.length || 0;
  const completedSubtasks = todo.subtasks?.filter(s => s.completed).length || 0;
  const attachmentCount = todo.attachments?.length || 0;

  // Handle click to open detail modal (not during drag)
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on action buttons
    if ((e.target as HTMLElement).closest('button, input, select')) {
      return;
    }
    onCardClick(todo);
  };

  return (
    <motion.div
      id={`todo-${todo.id}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group rounded-xl border-2 overflow-hidden transition-all cursor-grab active:cursor-grabbing bg-white dark:bg-slate-800 touch-manipulation ${
        isDragging
          ? 'shadow-2xl ring-2 ring-[var(--accent)] border-[var(--accent)]'
          : 'shadow-sm border-slate-100 dark:border-slate-700 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={handleCardClick}
    >
      <div className="p-3 sm:p-3">
        {/* Card content */}
        <div className="flex items-start gap-2">
          {/* Selection checkbox */}
          {showBulkActions && onSelectTodo && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSelectTodo(todo.id, !isSelected);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all mt-0.5 ${
                isSelected
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'border-slate-300 dark:border-slate-600 hover:border-[var(--accent)]'
              }`}
            >
              {isSelected && <CheckSquare className="w-3 h-3" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-base sm:text-sm font-medium leading-snug ${
              todo.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'
            }`}>
              {todo.text}
            </p>

          {/* PRIMARY ROW: Essential info always visible for quick scanning */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {/* Priority */}
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium"
              style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
            >
              <Flag className="w-2.5 h-2.5" />
              {priorityConfig.label}
            </span>

            {/* Due date */}
            {todo.due_date && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium ${
                todo.completed
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                  : overdue
                    ? 'bg-red-500 text-white'
                    : isDueToday(todo.due_date)
                      ? 'bg-orange-500 text-white'
                      : isDueSoon(todo.due_date)
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'text-slate-500 dark:text-slate-400'
              }`}>
                {overdue ? <AlertCircle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                {formatDueDate(todo.due_date)}
              </span>
            )}

            {/* Assignee - always visible as it's key for knowing who owns the task */}
            {todo.assigned_to && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                <User className="w-2.5 h-2.5" />
                {todo.assigned_to}
              </span>
            )}

            {/* "Has more" indicator - subtle dot when task has hidden content */}
            {(hasNotes || subtaskCount > 0 || attachmentCount > 0 || hasTranscription) && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 opacity-40 group-hover:opacity-0 transition-opacity"
                title="Hover for more details"
              />
            )}
          </div>

          {/* SECONDARY ROW: Hidden by default, revealed on hover - Progressive Disclosure */}
          {(hasNotes || subtaskCount > 0 || attachmentCount > 0 || hasTranscription) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {hasTranscription && (
                <span className="inline-flex items-center gap-1 text-xs text-purple-500 dark:text-purple-400">
                  <Mic className="w-3 h-3" />
                </span>
              )}
              {hasNotes && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                  <FileText className="w-3 h-3" />
                </span>
              )}
              {subtaskCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                  <CheckSquare className="w-3 h-3" />
                  {completedSubtasks}/{subtaskCount}
                </span>
              )}
              {attachmentCount > 0 && (() => {
                const hasAudio = todo.attachments?.some(a => a.file_type === 'audio');
                const AttachmentIcon = hasAudio ? Music : Paperclip;
                const colorClass = hasAudio ? 'text-purple-500 dark:text-purple-400' : 'text-amber-500 dark:text-amber-400';
                return (
                  <span className={`inline-flex items-center gap-1 text-xs ${colorClass}`}>
                    <AttachmentIcon className="w-3 h-3" />
                    {attachmentCount}
                  </span>
                );
              })()}
            </div>
          )}

          {/* Footer row - edit indicator */}
          <div className="flex items-center justify-end mt-2">
            <Edit3 className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          </div>
        </div>

        {/* Quick actions */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 overflow-hidden"
            >
              {/* Row 1: Date and Assignee */}
              <div className="flex gap-2 mb-2">
                <input
                  type="date"
                  value={todo.due_date ? todo.due_date.split('T')[0] : ''}
                  onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 text-sm sm:text-xs px-2 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] touch-manipulation"
                />
                <select
                  value={todo.assigned_to || ''}
                  onChange={(e) => onAssign(todo.id, e.target.value || null)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 text-sm sm:text-xs px-2 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] touch-manipulation"
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
              </div>
              {/* Row 2: Priority and Action Buttons */}
              <div className="flex items-center gap-2">
                <select
                  value={priority}
                  onChange={(e) => onSetPriority(todo.id, e.target.value as TodoPriority)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 text-sm sm:text-xs px-2 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] touch-manipulation"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                {/* Snooze button */}
                {!todo.completed && (
                  <div className="relative flex-shrink-0">
                    <motion.button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSnoozeMenu(!showSnoozeMenu);
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2.5 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 text-slate-400 hover:text-amber-500 transition-colors touch-manipulation flex items-center justify-center"
                      aria-label="Snooze task"
                      title="Snooze (reschedule)"
                    >
                      <Clock className="w-5 h-5 sm:w-4 sm:h-4" />
                    </motion.button>
                    {showSnoozeMenu && (
                      <div
                        className="absolute right-0 bottom-full mb-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-50 py-1 min-w-[140px]"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSnooze(1); }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                          Tomorrow
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSnooze(2); }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                          In 2 Days
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSnooze(7); }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                          Next Week
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSnooze(30); }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                          Next Month
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <motion.button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(todo.id);
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="flex-shrink-0 p-2.5 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors touch-manipulation flex items-center justify-center"
                  aria-label="Delete task"
                >
                  <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface DroppableColumnProps {
  id: TodoStatus;
  children: React.ReactNode;
  color: string;
  isActive: boolean;
  isCurrentOver: boolean;
}

function DroppableColumn({ id, children, color, isActive, isCurrentOver }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const showHighlight = isOver || isCurrentOver;

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 p-2 sm:p-3 min-h-[180px] sm:min-h-[250px] space-y-2 sm:space-y-3 transition-all rounded-lg ${
        showHighlight
          ? 'bg-slate-100 dark:bg-slate-800'
          : isActive
            ? 'bg-slate-50 dark:bg-slate-800/50'
            : 'bg-slate-50/50 dark:bg-slate-800/30'
      }`}
      style={{
        borderLeft: showHighlight ? `4px solid ${color}` : isActive ? `4px solid ${color}40` : '4px solid transparent',
        borderRight: showHighlight ? `4px solid ${color}` : isActive ? `4px solid ${color}40` : '4px solid transparent',
        boxShadow: showHighlight ? `inset 0 0 0 2px ${color}` : 'none',
      }}
    >
      {children}
    </div>
  );
}

function KanbanCard({ todo }: { todo: Todo }) {
  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const overdue = todo.due_date && !todo.completed && isOverdue(todo.due_date);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-2 border-[var(--accent)] overflow-hidden ring-4 ring-[var(--accent)]/20">
      <div className="h-1.5" style={{ backgroundColor: priorityConfig.color }} />
      <div className="p-3">
        <p className="text-sm font-medium text-slate-800 dark:text-white">{todo.text}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium"
            style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
          >
            <Flag className="w-2.5 h-2.5" />
            {priorityConfig.label}
          </span>
          {todo.due_date && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium ${
              overdue
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-[var(--accent)]/10 text-[var(--accent)]'
            }`}>
              <Clock className="w-2.5 h-2.5" />
              {formatDueDate(todo.due_date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Task Detail Modal Component
interface TaskDetailModalProps {
  todo: Todo;
  users: string[];
  darkMode?: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onStatusChange: (id: string, status: TodoStatus) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onUpdateText?: (id: string, text: string) => void;
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => void;
  onToggle?: (id: string, completed: boolean) => void;
  onDuplicate?: (todo: Todo) => void;
  onSetRecurrence?: (id: string, recurrence: RecurrencePattern) => void;
  onUpdateAttachments?: (id: string, attachments: Attachment[], skipDbUpdate?: boolean) => void;
  onSaveAsTemplate?: (todo: Todo) => void;
  onEmailCustomer?: (todo: Todo) => void;
}

function TaskDetailModal({
  todo,
  users,
  darkMode,
  onClose,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority,
  onStatusChange,
  onUpdateNotes,
  onUpdateText,
  onUpdateSubtasks,
  onToggle,
  onDuplicate,
  onSetRecurrence,
  onUpdateAttachments,
  onSaveAsTemplate,
  onEmailCustomer,
}: TaskDetailModalProps) {
  const [editingText, setEditingText] = useState(false);
  const [text, setText] = useState(todo.text);
  const [notes, setNotes] = useState(todo.notes || '');
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showContentImporter, setShowContentImporter] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Sync local state when todo prop changes (e.g., from real-time updates)
  useEffect(() => {
    if (!editingText) {
      setText(todo.text);
    }
  }, [todo.text, editingText]);

  useEffect(() => {
    setNotes(todo.notes || '');
  }, [todo.notes]);

  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const subtasks = todo.subtasks || [];

  const handleSaveText = () => {
    if (onUpdateText && text.trim() !== todo.text) {
      onUpdateText(todo.id, text.trim());
    }
    setEditingText(false);
  };

  const handleSaveNotes = () => {
    if (onUpdateNotes && notes !== (todo.notes || '')) {
      onUpdateNotes(todo.id, notes);
    }
  };

  const handleToggleSubtask = (index: number) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.map((s, i) =>
      i === index ? { ...s, completed: !s.completed } : s
    );
    onUpdateSubtasks(todo.id, updated);
  };

  const handleAddSubtask = () => {
    if (!onUpdateSubtasks || !newSubtaskText.trim()) return;
    const newSubtask: Subtask = {
      id: `subtask-${Date.now()}`,
      text: newSubtaskText.trim(),
      completed: false,
      priority: 'medium',
    };
    onUpdateSubtasks(todo.id, [...subtasks, newSubtask]);
    setNewSubtaskText('');
  };

  const handleDeleteSubtask = (index: number) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.filter((_, i) => i !== index);
    onUpdateSubtasks(todo.id, updated);
  };

  const handleAddImportedSubtasks = (importedSubtasks: Subtask[]) => {
    if (!onUpdateSubtasks) return;
    onUpdateSubtasks(todo.id, [...subtasks, ...importedSubtasks]);
    setShowContentImporter(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onUpdateAttachments) return;

    setIsUploading(true);
    try {
      const newAttachments: Attachment[] = [];

      for (const file of Array.from(files)) {
        // Determine file type
        let fileType: 'image' | 'document' | 'audio' | 'video' | 'other' = 'other';
        if (file.type.startsWith('image/')) fileType = 'image';
        else if (file.type.startsWith('audio/')) fileType = 'audio';
        else if (file.type.startsWith('video/')) fileType = 'video';
        else if (file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text')) fileType = 'document';

        // Create a temporary URL for the file (in real app, would upload to storage)
        const url = URL.createObjectURL(file);

        newAttachments.push({
          id: `attachment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file_name: file.name,
          file_type: fileType,
          file_size: file.size,
          storage_path: url,
          mime_type: file.type,
          uploaded_at: new Date().toISOString(),
          uploaded_by: todo.created_by,
        });
      }

      const updatedAttachments = [...(todo.attachments || []), ...newAttachments];
      onUpdateAttachments(todo.id, updatedAttachments);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    if (!onUpdateAttachments) return;
    const updated = (todo.attachments || []).filter(a => a.id !== attachmentId);
    onUpdateAttachments(todo.id, updated);
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image': return Image;
      case 'audio': return Mic;
      case 'video': return Video;
      case 'document': return FileText;
      default: return File;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const recurrenceOptions: { value: string; label: string }[] = [
    { value: '', label: 'No repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const attachments = todo.attachments || [];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl ${
          darkMode ? 'bg-slate-800' : 'bg-white'
        }`}
      >
        {/* Priority bar */}
        <div className="h-2" style={{ backgroundColor: priorityConfig.color }} />

        {/* Header */}
        <div className={`flex items-start justify-between p-4 border-b ${
          darkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className="flex-1 min-w-0 pr-4">
            {editingText ? (
              <div className="space-y-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-base font-medium resize-none ${
                    darkMode
                      ? 'bg-slate-700 border-slate-600 text-white'
                      : 'bg-white border-slate-200 text-slate-800'
                  } focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30`}
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveText}
                    className="px-3 py-1.5 bg-[var(--accent)] text-white text-sm rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setText(todo.text);
                      setEditingText(false);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      darkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => onUpdateText && setEditingText(true)}
                className={`text-lg font-semibold cursor-pointer hover:opacity-80 ${
                  darkMode ? 'text-white' : 'text-slate-800'
                } ${todo.completed ? 'line-through opacity-60' : ''}`}
              >
                {todo.text}
                {onUpdateText && (
                  <Edit3 className="inline-block w-4 h-4 ml-2 opacity-40" />
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Status, Priority, Due Date, Assignee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Status
              </label>
              <select
                value={todo.status || 'todo'}
                onChange={(e) => onStatusChange(todo.id, e.target.value as TodoStatus)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-200 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30`}
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>{col.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => onSetPriority(todo.id, e.target.value as TodoPriority)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-200 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Due Date
              </label>
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={todo.due_date ? todo.due_date.split('T')[0] : ''}
                  onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
                  className={`flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm ${
                    darkMode
                      ? 'bg-slate-700 border-slate-600 text-white'
                      : 'bg-white border-slate-200 text-slate-800'
                  } focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30`}
                />
                {!todo.completed && (
                  <div className="relative">
                    <button
                      onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                      className={`p-2 rounded-lg border text-sm transition-colors ${
                        darkMode
                          ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-amber-900/30 hover:text-amber-400 hover:border-amber-500/50'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300'
                      }`}
                      title="Snooze (quick reschedule)"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    {showSnoozeMenu && (
                      <div className={`absolute right-0 top-full mt-1 rounded-lg shadow-lg z-50 py-1 min-w-[140px] border ${
                        darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
                      }`}>
                        <button
                          onClick={() => handleSnooze(1)}
                          className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                            darkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          Tomorrow
                        </button>
                        <button
                          onClick={() => handleSnooze(2)}
                          className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                            darkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          In 2 Days
                        </button>
                        <button
                          onClick={() => handleSnooze(7)}
                          className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                            darkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          Next Week
                        </button>
                        <button
                          onClick={() => handleSnooze(30)}
                          className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                            darkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          Next Month
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Assigned To
              </label>
              <select
                value={todo.assigned_to || ''}
                onChange={(e) => onAssign(todo.id, e.target.value || null)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-200 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30`}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <FileText className="inline-block w-3.5 h-3.5 mr-1" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Add notes or context..."
              rows={3}
              className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${
                darkMode
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500'
                  : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
              } focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30`}
            />
          </div>

          {/* Voicemail Transcription */}
          {todo.transcription && (
            <div className={`p-3 rounded-lg border ${
              darkMode
                ? 'bg-purple-500/10 border-purple-500/20'
                : 'bg-purple-500/5 border-purple-500/10'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Mic className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-purple-500">Voicemail Transcription</span>
              </div>
              <p className={`text-sm whitespace-pre-wrap leading-relaxed ${
                darkMode ? 'text-slate-200' : 'text-slate-700'
              }`}>
                {todo.transcription}
              </p>
            </div>
          )}

          {/* Subtasks */}
          {onUpdateSubtasks && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <CheckSquare className="inline-block w-3.5 h-3.5 mr-1" />
                  Subtasks ({subtasks.filter(s => s.completed).length}/{subtasks.length})
                </label>
                <button
                  onClick={() => setShowContentImporter(true)}
                  className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 transition-colors ${
                    darkMode
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  <Mail className="w-3 h-3" />
                  Import
                </button>
              </div>

              <div className="space-y-1.5">
                {subtasks.map((subtask, index) => (
                  <div
                    key={subtask.id || index}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      darkMode ? 'bg-slate-700/50' : 'bg-slate-50'
                    }`}
                  >
                    <button
                      onClick={() => handleToggleSubtask(index)}
                      className={`flex-shrink-0 ${
                        subtask.completed
                          ? 'text-green-500'
                          : darkMode ? 'text-slate-400' : 'text-slate-400'
                      }`}
                    >
                      {subtask.completed ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${
                      subtask.completed
                        ? 'line-through opacity-60'
                        : darkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      {subtask.text}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(index)}
                      className={`p-1 rounded transition-colors ${
                        darkMode ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-400'
                      } hover:text-red-500`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add subtask */}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                    placeholder="Add a subtask..."
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                      darkMode
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500'
                        : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
                    } focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30`}
                  />
                  <button
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskText.trim()}
                    className="px-3 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recurrence */}
          {onSetRecurrence && (
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Repeat className="inline-block w-3.5 h-3.5 mr-1" />
                Repeat
              </label>
              <select
                value={todo.recurrence || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  onSetRecurrence(todo.id, value === '' ? null : value as RecurrencePattern);
                }}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-200 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30`}
              >
                {recurrenceOptions.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Attachments */}
          {onUpdateAttachments && (
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Paperclip className="inline-block w-3.5 h-3.5 mr-1" />
                Attachments ({attachments.length})
              </label>

              {/* Existing attachments */}
              {attachments.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {attachments.map((attachment) => {
                    const FileIcon = getFileIcon(attachment.file_type);
                    return (
                      <div
                        key={attachment.id}
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                          darkMode ? 'bg-slate-700/50' : 'bg-slate-50'
                        }`}
                      >
                        <FileIcon className={`w-4 h-4 flex-shrink-0 ${
                          attachment.file_type === 'audio' ? 'text-purple-500' : 'text-amber-500'
                        }`} />
                        <span className={`flex-1 text-sm truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                          {attachment.file_name}
                        </span>
                        <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {formatFileSize(attachment.file_size)}
                        </span>
                        <button
                          onClick={() => handleRemoveAttachment(attachment.id)}
                          className={`p-1 rounded transition-colors ${
                            darkMode ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-400'
                          } hover:text-red-500`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Upload button */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm transition-colors ${
                  darkMode
                    ? 'border-slate-600 text-slate-400 hover:bg-slate-700/50 hover:border-slate-500'
                    : 'border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400'
                } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload className="w-4 h-4" />
                {isUploading ? 'Uploading...' : 'Add files'}
              </button>
            </div>
          )}

          {/* Quick Actions */}
          <div className={`pt-3 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <label className={`block text-xs font-medium mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Quick Actions
            </label>
            <div className="flex flex-wrap gap-2">
              {/* Mark Complete Toggle */}
              {onToggle && (
                <button
                  onClick={() => onToggle(todo.id, !todo.completed)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    todo.completed
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : darkMode
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {todo.completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {todo.completed ? 'Completed' : 'Mark Done'}
                </button>
              )}

              {/* Duplicate */}
              {onDuplicate && (
                <button
                  onClick={() => {
                    onDuplicate(todo);
                    onClose();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    darkMode
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
              )}

              {/* Save as Template */}
              {onSaveAsTemplate && (
                <button
                  onClick={() => {
                    onSaveAsTemplate(todo);
                    onClose();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    darkMode
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <BookmarkPlus className="w-4 h-4" />
                  Save Template
                </button>
              )}

              {/* Email Customer */}
              {onEmailCustomer && (
                <button
                  onClick={() => {
                    onEmailCustomer(todo);
                    onClose();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    darkMode
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Email Update
                </button>
              )}
            </div>
          </div>

          {/* Meta info */}
          <div className={`pt-3 border-t text-xs ${
            darkMode ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'
          }`}>
            Created by {todo.created_by} • {new Date(todo.created_at).toLocaleDateString()}
            {todo.recurrence && (
              <span className="ml-2">
                <Repeat className="inline-block w-3 h-3 mr-0.5" />
                {todo.recurrence}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between p-4 border-t ${
          darkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <button
            onClick={() => {
              onDelete(todo.id);
              onClose();
            }}
            className="flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Delete Task
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </motion.div>

      {/* Content to Subtasks Importer Modal */}
      {showContentImporter && (
        <ContentToSubtasksImporter
          onClose={() => setShowContentImporter(false)}
          onAddSubtasks={handleAddImportedSubtasks}
          parentTaskText={todo.text}
        />
      )}
    </div>
  );
}

export default function KanbanBoard({
  todos,
  users,
  darkMode = true,
  onStatusChange,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority,
  onSetReminder,
  onUpdateNotes,
  onUpdateText,
  onUpdateSubtasks,
  onToggle,
  onDuplicate,
  onSetRecurrence,
  onUpdateAttachments,
  onSaveAsTemplate,
  onEmailCustomer,
  showBulkActions,
  selectedTodos,
  onSelectTodo,
  useSectionedView = false,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Custom collision detection that prioritizes columns over cards
  const collisionDetection: CollisionDetection = (args) => {
    // Get all collisions using pointer within
    const pointerCollisions = pointerWithin(args);

    // Also get rect intersections as fallback
    const rectCollisions = rectIntersection(args);

    // Combine and prioritize column droppables
    const allCollisions = [...pointerCollisions, ...rectCollisions];
    const columnIds = columns.map(c => c.id);

    // First try to find a column collision
    const columnCollision = allCollisions.find(
      collision => columnIds.includes(collision.id as TodoStatus)
    );

    if (columnCollision) {
      return [columnCollision];
    }

    // If no column found, return all collisions (for card-to-card)
    return allCollisions.length > 0 ? allCollisions : [];
  };

  const getUrgencyScore = (todo: Todo) => {
    if (todo.completed) return -1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let daysOverdue = 0;
    if (todo.due_date) {
      const dueDate = new Date(todo.due_date);
      dueDate.setHours(0, 0, 0, 0);
      daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
    }
    const priorityWeight = { urgent: 100, high: 50, medium: 25, low: 0 }[todo.priority || 'medium'];
    return (daysOverdue * 10) + priorityWeight;
  };

  const getTodosByStatus = (status: TodoStatus) => {
    return todos
      .filter((todo) => (todo.status || 'todo') === status)
      .sort((a, b) => {
        const scoreDiff = getUrgencyScore(b) - getUrgencyScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
        if (aDue !== bDue) return aDue - bDue;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  };

  // Date section types for grouping within columns
  type DateSection = 'overdue' | 'today' | 'upcoming' | 'no_date';

  const getDateSection = (todo: Todo): DateSection => {
    if (!todo.due_date) return 'no_date';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(todo.due_date);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today && !todo.completed) return 'overdue';
    if (dueDate.getTime() === today.getTime()) return 'today';
    return 'upcoming';
  };

  const dateSectionConfig: Record<DateSection, { label: string; color: string; bgColor: string; Icon: LucideIcon }> = {
    overdue: { label: 'Overdue', color: 'var(--error)', bgColor: 'var(--error-light)', Icon: AlertTriangle },
    today: { label: 'Today', color: 'var(--accent)', bgColor: 'var(--accent-light)', Icon: Calendar },
    upcoming: { label: 'Upcoming', color: 'var(--success)', bgColor: 'var(--success-light)', Icon: CalendarClock },
    no_date: { label: 'No Date', color: 'var(--text-muted)', bgColor: 'var(--surface-2)', Icon: CalendarX },
  };

  const groupTodosByDateSection = (columnTodos: Todo[]): Record<DateSection, Todo[]> => {
    const groups: Record<DateSection, Todo[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      no_date: [],
    };
    columnTodos.forEach(todo => {
      const section = getDateSection(todo);
      groups[section].push(todo);
    });
    return groups;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    logger.debug('Drag ended', { component: 'KanbanBoard', activeId: active.id, overId: over?.id });

    if (!over) {
      logger.debug('No drop target', { component: 'KanbanBoard' });
      return;
    }

    const todoId = active.id as string;
    const targetId = over.id as string;
    const draggedTodo = todos.find((t) => t.id === todoId);
    const previousStatus = draggedTodo?.status || 'todo';

    logger.debug('Dragged todo', { component: 'KanbanBoard', todoId, targetId, previousStatus });

    // Check if dropped on a column
    const column = columns.find((c) => c.id === targetId);
    if (column) {
      logger.debug('Dropped on column', { component: 'KanbanBoard', columnId: column.id, previousStatus });
      // Only change if different column
      if (previousStatus !== column.id) {
        logger.debug('Calling onStatusChange', { component: 'KanbanBoard', todoId, newStatus: column.id });
        // Celebrate if moving to done column
        if (column.id === 'done') {
          setCelebrating(true);
        }
        onStatusChange(todoId, column.id);
      } else {
        logger.debug('Same column, no change needed', { component: 'KanbanBoard' });
      }
      return;
    }

    // Check if dropped on another card
    const overTodo = todos.find((t) => t.id === targetId);
    if (overTodo) {
      const targetStatus = overTodo.status || 'todo';
      logger.debug('Dropped on card', { component: 'KanbanBoard', targetId, targetStatus });
      // Only change if different column
      if (previousStatus !== targetStatus) {
        logger.debug('Calling onStatusChange', { component: 'KanbanBoard', todoId, newStatus: targetStatus });
        // Celebrate if moving to done column
        if (targetStatus === 'done') {
          setCelebrating(true);
        }
        onStatusChange(todoId, targetStatus);
      }
    } else {
      logger.debug('No matching column or card found for targetId', { component: 'KanbanBoard', targetId });
    }
  };

  const activeTodo = activeId ? todos.find((t) => t.id === activeId) : null;

  return (
    <div className="relative">
      <Celebration trigger={celebrating} onComplete={() => setCelebrating(false)} />
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {columns.map((column) => {
          const columnTodos = getTodosByStatus(column.id);

          return (
            <motion.div
              key={column.id}
              layout
              className="flex flex-col bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl shadow-sm border-2 border-slate-100 dark:border-slate-700 overflow-hidden"
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b-2"
                style={{ backgroundColor: column.bgColor, borderColor: column.color + '30' }}
              >
                <div className="flex items-center gap-2">
                  <column.Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: column.color }} />
                  <h3 className="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-100">
                    {column.title}
                  </h3>
                </div>
                <span
                  className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm font-bold"
                  style={{ backgroundColor: column.color, color: 'white' }}
                >
                  {columnTodos.length}
                </span>
              </div>

              {/* Column body */}
              <SortableContext
                items={columnTodos.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <DroppableColumn id={column.id} color={column.color} isActive={!!activeId} isCurrentOver={overId === column.id}>
                  {useSectionedView ? (
                    // Sectioned view - group by date
                    (() => {
                      const groupedTodos = groupTodosByDateSection(columnTodos);
                      const sectionOrder: DateSection[] = ['overdue', 'today', 'upcoming', 'no_date'];
                      const hasAnyTodos = columnTodos.length > 0;

                      return (
                        <>
                          {sectionOrder.map((sectionKey) => {
                            const sectionTodos = groupedTodos[sectionKey];
                            const config = dateSectionConfig[sectionKey];
                            if (sectionTodos.length === 0) return null;

                            return (
                              <div key={sectionKey} className="mb-2">
                                {/* Section header */}
                                <div
                                  className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md mb-1"
                                  style={{ backgroundColor: config.bgColor, color: config.color }}
                                >
                                  <config.Icon className="w-3.5 h-3.5" />
                                  <span>{config.label}</span>
                                  <span className="ml-auto opacity-70">({sectionTodos.length})</span>
                                </div>
                                {/* Section cards */}
                                <AnimatePresence mode="popLayout">
                                  {sectionTodos.map((todo) => (
                                    <SortableCard
                                      key={todo.id}
                                      todo={todo}
                                      users={users}
                                      onDelete={onDelete}
                                      onAssign={onAssign}
                                      onSetDueDate={onSetDueDate}
                                      onSetPriority={onSetPriority}
                                      onCardClick={setSelectedTodo}
                                      showBulkActions={showBulkActions}
                                      isSelected={selectedTodos?.has(todo.id)}
                                      onSelectTodo={onSelectTodo}
                                    />
                                  ))}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                          {!hasAnyTodos && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex flex-col items-center justify-center py-8 sm:py-12 text-slate-400 dark:text-slate-500"
                            >
                              <div
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-3"
                                style={{ backgroundColor: column.bgColor }}
                              >
                                <column.Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: column.color }} />
                              </div>
                              <p className="text-xs sm:text-sm font-medium">
                                {column.id === 'done' ? 'Complete tasks to see them here' : 'Drop tasks here'}
                              </p>
                            </motion.div>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    // Flat view - no sections
                    <>
                      <AnimatePresence mode="popLayout">
                        {columnTodos.map((todo) => (
                          <SortableCard
                            key={todo.id}
                            todo={todo}
                            users={users}
                            onDelete={onDelete}
                            onAssign={onAssign}
                            onSetDueDate={onSetDueDate}
                            onSetPriority={onSetPriority}
                            onCardClick={setSelectedTodo}
                            showBulkActions={showBulkActions}
                            isSelected={selectedTodos?.has(todo.id)}
                            onSelectTodo={onSelectTodo}
                          />
                        ))}
                      </AnimatePresence>

                      {columnTodos.length === 0 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center py-8 sm:py-12 text-slate-400 dark:text-slate-500"
                        >
                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-3"
                            style={{ backgroundColor: column.bgColor }}
                          >
                            <column.Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: column.color }} />
                          </div>
                          <p className="text-xs sm:text-sm font-medium">
                            {column.id === 'done' ? 'Complete tasks to see them here' : 'Drop tasks here'}
                          </p>
                        </motion.div>
                      )}
                    </>
                  )}
                </DroppableColumn>
              </SortableContext>
            </motion.div>
          );
        })}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeTodo && <KanbanCard todo={activeTodo} />}
        </DragOverlay>
      </DndContext>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTodo && (
          <TaskDetailModal
            todo={selectedTodo}
            users={users}
            darkMode={darkMode}
            onClose={() => setSelectedTodo(null)}
            onDelete={onDelete}
            onAssign={onAssign}
            onSetDueDate={onSetDueDate}
            onSetPriority={onSetPriority}
            onStatusChange={onStatusChange}
            onUpdateNotes={onUpdateNotes}
            onUpdateText={onUpdateText}
            onUpdateSubtasks={onUpdateSubtasks}
            onToggle={onToggle}
            onDuplicate={onDuplicate}
            onSetRecurrence={onSetRecurrence}
            onUpdateAttachments={onUpdateAttachments}
            onSaveAsTemplate={onSaveAsTemplate}
            onEmailCustomer={onEmailCustomer}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
