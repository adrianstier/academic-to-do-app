'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Loader2, Share2, Lock } from 'lucide-react';
import { Todo, PRIORITY_CONFIG } from '@/types/todo';
import { useEscapeKey, useFocusTrap } from '@/hooks';
import {
  backdropVariants,
  modalVariants,
  modalTransition,
  prefersReducedMotion,
  DURATION,
} from '@/lib/animations';

interface SaveTemplateModalProps {
  todo: Todo;
  darkMode?: boolean;
  onClose: () => void;
  onSave: (name: string, isShared: boolean) => Promise<void>;
}

export default function SaveTemplateModal({
  todo,
  darkMode = true,
  onClose,
  onSave,
}: SaveTemplateModalProps) {
  const [name, setName] = useState(todo.text.slice(0, 50));
  const [isShared, setIsShared] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const priorityConfig = PRIORITY_CONFIG[todo.priority || 'medium'];
  const subtasks = todo.subtasks || [];

  // Handle Escape key to close modal
  useEscapeKey(onClose);

  // Focus trap for accessibility (WCAG 2.1 AA)
  const { containerRef } = useFocusTrap<HTMLDivElement>({
    onEscape: onClose,
    autoFocus: true,
  });

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a template name');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await onSave(name.trim(), isShared);
      onClose();
    } catch {
      setError('Failed to save template. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const reducedMotion = prefersReducedMotion();

  return (
    <motion.div
      variants={reducedMotion ? undefined : backdropVariants}
      initial={reducedMotion ? { opacity: 1 } : 'hidden'}
      animate={reducedMotion ? { opacity: 1 } : 'visible'}
      exit={reducedMotion ? { opacity: 0 } : 'exit'}
      transition={{ duration: reducedMotion ? 0 : DURATION.fast }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Save as Template"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : DURATION.fast }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        ref={containerRef}
        variants={reducedMotion ? undefined : modalVariants}
        initial={reducedMotion ? { opacity: 1 } : 'hidden'}
        animate={reducedMotion ? { opacity: 1 } : 'visible'}
        exit={reducedMotion ? { opacity: 0 } : 'exit'}
        transition={reducedMotion ? { duration: 0 } : modalTransition}
        className="relative w-full max-w-md rounded-2xl shadow-2xl bg-[var(--surface)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Save as Template
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--surface-2)] text-[var(--text-muted)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Template Name */}
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--foreground)]">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name"
              className="w-full px-3 py-2 rounded-lg border text-sm bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
              autoFocus
            />
          </div>

          {/* Preview */}
          <div className="p-3 rounded-lg bg-[var(--surface-2)]">
            <p className="text-xs font-medium uppercase tracking-wide mb-2 text-[var(--text-muted)]">
              Template Preview
            </p>

            <div className="space-y-2">
              {/* Task text */}
              <p className="text-sm text-[var(--foreground)]">
                {todo.text}
              </p>

              {/* Metadata */}
              <div className="flex flex-wrap gap-2">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
                  style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
                >
                  {priorityConfig.label} priority
                </span>

                {todo.assigned_to && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--text-muted)]">
                    Assigned to: {todo.assigned_to}
                  </span>
                )}

                {subtasks.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)]">
                    {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Subtasks preview */}
              {subtasks.length > 0 && (
                <div className="mt-2 pl-3 border-l-2 border-[var(--border)]">
                  {subtasks.slice(0, 3).map((st, i) => (
                    <p key={i} className="text-xs text-[var(--text-muted)]">
                      • {st.text}
                    </p>
                  ))}
                  {subtasks.length > 3 && (
                    <p className="text-xs text-[var(--text-light)]">
                      +{subtasks.length - 3} more...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Share toggle */}
          <div className="flex items-center justify-between">
            <label
              className="flex items-center gap-2 cursor-pointer text-[var(--foreground)]"
            >
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="text-sm">Share with team</span>
            </label>
            {isShared ? (
              <Share2 className="w-4 h-4 text-blue-500" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* Info */}
          <p className="text-xs text-[var(--text-light)]">
            Templates save the task description, priority, default assignee, and subtasks.
            {isShared ? ' Team members will be able to use this template.' : ' Only you will see this template.'}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
          >
            Cancel
          </button>
          <motion.button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            whileHover={prefersReducedMotion() || isSaving ? undefined : { scale: 1.02 }}
            whileTap={prefersReducedMotion() || isSaving ? undefined : { scale: 0.98 }}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[#002880] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Save Template
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
