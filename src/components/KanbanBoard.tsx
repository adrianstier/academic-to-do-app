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
  Edit3,
  CheckSquare,
  Paperclip,
  Music,
  ClipboardList,
  Zap,
  CheckCircle2,
  LucideIcon,
  Mic,
  FileText,
  AlertTriangle,
  Calendar,
  CalendarClock,
  CalendarX,
} from 'lucide-react';
import { Todo, TodoStatus, TodoPriority, PRIORITY_CONFIG, Subtask, RecurrencePattern, Attachment } from '@/types/todo';
import Celebration from './Celebration';
import { TaskDetailModal } from './task-detail';

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
  currentUserName?: string;
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
                <span className="inline-flex items-center gap-1 text-xs text-[var(--accent)] dark:text-[#72B5E8]">
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
                const colorClass = hasAudio ? 'text-[var(--accent)] dark:text-[#72B5E8]' : 'text-amber-500 dark:text-amber-400';
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

// TaskDetailModal is now imported from './task-detail'

// Old TaskDetailModal removed — now using shared TaskDetailModal from './task-detail'

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
  currentUserName,
  showBulkActions,
  selectedTodos,
  onSelectTodo,
  useSectionedView = false,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [dragAnnouncement, setDragAnnouncement] = useState<string>('');

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
    overdue: { label: 'Overdue', color: 'var(--danger)', bgColor: 'var(--danger-light)', Icon: AlertTriangle },
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
    const todoId = event.active.id as string;
    setActiveId(todoId);
    const draggedTodo = todos.find((t) => t.id === todoId);
    if (draggedTodo) {
      const currentColumn = columns.find(c => c.id === draggedTodo.status);
      setDragAnnouncement(`Picked up task: ${draggedTodo.text}. Currently in ${currentColumn?.title || 'To Do'} column.`);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    logger.debug('Drag ended', { component: 'KanbanBoard', activeId: active.id, overId: over?.id });

    const todoId = active.id as string;
    const draggedTodo = todos.find((t) => t.id === todoId);

    if (!over) {
      logger.debug('No drop target', { component: 'KanbanBoard' });
      setDragAnnouncement(draggedTodo ? `Dropped task: ${draggedTodo.text}. No change.` : 'Task dropped. No change.');
      return;
    }

    const targetId = over.id as string;
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
        setDragAnnouncement(`Moved task to ${column.title} column.`);
      } else {
        logger.debug('Same column, no change needed', { component: 'KanbanBoard' });
        setDragAnnouncement(`Task remains in ${column.title} column.`);
      }
      return;
    }

    // Check if dropped on another card
    const overTodo = todos.find((t) => t.id === targetId);
    if (overTodo) {
      const targetStatus = overTodo.status || 'todo';
      const targetColumn = columns.find(c => c.id === targetStatus);
      logger.debug('Dropped on card', { component: 'KanbanBoard', targetId, targetStatus });
      // Only change if different column
      if (previousStatus !== targetStatus) {
        logger.debug('Calling onStatusChange', { component: 'KanbanBoard', todoId, newStatus: targetStatus });
        // Celebrate if moving to done column
        if (targetStatus === 'done') {
          setCelebrating(true);
        }
        onStatusChange(todoId, targetStatus);
        setDragAnnouncement(`Moved task to ${targetColumn?.title || targetStatus} column.`);
      } else {
        setDragAnnouncement(`Task remains in ${targetColumn?.title || targetStatus} column.`);
      }
    } else {
      logger.debug('No matching column or card found for targetId', { component: 'KanbanBoard', targetId });
      setDragAnnouncement('Task dropped. No change.');
    }
  };

  const activeTodo = activeId ? todos.find((t) => t.id === activeId) : null;

  return (
    <div className="relative">
      {/* Screen reader announcements for drag operations */}
      <div
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {dragAnnouncement}
      </div>
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

      {/* Task Detail Modal — shared component */}
      {selectedTodo && (
        <TaskDetailModal
          todo={selectedTodo}
          isOpen={!!selectedTodo}
          onClose={() => setSelectedTodo(null)}
          users={users}
          currentUserName={currentUserName || users[0] || ''}
          onToggle={onToggle || (() => {})}
          onDelete={onDelete}
          onAssign={onAssign}
          onSetDueDate={onSetDueDate}
          onSetPriority={onSetPriority}
          onStatusChange={onStatusChange}
          onUpdateNotes={onUpdateNotes}
          onUpdateText={onUpdateText}
          onUpdateSubtasks={onUpdateSubtasks}
          onDuplicate={onDuplicate}
          onSetRecurrence={onSetRecurrence}
          onUpdateAttachments={onUpdateAttachments}
          onSaveAsTemplate={onSaveAsTemplate}
          onEmailCustomer={onEmailCustomer}
          onSetReminder={onSetReminder}
        />
      )}
    </div>
  );
}
