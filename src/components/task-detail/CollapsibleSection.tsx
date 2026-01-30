'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { CollapsibleSectionProps } from './types';

export default function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  accentColor = 'var(--accent)',
  children,
  actions,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-[var(--radius-lg)] border"
      style={{ borderColor: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}
    >
      {/* Header row — uses a div wrapper to avoid nesting buttons */}
      <div className="flex items-center justify-between w-full px-3 py-2.5 rounded-[var(--radius-lg)]">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="flex items-center gap-2 flex-1 min-w-0 text-left transition-colors hover:opacity-80"
        >
          <span style={{ color: accentColor }}>{icon}</span>
          <span className="text-sm font-medium" style={{ color: accentColor }}>
            {title}
          </span>
          {badge && (
            <span
              className="text-xs opacity-70"
              style={{ color: accentColor }}
            >
              ({badge})
            </span>
          )}
          <ChevronDown
            className="w-4 h-4 transition-transform ml-auto"
            style={{
              color: accentColor,
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </button>
        {actions && (
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
