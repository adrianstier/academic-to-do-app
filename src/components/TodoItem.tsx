'use client';

import { useState } from 'react';
import { Check, Trash2, Calendar, User, Flag, Copy, MessageSquare, ChevronDown, ChevronUp, Repeat } from 'lucide-react';
import { Todo, TodoPriority, PRIORITY_CONFIG, RecurrencePattern } from '@/types/todo';
import Celebration from './Celebration';

interface TodoItemProps {
  todo: Todo;
  users: string[];
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onDuplicate?: (todo: Todo) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onSetRecurrence?: (id: string, recurrence: RecurrencePattern) => void;
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
  overdue: 'bg-red-100 text-red-700 border border-red-200',
  today: 'bg-orange-100 text-orange-700 border border-orange-200',
  upcoming: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  future: 'bg-slate-100 text-slate-600',
};

export default function TodoItem({
  todo,
  users,
  selected,
  onSelect,
  onToggle,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority,
  onDuplicate,
  onUpdateNotes,
  onSetRecurrence,
}: TodoItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [notes, setNotes] = useState(todo.notes || '');
  const [showNotes, setShowNotes] = useState(false);
  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const dueDateStatus = todo.due_date ? getDueDateStatus(todo.due_date, todo.completed) : null;

  const handleToggle = () => {
    if (!todo.completed) {
      setCelebrating(true);
    }
    onToggle(todo.id, !todo.completed);
  };

  const handleNotesBlur = () => {
    if (onUpdateNotes && notes !== todo.notes) {
      onUpdateNotes(todo.id, notes);
    }
  };

  return (
    <div
      className={`group relative bg-white rounded-xl border-2 transition-all ${
        todo.completed
          ? 'border-slate-100 opacity-60'
          : dueDateStatus === 'overdue'
            ? 'border-red-200 bg-red-50/30'
            : selected
              ? 'border-[#0033A0] bg-[#0033A0]/5'
              : 'border-slate-100 hover:border-[#0033A0]/30 hover:shadow-md'
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
            className="w-4 h-4 rounded border-slate-300 text-[#0033A0] focus:ring-[#0033A0] cursor-pointer"
          />
        )}

        {/* Completion checkbox */}
        <button
          onClick={handleToggle}
          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            todo.completed
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-slate-300 hover:border-[#0033A0] hover:bg-[#0033A0]/5'
          }`}
        >
          {todo.completed && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
          <p className={`font-medium cursor-pointer ${
            todo.completed
              ? 'text-slate-400 line-through'
              : 'text-slate-800'
          }`}>
            {todo.text}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Priority */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
            >
              <Flag className="w-3 h-3" />
              {priorityConfig.label}
            </span>

            {/* Due date with color coding */}
            {todo.due_date && dueDateStatus && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                todo.completed ? 'bg-slate-100 text-slate-400' : dueDateStyles[dueDateStatus]
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
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <MessageSquare className="w-3 h-3" />
                Note
              </button>
            )}

            {/* Assigned to */}
            {todo.assigned_to && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-[#D4A853]/10 text-[#D4A853]">
                <User className="w-3 h-3" />
                {todo.assigned_to}
              </span>
            )}

            {/* Created by */}
            <span className="text-xs text-slate-400">
              by {todo.created_by}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Duplicate */}
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(todo)}
              className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
              title="Duplicate task"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}

          {/* Delete button */}
          <button
            onClick={() => onDelete(todo.id)}
            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notes display */}
      {showNotes && todo.notes && (
        <div className="mx-4 mb-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
          {todo.notes}
        </div>
      )}

      {/* Expanded actions */}
      {expanded && !todo.completed && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">
          {/* Row 1: Priority, Due date, Assign, Recurrence */}
          <div className="flex flex-wrap gap-2">
            {/* Priority selector */}
            <select
              value={priority}
              onChange={(e) => onSetPriority(todo.id, e.target.value as TodoPriority)}
              className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>

            {/* Due date */}
            <input
              type="date"
              value={todo.due_date ? todo.due_date.split('T')[0] : ''}
              onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
              className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
            />

            {/* Assign to */}
            <select
              value={todo.assigned_to || ''}
              onChange={(e) => onAssign(todo.id, e.target.value || null)}
              className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
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
                className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
              >
                <option value="">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>

          {/* Row 2: Notes */}
          {onUpdateNotes && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add notes or context..."
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] resize-none"
                rows={2}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
