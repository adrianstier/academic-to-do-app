'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Loader2, X, Calendar, Flag, User, ChevronDown, ChevronUp, Check, Pencil } from 'lucide-react';
import { TodoPriority, Subtask, PRIORITY_CONFIG } from '@/types/todo';
import { fetchWithCsrf } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { prefersReducedMotion, DURATION } from '@/lib/animations';

interface InlineAddTaskProps {
  onAdd: (
    text: string,
    priority: TodoPriority,
    dueDate?: string,
    assignedTo?: string,
    subtasks?: Subtask[],
    transcription?: string,
    sourceFile?: File,
    reminderAt?: string
  ) => void;
  users: string[];
  darkMode?: boolean;
  currentUserId?: string;
  autoFocus?: boolean;
}

interface SmartParseResult {
  mainTask: {
    text: string;
    priority: TodoPriority;
    dueDate: string;
    assignedTo: string;
  };
  subtasks: Array<{
    text: string;
    priority: TodoPriority;
    estimatedMinutes?: number;
  }>;
  summary: string;
  wasComplex: boolean;
}

/**
 * InlineAddTask - Simplified single-line task input with inline AI preview
 *
 * Design principles:
 * - Single-line input that expands only when needed
 * - Submit triggers smart parsing for complex text
 * - Shows inline preview card below input for AI-parsed tasks
 * - One-click creation for simple tasks
 */
