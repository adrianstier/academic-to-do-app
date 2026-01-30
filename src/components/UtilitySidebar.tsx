'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Users,
  Activity,
  Target,
  ChevronRight,
  Flame,
  Zap,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Todo, AuthUser, isOwner as checkIsOwner } from '@/types/todo';
import { format, isToday, isPast, startOfDay } from 'date-fns';

interface UtilitySidebarProps {
  todos: Todo[];
  currentUser: AuthUser;
  onNavigate?: (view: 'dashboard' | 'activity' | 'goals') => void;
  onFilterChange?: (filter: 'all' | 'my_tasks' | 'due_today' | 'overdue') => void;
}

/**
 * UtilitySidebar - A persistent sidebar with quick stats and navigation
 *
 * Features:
 * - Task statistics (completed, in progress, overdue)
 * - Quick filters
 * - Recent activity preview
 * - Streak/productivity indicators
 * - Navigation to other views
 */
export default function UtilitySidebar({
  todos,
  currentUser,
  onNavigate,
  onFilterChange,
}: UtilitySidebarProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const [expandedSection, setExpandedSection] = useState<string | null>('stats');

  const isOwner = checkIsOwner(currentUser);

  // Calculate statistics
  const stats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);

    const completed = todos.filter(t => t.completed).length;
    const active = todos.filter(t => !t.completed).length;
    const inProgress = todos.filter(t => t.status === 'in_progress' && !t.completed).length;

    const dueToday = todos.filter(t => {
      if (t.completed || !t.due_date) return false;
      const dueDate = startOfDay(new Date(t.due_date));
      return isToday(dueDate);
    }).length;

    const overdue = todos.filter(t => {
      if (t.completed || !t.due_date) return false;
      const dueDate = startOfDay(new Date(t.due_date));
      return isPast(dueDate) && !isToday(dueDate);
    }).length;

    const myTasks = todos.filter(t =>
      !t.completed && t.assigned_to === currentUser.name
    ).length;

    // Completion rate for the week
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const completedThisWeek = todos.filter(t =>
      t.completed &&
      t.updated_at &&
      new Date(t.updated_at) >= weekAgo
    ).length;

    return {
      total: todos.length,
      completed,
      active,
      inProgress,
      dueToday,
      overdue,
      myTasks,
      completedThisWeek,
      completionRate: todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0,
    };
  }, [todos, currentUser.name]);

  // Get urgent tasks
  const urgentTasks = useMemo(() => {
    return todos
      .filter(t => !t.completed && (t.priority === 'urgent' || t.priority === 'high'))
      .slice(0, 3);
  }, [todos]);

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const statCards = [
    {
      label: 'My Tasks',
      value: stats.myTasks,
      icon: Users,
      color: 'var(--accent)',
      bgColor: 'var(--accent-light)',
      filter: 'my_tasks' as const,
    },
    {
      label: 'Due Today',
      value: stats.dueToday,
      icon: Calendar,
      color: 'var(--warning)',
      bgColor: 'var(--warning-light)',
      filter: 'due_today' as const,
    },
    {
      label: 'Overdue',
      value: stats.overdue,
      icon: AlertTriangle,
      color: 'var(--danger)',
      bgColor: 'var(--danger-light)',
      filter: 'overdue' as const,
    },
    {
      label: 'In Progress',
      value: stats.inProgress,
      icon: Zap,
      color: 'var(--brand-sky)',
      bgColor: 'var(--brand-sky)/10',
      filter: 'all' as const,
    },
  ];

  return (
    <aside
      className={`
        w-[280px] flex-shrink-0 h-full overflow-y-auto
        border-r
        ${darkMode
          ? 'bg-[var(--surface)] border-white/10'
          : 'bg-[var(--surface)] border-[var(--border)]'
        }
      `}
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-base">A</span>
          </div>
          <div>
            <h1 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
              Academic Projects
            </h1>
            <p className={`text-xs ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}`}>
              {format(new Date(), 'EEEE, MMM d')}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            const isClickable = onFilterChange && stat.value > 0;

            return (
              <button
                key={stat.label}
                onClick={() => isClickable && onFilterChange(stat.filter)}
                disabled={!isClickable}
                className={`
                  p-3 rounded-xl text-left transition-all
                  ${isClickable ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}
                  ${darkMode
                    ? 'bg-white/5 hover:bg-white/10'
                    : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: stat.bgColor }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                  </div>
                </div>
                <div
                  className="text-xl font-bold"
                  style={{ color: stat.value > 0 ? stat.color : 'var(--text-muted)' }}
                >
                  {stat.value}
                </div>
                <div className={`text-xs ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}`}>
                  {stat.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress Ring */}
      <div className="px-4 pb-4">
        <div
          className={`
            p-4 rounded-xl
            ${darkMode ? 'bg-white/5' : 'bg-[var(--surface-2)]'}
          `}
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
              Overall Progress
            </span>
            <span className="text-sm font-bold text-[var(--success)]">
              {stats.completionRate}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.completionRate}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-[var(--success)] to-[var(--brand-sky)]"
            />
          </div>
          <div className={`flex justify-between mt-2 text-xs ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
            <span>{stats.completed} completed</span>
            <span>{stats.active} remaining</span>
          </div>
        </div>
      </div>

      {/* Week Stats */}
      <div className="px-4 pb-4">
        <div
          className={`
            p-4 rounded-xl flex items-center gap-3
            ${darkMode ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20' : 'bg-gradient-to-r from-orange-50 to-red-50'}
          `}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
              {stats.completedThisWeek}
            </div>
            <div className={`text-xs ${darkMode ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>
              Completed this week
            </div>
          </div>
        </div>
      </div>

      {/* Urgent Tasks */}
      {urgentTasks.length > 0 && (
        <div className="px-4 pb-4">
          <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
            Needs Attention
          </h3>
          <div className="space-y-2">
            {urgentTasks.map((task) => (
              <div
                key={task.id}
                className={`
                  p-3 rounded-xl text-sm
                  ${darkMode ? 'bg-white/5' : 'bg-[var(--surface-2)]'}
                `}
              >
                <div className={`font-medium truncate ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                  {task.text}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {task.priority === 'urgent' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--danger)] text-white">
                      Urgent
                    </span>
                  )}
                  {task.due_date && (
                    <span className={`text-xs ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}`}>
                      {format(new Date(task.due_date), 'MMM d')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <div className="px-4 pb-4 mt-auto">
        <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
          Quick Access
        </h3>
        <div className="space-y-1">
          <button
            onClick={() => onNavigate?.('dashboard')}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
              transition-colors text-left
              ${darkMode
                ? 'text-white/70 hover:text-white hover:bg-white/10'
                : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
              }
            `}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
            <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
          </button>

          <button
            onClick={() => onNavigate?.('activity')}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
              transition-colors text-left
              ${darkMode
                ? 'text-white/70 hover:text-white hover:bg-white/10'
                : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
              }
            `}
          >
            <Activity className="w-4 h-4" />
            Activity Feed
            <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
          </button>

          {isOwner && (
            <button
              onClick={() => onNavigate?.('goals')}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-colors text-left
                ${darkMode
                  ? 'text-white/70 hover:text-white hover:bg-white/10'
                  : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                }
              `}
            >
              <Target className="w-4 h-4" />
              Strategic Goals
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
