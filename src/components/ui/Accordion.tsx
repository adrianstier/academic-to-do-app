'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { prefersReducedMotion, DURATION } from '@/lib/animations';

interface SimpleAccordionProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  'aria-label'?: string;
  className?: string;
}

/**
 * Simple Accordion component for progressive disclosure
 * Follows WCAG 2.1 guidelines with proper ARIA attributes
 */
export function SimpleAccordion({
  trigger,
  children,
  defaultOpen = false,
  'aria-label': ariaLabel,
  className = ''
}: SimpleAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-start w-full py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded-lg"
        aria-expanded={isOpen}
        aria-label={ariaLabel || 'Toggle more options'}
        data-state={isOpen ? 'open' : 'closed'}
      >
        <ChevronDown
          className={`w-4 h-4 mr-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
        {trigger}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={prefersReducedMotion() ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: prefersReducedMotion() ? 0 : DURATION.normal,
              ease: 'easeInOut'
            }}
            className="overflow-hidden"
            role="region"
            aria-label={ariaLabel ? `${ariaLabel} content` : 'Accordion content'}
          >
            <div className="pt-2 pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
