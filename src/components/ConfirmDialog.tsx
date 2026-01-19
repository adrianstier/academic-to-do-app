'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import {
  backdropVariants,
  modalVariants,
  modalTransition,
  prefersReducedMotion,
  DURATION,
} from '@/lib/animations';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus the cancel button when opening (safer default)
    confirmButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
      // Trap focus within dialog
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onCancel]);

  const reducedMotion = prefersReducedMotion();

  const iconBgColor = variant === 'danger' ? 'bg-red-100' : 'bg-amber-100';
  const iconColor = variant === 'danger' ? 'text-red-600' : 'text-amber-600';
  const confirmBgColor = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
    : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={reducedMotion ? undefined : backdropVariants}
          initial={reducedMotion ? { opacity: 1 } : 'hidden'}
          animate={reducedMotion ? { opacity: 1 } : 'visible'}
          exit={reducedMotion ? { opacity: 0 } : 'exit'}
          transition={{ duration: reducedMotion ? 0 : DURATION.fast }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : DURATION.fast }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            variants={reducedMotion ? undefined : modalVariants}
            initial={reducedMotion ? { opacity: 1 } : 'hidden'}
            animate={reducedMotion ? { opacity: 1 } : 'visible'}
            exit={reducedMotion ? { opacity: 0 } : 'exit'}
            transition={reducedMotion ? { duration: 0 } : modalTransition}
            className="relative bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-[var(--border-subtle)]"
          >
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={`w-12 h-12 ${iconBgColor} rounded-xl flex items-center justify-center mx-auto mb-4`}>
            {variant === 'danger' ? (
              <Trash2 className={`w-6 h-6 ${iconColor}`} aria-hidden="true" />
            ) : (
              <AlertTriangle className={`w-6 h-6 ${iconColor}`} aria-hidden="true" />
            )}
          </div>

          {/* Content */}
          <h2
            id="confirm-dialog-title"
            className="text-lg font-semibold text-[var(--foreground)] text-center mb-2"
          >
            {title}
          </h2>
          <p
            id="confirm-dialog-message"
            className="text-sm text-[var(--text-muted)] text-center mb-6"
          >
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <motion.button
              onClick={onCancel}
              whileHover={reducedMotion ? undefined : { scale: 1.02 }}
              whileTap={reducedMotion ? undefined : { scale: 0.98 }}
              className="flex-1 py-2.5 px-4 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--foreground)] font-medium rounded-lg transition-colors min-h-[44px] touch-manipulation"
            >
              {cancelLabel}
            </motion.button>
            <motion.button
              ref={confirmButtonRef}
              onClick={onConfirm}
              whileHover={reducedMotion ? undefined : { scale: 1.02 }}
              whileTap={reducedMotion ? undefined : { scale: 0.98 }}
              className={`flex-1 py-2.5 px-4 ${confirmBgColor} text-white font-medium rounded-lg transition-colors min-h-[44px] touch-manipulation`}
            >
              {confirmLabel}
            </motion.button>
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
