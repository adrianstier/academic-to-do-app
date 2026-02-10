'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import AddTodo from './AddTodo';
import { TodoPriority, Subtask } from '@/types/todo';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    text: string,
    priority: TodoPriority,
    dueDate?: string,
    assignedTo?: string,
    subtasks?: Subtask[],
    transcription?: string,
    sourceFile?: File,
    reminderAt?: string,
    notes?: string,
    recurrence?: 'daily' | 'weekly' | 'monthly' | null
  ) => void;
  users: string[];
  darkMode?: boolean;
  currentUserId?: string;
}

export default function AddTaskModal({
  isOpen,
  onClose,
  onAdd,
  users,
  darkMode = true,
  currentUserId,
}: AddTaskModalProps) {
  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Wrap onAdd to close modal after adding
  const handleAdd = useCallback(
    (
      text: string,
      priority: TodoPriority,
      dueDate?: string,
      assignedTo?: string,
      subtasks?: Subtask[],
      transcription?: string,
      sourceFile?: File,
      reminderAt?: string,
      notes?: string,
      recurrence?: 'daily' | 'weekly' | 'monthly' | null
    ) => {
      onAdd(text, priority, dueDate, assignedTo, subtasks, transcription, sourceFile, reminderAt, notes, recurrence);
      onClose();
    },
    [onAdd, onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-x-4 top-[5vh] bottom-[5vh] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-auto sm:w-full sm:max-w-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Add new task"
          >
            <div
              className={`
                rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-full
                ${darkMode
                  ? 'bg-[var(--surface)] border-white/10'
                  : 'bg-white border-[var(--border)]'
                }
              `}
            >
              {/* Header */}
              <div
                className={`
                  flex items-center justify-between px-6 py-5 border-b
                  ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}
                `}
              >
                <h2
                  className={`
                    text-xl font-semibold
                    ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}
                  `}
                >
                  Add New Task
                </h2>
                <button
                  onClick={onClose}
                  className={`
                    p-2.5 rounded-lg transition-colors
                    ${darkMode
                      ? 'text-white/70 hover:text-white hover:bg-white/10'
                      : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                    }
                  `}
                  aria-label="Close modal"
                >
                  <X className="w-6 h-6" strokeWidth={2.5} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 pt-4 overflow-y-auto flex-1 min-h-0">
                <AddTodo
                  onAdd={handleAdd}
                  users={users}
                  darkMode={darkMode}
                  currentUserId={currentUserId}
                  autoFocus={true}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
