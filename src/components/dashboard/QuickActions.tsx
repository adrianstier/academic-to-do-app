'use client';

import { motion } from 'framer-motion';
import { Plus, Calendar, MessageCircle, BarChart3, LucideIcon } from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'primary';
}

interface QuickActionsProps {
  onAddTask?: () => void;
  onViewCalendar?: () => void;
  onOpenChat?: () => void;
  onViewReport?: () => void;
  darkMode?: boolean;
}

export default function QuickActions({
  onAddTask,
  onViewCalendar,
  onOpenChat,
  onViewReport,
  darkMode = false,
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
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      onClick: onViewCalendar || (() => {}),
    },
    {
      id: 'chat',
      label: 'Team Chat',
      icon: MessageCircle,
      onClick: onOpenChat || (() => {}),
    },
    {
      id: 'report',
      label: 'Weekly Report',
      icon: BarChart3,
      onClick: onViewReport || (() => {}),
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
              flex items-center justify-center gap-2
              px-3 py-2.5 rounded-lg
              text-sm font-medium
              transition-colors duration-150
              ${isPrimary
                ? darkMode
                  ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90'
                  : 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90'
                : darkMode
                  ? 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white'
                  : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]'
              }
              border
              ${isPrimary
                ? 'border-transparent'
                : darkMode
                  ? 'border-white/10'
                  : 'border-[var(--border)]'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{action.label}</span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
