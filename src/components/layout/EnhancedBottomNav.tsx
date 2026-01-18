'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare,
  LayoutDashboard,
  MessageCircle,
  Menu,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle,
  List,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppShell, ActiveView } from './AppShell';

// ═══════════════════════════════════════════════════════════════════════════
// ENHANCED BOTTOM NAVIGATION
// A modern, iOS-style bottom navigation with contextual actions
// Features:
// - Primary navigation tabs
// - Floating action button for quick task creation
// - Gesture-friendly touch targets (48px minimum)
// - Safe area handling for notched devices
// - Badge notifications
// ═══════════════════════════════════════════════════════════════════════════

interface NavTab {
  id: ActiveView | 'add';
  label: string;
  icon: typeof CheckSquare;
  badge?: number;
  badgeColor?: string;
}

export default function EnhancedBottomNav() {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const {
    activeView,
    setActiveView,
    openMobileSheet,
    currentUser,
  } = useAppShell();

  // Stats for badges (these would come from props or context in real implementation)
  const [stats, setStats] = useState({
    unreadMessages: 0,
    overdueTasks: 0,
    dueTodayTasks: 0,
  });

  const tabs: NavTab[] = [
    {
      id: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'add',
      label: 'Add',
      icon: Plus,
    },
    {
      id: 'chat',
      label: 'Messages',
      icon: MessageCircle,
      badge: stats.unreadMessages,
    },
    {
      id: 'activity',
      label: 'More',
      icon: Menu,
    },
  ];

  const handleTabPress = (tabId: ActiveView | 'add') => {
    if (tabId === 'add') {
      // Open quick add modal or focus task input
      setActiveView('tasks');
      // TODO: Trigger add task focus
    } else if (tabId === 'activity') {
      // Open more menu sheet
      openMobileSheet('menu');
    } else {
      setActiveView(tabId);
    }
  };

  return (
    <nav
      className={`
        fixed bottom-0 left-0 right-0 z-40 md:hidden
        pb-safe
        ${darkMode
          ? 'bg-[var(--surface)]/95 backdrop-blur-xl border-t border-white/10'
          : 'bg-white/95 backdrop-blur-xl border-t border-[var(--border)]'
        }
      `}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto px-2">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = tab.id !== 'add' && activeView === tab.id;
          const isAddButton = tab.id === 'add';
          const isMoreButton = tab.id === 'activity';

          // Floating add button in center
          if (isAddButton) {
            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab.id)}
                className={`
                  relative -mt-6 w-14 h-14 rounded-2xl
                  flex items-center justify-center
                  bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-blue-light)]
                  text-white shadow-lg shadow-[var(--brand-blue)]/30
                  active:scale-95 transition-transform
                `}
                aria-label="Create new task"
              >
                <Plus className="w-6 h-6" strokeWidth={2.5} />

                {/* Subtle glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => handleTabPress(tab.id)}
              className={`
                relative flex flex-col items-center justify-center
                min-w-[64px] h-16 px-3
                transition-all duration-200
                ${isActive
                  ? 'scale-105'
                  : 'opacity-60 active:opacity-100 active:scale-95'
                }
              `}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
            >
              {/* Active indicator pill */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className={`
                    absolute top-1 w-8 h-1 rounded-full
                    bg-[var(--accent)]
                  `}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              {/* Icon with badge */}
              <div className="relative">
                <Icon
                  className={`
                    w-6 h-6 transition-colors
                    ${isActive
                      ? 'text-[var(--accent)]'
                      : darkMode
                        ? 'text-white/60'
                        : 'text-[var(--text-muted)]'
                    }
                  `}
                />

                {/* Badge */}
                {tab.badge && tab.badge > 0 && (
                  <span
                    className={`
                      absolute -top-1.5 -right-1.5
                      min-w-[18px] h-[18px] px-1
                      flex items-center justify-center
                      rounded-full text-[10px] font-bold
                      bg-[var(--danger)] text-white
                    `}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`
                  text-[10px] font-medium mt-1 transition-colors
                  ${isActive
                    ? 'text-[var(--accent)]'
                    : darkMode
                      ? 'text-white/40'
                      : 'text-[var(--text-muted)]'
                  }
                `}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// QUICK FILTER PILLS
// A secondary navigation row for rapid task filtering
// ═══════════════════════════════════════════════════════════════════════════

interface QuickFilterPillsProps {
  currentFilter: string;
  onFilterChange: (filter: string) => void;
  stats: {
    all: number;
    dueToday: number;
    overdue: number;
    completed: number;
  };
}

export function QuickFilterPills({
  currentFilter,
  onFilterChange,
  stats,
}: QuickFilterPillsProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';

  const filters = [
    { id: 'all', label: 'All', count: stats.all, icon: List },
    { id: 'due_today', label: 'Today', count: stats.dueToday, icon: Calendar, color: 'var(--warning)' },
    { id: 'overdue', label: 'Overdue', count: stats.overdue, icon: AlertTriangle, color: 'var(--danger)' },
    { id: 'done', label: 'Done', count: stats.completed, icon: CheckCircle, color: 'var(--success)' },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 -mx-4 scrollbar-hide">
      {filters.map(filter => {
        const isActive = currentFilter === filter.id;
        const Icon = filter.icon;
        const hasItems = filter.count > 0;

        // Hide overdue if no items
        if (filter.id === 'overdue' && !hasItems) return null;

        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full
              text-sm font-medium whitespace-nowrap
              transition-all
              ${isActive
                ? `${darkMode ? 'bg-white/15 text-white' : 'bg-[var(--accent-light)] text-[var(--accent)]'}`
                : `${darkMode ? 'bg-white/5 text-white/60' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`
              }
            `}
            style={isActive && filter.color ? { color: filter.color } : undefined}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{filter.label}</span>
            {filter.count > 0 && (
              <span
                className={`
                  min-w-[20px] h-5 flex items-center justify-center
                  px-1.5 rounded-full text-xs
                  ${isActive
                    ? darkMode
                      ? 'bg-white/20'
                      : 'bg-[var(--accent)]/15'
                    : darkMode
                      ? 'bg-white/10'
                      : 'bg-[var(--surface-3)]'
                  }
                `}
                style={isActive && filter.color ? {
                  backgroundColor: `color-mix(in srgb, ${filter.color} 15%, transparent)`,
                } : undefined}
              >
                {filter.count > 99 ? '99+' : filter.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
