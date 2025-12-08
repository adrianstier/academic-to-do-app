'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Trash2,
  Calendar,
  User,
  Flag,
  ChevronDown,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Todo, TodoPriority, PRIORITY_CONFIG } from '@/types/todo';

interface TodoItemProps {
  todo: Todo;
  users: string[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
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

const isOverdue = (date: string) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
};

const getDaysUntil = (date: string) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
};

export default function TodoItem({
  todo,
  users,
  onToggle,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority
}: TodoItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const daysUntil = todo.due_date ? getDaysUntil(todo.due_date) : null;
  const overdue = todo.due_date && !todo.completed && isOverdue(todo.due_date);

  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => onDelete(todo.id), 200);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: isDeleting ? 0 : 1,
        y: 0,
        scale: isDeleting ? 0.95 : 1,
        x: isDeleting ? 100 : 0
      }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`group bg-white dark:bg-slate-900 rounded-[20px] shadow-sm border transition-all duration-200 hover:shadow-md ${
        overdue
          ? 'border-red-200 dark:border-red-900/50'
          : 'border-warm-gold/20 dark:border-slate-800 hover:border-warm-gold/40 dark:hover:border-warm-gold/30'
      }`}
    >
      {/* Priority accent bar */}
      <div
        className="h-1.5 rounded-t-[20px] transition-colors"
        style={{ backgroundColor: priorityConfig.color }}
      />

      {/* Main content */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Checkbox - Warm and satisfying */}
          <motion.button
            onClick={() => onToggle(todo.id, !todo.completed)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`mt-0.5 w-7 h-7 rounded-[10px] border-2 flex items-center justify-center transition-all ${
              todo.completed
                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-500 shadow-md shadow-emerald-500/30'
                : 'border-warm-gold/50 dark:border-slate-600 hover:border-warm-gold hover:bg-warm-gold/10'
            }`}
          >
            <AnimatePresence>
              {todo.completed && (
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Text and metadata */}
          <div className="flex-1 min-w-0">
            <p className={`text-base leading-relaxed transition-all ${
              todo.completed
                ? 'text-warm-brown/40 dark:text-slate-500 line-through'
                : 'text-warm-brown dark:text-slate-100'
            }`}>
              {todo.text}
            </p>

            {/* Inline metadata */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {/* Priority badge */}
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-medium"
                style={{
                  backgroundColor: priorityConfig.bgColor,
                  color: priorityConfig.color
                }}
              >
                <Flag className="w-3 h-3" />
                {priorityConfig.label}
              </span>

              {/* Due date */}
              {todo.due_date && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-medium ${
                  todo.completed
                    ? 'bg-warm-cream dark:bg-slate-800 text-warm-brown/40'
                    : overdue
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : daysUntil !== null && daysUntil <= 2
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        : 'bg-warm-gold/10 dark:bg-warm-gold/20 text-warm-gold dark:text-amber-400'
                }`}>
                  {overdue ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <Clock className="w-3 h-3" />
                  )}
                  {formatDueDate(todo.due_date)}
                </span>
              )}

              {/* Assigned to */}
              {todo.assigned_to && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-medium bg-warm-gold/10 dark:bg-warm-gold/20 text-warm-gold dark:text-amber-400">
                  <User className="w-3 h-3" />
                  {todo.assigned_to}
                </span>
              )}

              {/* Created by */}
              <span className="text-xs text-warm-brown/40 dark:text-slate-500">
                by {todo.created_by}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <motion.button
              onClick={() => setIsExpanded(!isExpanded)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-[10px] hover:bg-warm-cream dark:hover:bg-slate-800 text-warm-brown/40 hover:text-warm-brown dark:hover:text-slate-300 transition-colors"
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </motion.button>

            <motion.button
              onClick={handleDelete}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-[10px] hover:bg-red-50 dark:hover:bg-red-900/20 text-warm-brown/40 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* Expanded section */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-warm-gold/10 dark:border-slate-800 grid grid-cols-3 gap-3">
                {/* Priority selector */}
                <div className="relative">
                  <label className="block text-xs font-medium text-warm-brown/60 dark:text-slate-400 mb-1.5">
                    Priority
                  </label>
                  <button
                    onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[12px] bg-warm-cream dark:bg-slate-800 hover:bg-warm-gold/10 dark:hover:bg-slate-700 transition-colors text-sm"
                    style={{ color: priorityConfig.color }}
                  >
                    <Flag className="w-4 h-4" />
                    {priorityConfig.label}
                  </button>

                  <AnimatePresence>
                    {showPriorityMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-[12px] shadow-xl border border-warm-gold/20 dark:border-slate-700 overflow-hidden z-50"
                      >
                        {(['urgent', 'high', 'medium', 'low'] as TodoPriority[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => {
                              onSetPriority(todo.id, p);
                              setShowPriorityMenu(false);
                            }}
                            className={`w-full px-3 py-2.5 flex items-center gap-2 text-left text-sm hover:bg-warm-cream dark:hover:bg-slate-700 transition-colors ${
                              priority === p ? 'bg-warm-cream dark:bg-slate-700' : ''
                            }`}
                            style={{ color: PRIORITY_CONFIG[p].color }}
                          >
                            <Flag className="w-4 h-4" />
                            {PRIORITY_CONFIG[p].label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Due date */}
                <div>
                  <label className="block text-xs font-medium text-warm-brown/60 dark:text-slate-400 mb-1.5">
                    Due Date
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-[12px] bg-warm-cream dark:bg-slate-800">
                    <Calendar className="w-4 h-4 text-warm-gold" />
                    <input
                      type="date"
                      value={todo.due_date ? todo.due_date.split('T')[0] : ''}
                      onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
                      className="flex-1 text-sm bg-transparent text-warm-brown dark:text-slate-300 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Assignee */}
                <div className="relative">
                  <label className="block text-xs font-medium text-warm-brown/60 dark:text-slate-400 mb-1.5">
                    Assigned To
                  </label>
                  <button
                    onClick={() => setShowAssignMenu(!showAssignMenu)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[12px] bg-warm-cream dark:bg-slate-800 hover:bg-warm-gold/10 dark:hover:bg-slate-700 transition-colors text-sm text-warm-brown dark:text-slate-300"
                  >
                    <User className="w-4 h-4 text-warm-gold" />
                    {todo.assigned_to || 'Unassigned'}
                  </button>

                  <AnimatePresence>
                    {showAssignMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-[12px] shadow-xl border border-warm-gold/20 dark:border-slate-700 overflow-hidden z-50"
                      >
                        <button
                          onClick={() => {
                            onAssign(todo.id, null);
                            setShowAssignMenu(false);
                          }}
                          className={`w-full px-3 py-2.5 flex items-center gap-2 text-left text-sm hover:bg-warm-cream dark:hover:bg-slate-700 transition-colors text-warm-brown/60 ${
                            !todo.assigned_to ? 'bg-warm-cream dark:bg-slate-700' : ''
                          }`}
                        >
                          <User className="w-4 h-4" />
                          Unassigned
                        </button>
                        {users.map((user) => (
                          <button
                            key={user}
                            onClick={() => {
                              onAssign(todo.id, user);
                              setShowAssignMenu(false);
                            }}
                            className={`w-full px-3 py-2.5 flex items-center gap-2 text-left text-sm hover:bg-warm-cream dark:hover:bg-slate-700 transition-colors text-warm-brown dark:text-slate-300 ${
                              todo.assigned_to === user ? 'bg-warm-cream dark:bg-slate-700' : ''
                            }`}
                          >
                            <User className="w-4 h-4" />
                            {user}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Close menus on click outside */}
      {(showPriorityMenu || showAssignMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowPriorityMenu(false);
            setShowAssignMenu(false);
          }}
        />
      )}
    </motion.div>
  );
}
