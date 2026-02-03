'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, AlertCircle } from 'lucide-react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface SaveIndicatorProps {
  state: SaveState;
  errorMessage?: string;
  className?: string;
}

/**
 * SaveIndicator component for visual feedback on save operations
 * Follows WCAG 2.1 guidelines with ARIA live regions for screen reader announcements
 */
export function SaveIndicator({ state, errorMessage, className = '' }: SaveIndicatorProps) {
  if (state === 'idle') return null;

  const stateConfig = {
    saving: {
      icon: Loader2,
      text: 'Saving...',
      color: 'text-slate-400',
      bgColor: 'bg-slate-700/50',
      iconClass: 'animate-spin',
    },
    saved: {
      icon: Check,
      text: 'Saved',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      iconClass: '',
    },
    error: {
      icon: AlertCircle,
      text: errorMessage || 'Save failed',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      iconClass: '',
    },
  };

  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgColor} ${className}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <Icon
          className={`w-4 h-4 ${config.color} ${config.iconClass}`}
          aria-hidden="true"
        />
        <span className={`text-sm font-medium ${config.color}`}>
          {config.text}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Compact version for inline use (e.g., in forms)
 */
export function SaveIndicatorCompact({ state, errorMessage }: Omit<SaveIndicatorProps, 'className'>) {
  if (state === 'idle') return null;

  const stateConfig = {
    saving: {
      icon: Loader2,
      color: 'text-slate-400',
      iconClass: 'animate-spin',
      label: 'Saving',
    },
    saved: {
      icon: Check,
      color: 'text-emerald-400',
      iconClass: '',
      label: 'Saved',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-400',
      iconClass: '',
      label: errorMessage || 'Error',
    },
  };

  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <motion.div
      key={state}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="inline-flex items-center gap-1.5"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={config.label}
    >
      <Icon
        className={`w-3.5 h-3.5 ${config.color} ${config.iconClass}`}
        aria-hidden="true"
      />
    </motion.div>
  );
}
