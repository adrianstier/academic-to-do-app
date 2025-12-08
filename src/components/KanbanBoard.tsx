'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Flag,
  Calendar,
  User,
  Trash2,
  Clock,
  AlertCircle,
  GripVertical,
  Plus
} from 'lucide-react';
import { Todo, TodoStatus, TodoPriority, PRIORITY_CONFIG } from '@/types/todo';

interface KanbanBoardProps {
  todos: Todo[];
  users: string[];
  onStatusChange: (id: string, status: TodoStatus) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
}

const columns: { id: TodoStatus; title: string; icon: string; color: string; bgColor: string }[] = [
  { id: 'todo', title: 'To Do', icon: '📋', color: '#6366f1', bgColor: 'rgba(99, 102, 241, 0.05)' },
  { id: 'in_progress', title: 'In Progress', icon: '🚀', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.05)' },
  { id: 'done', title: 'Done', icon: '✅', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.05)' },
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

interface SortableCardProps {
  todo: Todo;
  users: string[];
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
}

function SortableCard({ todo, users, onDelete, onAssign, onSetDueDate, onSetPriority }: SortableCardProps) {
  const [showActions, setShowActions] = useState(false);
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

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden transition-shadow hover:shadow-md ${
        isDragging ? 'shadow-xl ring-2 ring-indigo-500' : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Priority bar */}
      <div
        className="h-1"
        style={{ backgroundColor: priorityConfig.color }}
      />

      <div className="p-3">
        {/* Header with drag handle */}
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-grab active:cursor-grabbing text-zinc-400"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium leading-snug ${
              todo.completed ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'
            }`}>
              {todo.text}
            </p>

            {/* Metadata row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Priority */}
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
              >
                <Flag className="w-2.5 h-2.5" />
                {priorityConfig.label}
              </span>

              {/* Due date */}
              {todo.due_date && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                  todo.completed
                    ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400'
                    : overdue
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                }`}>
                  {overdue ? <AlertCircle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                  {formatDueDate(todo.due_date)}
                </span>
              )}
            </div>

            {/* Assignee & Creator */}
            <div className="flex items-center justify-between mt-2">
              {todo.assigned_to ? (
                <span className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
                  <User className="w-3 h-3" />
                  {todo.assigned_to}
                </span>
              ) : (
                <span className="text-xs text-zinc-400">Unassigned</span>
              )}
              <span className="text-xs text-zinc-400">
                by {todo.created_by}
              </span>
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
              className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700"
            >
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={todo.due_date ? todo.due_date.split('T')[0] : ''}
                  onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <select
                  value={todo.assigned_to || ''}
                  onChange={(e) => onAssign(todo.id, e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(todo.id);
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function KanbanCard({ todo }: { todo: Todo }) {
  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const overdue = todo.due_date && !todo.completed && isOverdue(todo.due_date);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg border-2 border-indigo-500 overflow-hidden">
      <div className="h-1" style={{ backgroundColor: priorityConfig.color }} />
      <div className="p-3">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{todo.text}</p>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
          >
            <Flag className="w-2.5 h-2.5" />
            {priorityConfig.label}
          </span>
          {todo.due_date && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
              overdue
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
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

export default function KanbanBoard({
  todos,
  users,
  onStatusChange,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const getTodosByStatus = (status: TodoStatus) => {
    return todos.filter((todo) => (todo.status || 'todo') === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const todoId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const column = columns.find((c) => c.id === overId);
    if (column) {
      onStatusChange(todoId, column.id);
      return;
    }

    // Check if dropped on another card
    const overTodo = todos.find((t) => t.id === overId);
    if (overTodo) {
      onStatusChange(todoId, overTodo.status || 'todo');
    }
  };

  const activeTodo = activeId ? todos.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((column) => {
          const columnTodos = getTodosByStatus(column.id);

          return (
            <motion.div
              key={column.id}
              layout
              className="flex flex-col"
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-4 py-3 rounded-t-2xl"
                style={{ backgroundColor: column.bgColor }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{column.icon}</span>
                  <h3 className="font-semibold text-zinc-800 dark:text-zinc-100">
                    {column.title}
                  </h3>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-sm font-medium"
                  style={{ backgroundColor: column.color + '20', color: column.color }}
                >
                  {columnTodos.length}
                </span>
              </div>

              {/* Column body */}
              <SortableContext
                items={columnTodos.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
                id={column.id}
              >
                <div
                  className="flex-1 p-3 rounded-b-2xl min-h-[200px] space-y-3 transition-colors"
                  style={{
                    backgroundColor: activeId ? column.bgColor : 'transparent',
                    border: `2px dashed ${activeId ? column.color + '40' : 'transparent'}`,
                  }}
                >
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
                      />
                    ))}
                  </AnimatePresence>

                  {columnTodos.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-500"
                    >
                      <Plus className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">Drop tasks here</p>
                    </motion.div>
                  )}
                </div>
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
  );
}
