'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

export type InsightType = 'info' | 'success' | 'warning' | 'tip' | 'alert';

interface InsightCardProps {
  type: InsightType;
  icon: LucideIcon;
  title: string;
  description: string | ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  darkMode?: boolean;
  delay?: number;
}

const typeStyles: Record<InsightType, {
  gradient: string;
  iconBg: string;
  iconColor: string;
  borderColor: string;
}> = {
  info: {
    gradient: 'from-blue-500 to-indigo-600',
    iconBg: 'bg-blue-500/10 dark:bg-blue-400/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-l-blue-500',
  },
  success: {
    gradient: 'from-emerald-500 to-teal-600',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-400/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-l-emerald-500',
  },
  warning: {
    gradient: 'from-amber-500 to-orange-600',
    iconBg: 'bg-amber-500/10 dark:bg-amber-400/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-l-amber-500',
  },
  tip: {
    gradient: 'from-purple-500 to-violet-600',
    iconBg: 'bg-purple-500/10 dark:bg-purple-400/20',
    iconColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-l-purple-500',
  },
  alert: {
    gradient: 'from-red-500 to-rose-600',
    iconBg: 'bg-red-500/10 dark:bg-red-400/20',
    iconColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-l-red-500',
  },
};

export default function InsightCard({
  type,
  icon: Icon,
  title,
  description,
  action,
  darkMode = false,
  delay = 0,
}: InsightCardProps) {
  const styles = typeStyles[type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`
        relative p-4 rounded-lg border-l-4
        ${styles.borderColor}
        ${darkMode
          ? 'bg-[var(--surface-2)] border border-white/5'
          : 'bg-white border border-[var(--border)]'
        }
        shadow-sm
      `}
    >
      <div className="flex gap-3">
        <div className={`
          flex-shrink-0 p-2 rounded-lg
          ${darkMode ? styles.iconBg.replace('dark:', '') : styles.iconBg.split(' ')[0]}
        `}>
          <Icon className={`w-5 h-5 ${darkMode ? styles.iconColor.split(' ')[1]?.replace('dark:', '') : styles.iconColor.split(' ')[0]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`
            font-medium text-sm mb-1
            ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}
          `}>
            {title}
          </h4>
          <div className={`
            text-sm leading-relaxed
            ${darkMode ? 'text-white/70' : 'text-[var(--text-muted)]'}
          `}>
            {description}
          </div>
          {action && (
            <button
              onClick={action.onClick}
              className={`
                mt-3 text-sm font-medium
                ${darkMode
                  ? 'text-[var(--accent)] hover:text-[var(--accent)]/80'
                  : 'text-[var(--accent)] hover:text-[var(--accent)]/80'
                }
                transition-colors
              `}
            >
              {action.label} →
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