export default function InlineAddTask({
  onAdd,
  users,
  darkMode = true,
  currentUserId,
  autoFocus,
}: InlineAddTaskProps) {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [parsedResult, setParsedResult] = useState<SmartParseResult | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [expandedSubtasks, setExpandedSubtasks] = useState(false);

  // Edit state for preview card
  const [editText, setEditText] = useState('');
  const [editPriority, setEditPriority] = useState<TodoPriority>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Sync edit state when parsed result changes
  useEffect(() => {
    if (parsedResult) {
      setEditText(parsedResult.mainTask.text);
      setEditPriority(parsedResult.mainTask.priority);
      setEditDueDate(parsedResult.mainTask.dueDate || '');
      setEditAssignedTo(parsedResult.mainTask.assignedTo || '');
    }
  }, [parsedResult]);

  // Check if input is complex enough for AI parsing
  const isComplexInput = useMemo(() => {
    const lines = text.split('\n').filter((l) => l.trim());
    const hasBullets = /^[\s]*[-•*\d.)\]]\s/.test(text);
    return text.length > 50 || lines.length > 2 || hasBullets;
  }, [text]);

  // Smart parse API call
  const smartParse = useCallback(
    async (inputText: string): Promise<SmartParseResult | null> => {
      try {
        const response = await fetchWithCsrf('/api/ai/smart-parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText, users }),
        });

        if (!response.ok) {
          logger.error('Failed to smart parse', undefined, { component: 'InlineAddTask' });
          return null;
        }

        const data = await response.json();
        if (data.success && data.result) {
          return data.result as SmartParseResult;
        }
        return null;
      } catch (error) {
        logger.error('Error in smart parse', error, { component: 'InlineAddTask' });
        return null;
      }
    },
    [users]
  );

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isProcessing) return;

    // For simple text, create immediately
    if (!isComplexInput) {
      onAdd(text.trim(), 'medium');
      setText('');
      return;
    }

    // For complex text, parse with AI first
    setIsProcessing(true);
    const result = await smartParse(text.trim());

    if (result) {
      setParsedResult(result);
      setShowPreview(true);
    } else {
      // Fallback: create simple task if parsing fails
      onAdd(text.trim(), 'medium');
      setText('');
    }

    setIsProcessing(false);
  };

  // Handle creating task from preview
  const handleCreate = () => {
    if (!parsedResult) return;

    // Convert subtasks to proper format
    const subtasks: Subtask[] = parsedResult.subtasks.map((st, index) => ({
      id: `subtask-${Date.now()}-${index}`,
      text: st.text,
      completed: false,
      priority: st.priority || 'medium',
      estimatedMinutes: st.estimatedMinutes,
    }));

    onAdd(
      editText,
      editPriority,
      editDueDate || undefined,
      editAssignedTo || undefined,
      subtasks.length > 0 ? subtasks : undefined
    );

    // Reset
    setText('');
    setShowPreview(false);
    setParsedResult(null);
    setIsEditing(false);
  };

  // Handle canceling preview
  const handleCancel = () => {
    setShowPreview(false);
    setParsedResult(null);
    setIsEditing(false);
    inputRef.current?.focus();
  };

  // Get priority config
  const priorityConfig = PRIORITY_CONFIG[editPriority];

  return (
    <div className="space-y-3">
      {/* Main input */}
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`
            flex items-center gap-2 px-4 py-3 rounded-xl
            border-2 transition-all duration-200
            ${showPreview
              ? 'border-[var(--accent)]/40 bg-[var(--surface)]'
              : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/30 focus-within:border-[var(--accent)]/50 focus-within:shadow-[var(--shadow-md)]'
            }
          `}
        >
          {/* Search/Plus icon */}
          <div className="flex-shrink-0 text-[var(--text-muted)]">
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add task... (Type naturally or paste text)"
            disabled={isProcessing || showPreview}
            className="flex-1 bg-transparent text-[var(--foreground)] placeholder-[var(--text-muted)] text-base font-medium focus:outline-none disabled:opacity-50"
            aria-label="New task"
          />

          {/* AI indicator for complex input */}
          {text.trim() && isComplexInput && !showPreview && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI will parse</span>
            </div>
          )}

          {/* Clear button */}
          {text.trim() && !isProcessing && !showPreview && (
            <button
              type="button"
              onClick={() => setText('')}
              className="p-1.5 rounded-full text-[var(--text-light)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-all"
              aria-label="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Submit hint */}
          {text.trim() && !showPreview && (
            <kbd className="hidden sm:inline px-2 py-1 rounded bg-[var(--surface-2)] text-[var(--text-muted)] text-xs font-medium">
              Enter
            </kbd>
          )}
        </div>
      </form>

      {/* AI Preview Card */}
      <AnimatePresence>
        {showPreview && parsedResult && (
          <motion.div
            initial={prefersReducedMotion() ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion() ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: DURATION.normal }}
            className="rounded-xl border-2 border-[var(--accent)]/30 bg-[var(--surface)] shadow-[var(--shadow-lg)] overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--accent)]/5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-sm font-semibold text-[var(--accent)]">Parsed Task Preview</span>
              {parsedResult.wasComplex && (
                <span className="ml-auto text-xs text-[var(--text-muted)]">AI extracted details</span>
              )}
            </div>

            {/* Task content */}
            <div className="p-4 space-y-4">
              {/* Main task text */}
              {isEditing ? (
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-base font-medium focus:outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
              ) : (
                <p className="text-[var(--foreground)] font-medium text-base leading-snug">{editText}</p>
              )}

              {/* Metadata chips */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Priority */}
                {isEditing ? (
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TodoPriority)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm font-medium focus:outline-none"
                    style={{ color: PRIORITY_CONFIG[editPriority].color }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: `${priorityConfig.color}20`, color: priorityConfig.color }}
                  >
                    <Flag className="w-3 h-3" />
                    {priorityConfig.label}
                  </span>
                )}

                {/* Due date */}
                {isEditing ? (
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none"
                  />
                ) : editDueDate ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-xs font-medium text-[var(--foreground)]">
                    <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
                    {new Date(editDueDate).toLocaleDateString()}
                  </span>
                ) : null}

                {/* Assignee */}
                {isEditing ? (
                  <select
                    value={editAssignedTo}
                    onChange={(e) => setEditAssignedTo(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </select>
                ) : editAssignedTo ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-xs font-medium text-[var(--foreground)]">
                    <User className="w-3 h-3 text-[var(--text-muted)]" />
                    {editAssignedTo}
                  </span>
                ) : null}
              </div>

              {/* Subtasks */}
              {parsedResult.subtasks.length > 0 && (
                <div className="border-t border-[var(--border-subtle)] pt-3">
                  <button
                    type="button"
                    onClick={() => setExpandedSubtasks(!expandedSubtasks)}
                    className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {expandedSubtasks ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    {parsedResult.subtasks.length} subtask{parsedResult.subtasks.length !== 1 ? 's' : ''}
                  </button>

                  <AnimatePresence>
                    {expandedSubtasks && (
                      <motion.ul
                        initial={prefersReducedMotion() ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={prefersReducedMotion() ? undefined : { opacity: 0, height: 0 }}
                        transition={{ duration: DURATION.fast }}
                        className="mt-2 space-y-1.5 overflow-hidden"
                      >
                        {parsedResult.subtasks.map((subtask, index) => (
                          <li
                            key={index}
                            className="flex items-center gap-2 text-sm text-[var(--text-muted)] pl-2"
                          >
                            <div className="w-4 h-4 rounded border border-[var(--border)] flex-shrink-0" />
                            <span>{subtask.text}</span>
                            {subtask.estimatedMinutes && (
                              <span className="text-xs text-[var(--text-light)]">
                                ~{subtask.estimatedMinutes}m
                              </span>
                            )}
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-2)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-3)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-3)] transition-colors flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                {isEditing ? 'Done' : 'Edit'}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] hover:opacity-90 shadow-[var(--shadow-blue)] transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Create Task
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
