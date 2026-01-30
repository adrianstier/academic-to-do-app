'use client';

import { motion } from 'framer-motion';
import { Plus, AlertCircle, Play, MessageCircle, LucideIcon } from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'warning';
  badge?: number;
}

interface QuickActionsProps {
  onAddTask?: () => void;
  onFilterOverdue?: () => void;
  onStartFocus?: () => void;
  onOpenChat?: () => void;
  darkMode?: boolean;
  overdueCount?: number;
}

export default function QuickActions({
  onAddTask,
  onFilterOverdue,
  onStartFocus,
  onOpenChat,
  darkMode = false,
  overdueCount = 0,
}: QuickActionsProps) {
  const actions: QuickAction[] = [
    {
      id: 'add-task',
      label: 'Add Task',
      icon: Plus,
      onClick: onAddTask || (() => {}),
      variant: 'primary',
    },
    {
      id: 'my-overdue',
      label: 'My Overdue',
      icon: AlertCircle,
      onClick: onFilterOverdue || (() => {}),
      variant: overdueCount > 0 ? 'warning' : 'default',
      badge: overdueCount > 0 ? overdueCount : undefined,
    },
    {
      id: 'start-focus',
      label: 'Start Focus',
      icon: Play,
      onClick: onStartFocus || (() => {}),
    },
    {
      id: 'chat',
      label: 'Team Chat',
      icon: MessageCircle,
      onClick: onOpenChat || (() => {}),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="grid grid-cols-2 sm:grid-cols-4 gap-2"
    >
      {actions.map((action, index) => {
        const Icon = action.icon;
        const isPrimary = action.variant === 'primary';
        const isWarning = action.variant === 'warning';

        return (
          <motion.button
            key={action.id}
            onClick={action.onClick}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.1 * index }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              relative flex items-center justify-center gap-2
              px-3 py-3 rounded-lg
              min-h-[44px] min-w-[44px]
              text-sm font-medium
              transition-colors duration-150
              touch-manipulation
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c5282] focus-visible:ring-offset-2
              ${darkMode ? 'focus-visible:ring-offset-[#0A1628]' : 'focus-visible:ring-offset-white'}
              ${isPrimary
                ? darkMode
                  ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90'
                  : 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90'
                : isWarning
                  ? darkMode
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30'
                    : 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200'
                  : darkMode
                    ? 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white'
                    : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]'
              }
              border
              ${isPrimary
                ? 'border-transparent'
                : isWarning
                  ? '' // border color set above
                  : darkMode
                    ? 'border-white/10'
                    : 'border-[var(--border)]'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{action.label}</span>
            {action.badge !== undefined && (
              <span className={`
                absolute -top-1.5 -right-1.5
                min-w-[18px] h-[18px]
                flex items-center justify-center
                text-xs font-bold rounded-full
                ${darkMode ? 'bg-red-500 text-white' : 'bg-red-500 text-white'}
              `}>
                {action.badge}
              </span>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
