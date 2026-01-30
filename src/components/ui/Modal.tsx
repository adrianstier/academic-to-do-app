'use client';

import { useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import {
  backdropVariants,
  modalVariants,
  modalTransition,
  prefersReducedMotion,
  DURATION,
} from '@/lib/animations';

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal content */
  children: ReactNode;
  /** Modal title for accessibility */
  title?: string;
  /** Modal description for accessibility */
  description?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Whether clicking backdrop closes modal */
  closeOnBackdropClick?: boolean;
  /** Whether pressing Escape closes modal */
  closeOnEscape?: boolean;
  /** Custom className for the modal container */
  className?: string;
  /** ID for aria-labelledby (auto-generated if not provided) */
  ariaLabelledBy?: string;
  /** ID for aria-describedby */
  ariaDescribedBy?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

/**
 * Reusable Modal Component
 *
 * Features:
 * - Consistent backdrop blur and animation
 * - Focus trap for keyboard navigation
 * - Escape key handling
 * - ARIA attributes for accessibility
 * - Prevents body scroll when open
 */
export function Modal({
  isOpen,
  onClose,
  children,
  title,
  description,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className = '',
  ariaLabelledBy,
  ariaDescribedBy,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const modalId = useRef(`modal-${Math.random().toString(36).slice(2, 9)}`);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const titleId = ariaLabelledBy || `${modalId.current}-title`;
  const descriptionId = ariaDescribedBy || `${modalId.current}-description`;

  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && closeOnEscape) {
      e.preventDefault();
      onClose();
    }

    // Focus trap
    if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (!firstElement) return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, [closeOnEscape, onClose]);

  // Manage focus and body scroll
  useEffect(() => {
    if (!isOpen) return;

    // Store previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Prevent body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown);

    // Focus first focusable element in modal
    setTimeout(() => {
      if (modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        firstElement?.focus();
      }
    }, 50);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus
      previousActiveElement.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Respect reduced motion preference
  const reducedMotion = prefersReducedMotion();

  const modalContent = (
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
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          onClick={handleBackdropClick}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : DURATION.fast }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal container */}
          <motion.div
            ref={modalRef}
            variants={reducedMotion ? undefined : modalVariants}
            initial={reducedMotion ? { opacity: 1 } : 'hidden'}
            animate={reducedMotion ? { opacity: 1 } : 'visible'}
            exit={reducedMotion ? { opacity: 0 } : 'exit'}
            transition={reducedMotion ? { duration: 0 } : modalTransition}
            className={`
              relative w-full ${sizeClasses[size]}
              bg-[var(--surface)] rounded-2xl shadow-2xl
              border border-[var(--border-subtle)]
              max-h-[90vh] overflow-hidden
              ${className}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Screen reader only title if provided but not visible */}
            {title && (
              <span id={titleId} className="sr-only">
                {title}
              </span>
            )}
            {description && (
              <span id={descriptionId} className="sr-only">
                {description}
              </span>
            )}

            {/* Close button */}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="
                  absolute top-3 right-3 z-10
                  p-2 rounded-lg
                  text-[var(--text-muted)] hover:text-[var(--foreground)]
                  hover:bg-[var(--surface-2)]
                  transition-colors
                  min-h-[44px] min-w-[44px]
                  flex items-center justify-center
                "
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Portal to document.body to escape parent stacking contexts
  if (mounted) {
    return createPortal(modalContent, document.body);
  }

  return null;
}

/**
 * Modal Header Component
 */
interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
  /** ID for aria-labelledby reference */
  id?: string;
}

export function ModalHeader({ children, className = '', id }: ModalHeaderProps) {
  return (
    <div
      id={id}
      className={`p-4 sm:p-6 pb-0 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Modal Body Component
 */
interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

export function ModalBody({ children, className = '' }: ModalBodyProps) {
  return (
    <div className={`p-4 sm:p-6 overflow-y-auto ${className}`}>
      {children}
    </div>
  );
}

/**
 * Modal Footer Component
 */
interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div
      className={`
        p-4 sm:p-6 pt-4
        border-t border-[var(--border-subtle)]
        bg-[var(--surface-2)]
        flex flex-col sm:flex-row gap-3 sm:justify-end
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export default Modal;
