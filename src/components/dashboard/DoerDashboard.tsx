'use client';

import { useMemo, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Target,
  Brain,
  Clock,
  TrendingUp,
  Calendar,
  Zap,
} from 'lucide-react';
import { Todo, AuthUser, ActivityLogEntry } from '@/types/todo';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppShell } from '../layout';
import {
  generateDashboardAIData,
  NeglectedTask,
} from '@/lib/aiDashboardInsights';

interface DoerDashboardProps {
  currentUser: AuthUser;
  todos: Todo[];
  activityLog?: ActivityLogEntry[];
  onNavigateToTasks?: () => void;
  onTaskClick?: (taskId: string) => void;
  onFilterOverdue?: () => void;
  onFilterDueToday?: () => void;
}

export default function DoerDashboard({
  currentUser,
  todos,
  activityLog = [],
  onNavigateToTasks,
  onTaskClick,
  onFilterOverdue,
  onFilterDueToday,
}: DoerDashboardProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const { setActiveView } = useAppShell();
  const prefersReducedMotion = useReducedMotion();

  // Filter to only MY tasks
  const myTodos = useMemo(() => {
    return todos.filter(t =>
      t.assigned_to === currentUser.name ||
      (!t.assigned_to && t.created_by === currentUser.name)
    );
  }, [todos, currentUser.name]);

  // Generate AI insights for MY tasks only
  const aiData = useMemo(() => {
    return generateDashboardAIData(myTodos, activityLog, currentUser.name);
  }, [myTodos, activityLog, currentUser.name]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const activeTodos = myTodos.filter(t => !t.completed);
    const completedTodos = myTodos.filter(t => t.completed);

    const overdue = activeTodos.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      dueDate.setHours(23, 59, 59, 999);
      return dueDate < today;
    });

    const dueToday = activeTodos.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= today && dueDate <= todayEnd;
    });

    const highPriority = activeTodos.filter(t =>
      t.priority === 'urgent' || t.priority === 'high'
    );

    // Next 7 days (excluding today)
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcoming = activeTodos
      .filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);
        return dueDate > todayEnd && dueDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.due_date || '').getTime() - new Date(b.due_date || '').getTime());

    // Weekly completion data
    const currentDay = today.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);

    let weeklyCompleted = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      weeklyCompleted += completedTodos.filter(t => {
        if (!t.completed) return false;
        if (!t.updated_at && !t.created_at) return false;
        const updatedAt = t.updated_at ? new Date(t.updated_at) : new Date(t.created_at);
        return updatedAt >= date && updatedAt <= dateEnd;
      }).length;
    }

    const weeklyTotal = Math.max(weeklyCompleted + activeTodos.length, 1);
    const weeklyRatio = Math.round((weeklyCompleted / weeklyTotal) * 100);

    return {
      totalActive: activeTodos.length,
      totalCompleted: completedTodos.length,
      overdue: overdue.length,
      overdueList: overdue,
      dueToday: dueToday.length,
      dueTodayTasks: dueToday,
      highPriority: highPriority.length,
      highPriorityTasks: highPriority,
      upcoming: upcoming.length,
      upcomingTasks: upcoming,
      weeklyCompleted,
      weeklyTotal,
      weeklyRatio,
    };
  }, [myTodos]);

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleNavigateToTasks = useCallback(() => {
    if (onNavigateToTasks) {
      onNavigateToTasks();
    } else {
      setActiveView('tasks');
    }
  }, [onNavigateToTasks, setActiveView]);

  const handleTaskClick = useCallback((taskId: string) => {
    if (onTaskClick) {
      onTaskClick(taskId);
    } else {
      // Fallback to just navigating to tasks view
      handleNavigateToTasks();
    }
  }, [onTaskClick, handleNavigateToTasks]);

  const handleFilterOverdue = useCallback(() => {
    if (onFilterOverdue) {
      onFilterOverdue();
    } else {
      setActiveView('tasks');
    }
  }, [onFilterOverdue, setActiveView]);

  const handleFilterDueToday = useCallback(() => {
    if (onFilterDueToday) {
      onFilterDueToday();
    } else {
      setActiveView('tasks');
    }
  }, [onFilterDueToday, setActiveView]);

  const getUrgencyBadge = (urgency: NeglectedTask['urgencyLevel']) => {
    switch (urgency) {
      case 'critical': return { bg: 'bg-red-500', text: 'text-white', label: 'CRITICAL' };
      case 'warning': return { bg: 'bg-amber-500', text: 'text-white', label: 'STALLED' };
      case 'notice': return { bg: 'bg-blue-500', text: 'text-white', label: 'NEEDS ATTENTION' };
    }
  };

  // Enhanced Card component with proper elevation system and accessibility
  const Card = ({
    children,
    className = '',
    hoverable = false,
    onClick,
    ariaLabel
  }: {
    children: React.ReactNode;
    className?: string;
    hoverable?: boolean;
    onClick?: () => void;
    ariaLabel?: string;
  }) => (
    <div
      className={`rounded-2xl p-5 transition-all duration-200 ${
        darkMode
          ? 'bg-[#162236] border border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.25)]'
          : 'bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]'
      } ${hoverable ? (
        darkMode
          ? 'hover:bg-[#1A2840] hover:border-white/[0.12] hover:shadow-[0_4px_20px_rgba(0,0,0,0.35)] cursor-pointer'
          : 'hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-slate-300 cursor-pointer'
      ) : ''} ${onClick ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0033A0] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0A1628]' : ''} ${className}`}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );

  // Enhanced SectionTitle with icon container and better hierarchy
  const SectionTitle = ({
    icon: Icon,
    title,
    badge,
    action
  }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    badge?: number;
    action?: { label: string; onClick: () => void };
  }) => (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          darkMode
            ? 'bg-[var(--accent)]/15'
            : 'bg-[#0033A0]/8'
        }`}>
          <Icon className={`w-4 h-4 ${
            darkMode ? 'text-[var(--accent)]' : 'text-[#0033A0]'
          }`} />
        </div>
        <h2 className={`text-sm font-semibold ${
          darkMode ? 'text-white/90' : 'text-slate-700'
        }`}>
          {title}
        </h2>
        {badge !== undefined && badge > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500 text-white min-w-[20px] text-center">
            {badge}
          </span>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className={`text-xs font-medium px-3 py-2 -my-1 rounded-lg min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0033A0] focus-visible:ring-offset-2 ${
            darkMode ? 'text-[#72B5E8] hover:text-[#9DC8F0] hover:bg-white/5 focus-visible:ring-offset-[#162236]' : 'text-[#0033A0] hover:text-[#0047CC] hover:bg-slate-50 focus-visible:ring-offset-white'
          }`}
        >
          {action.label}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Critical Alerts - Overdue tasks get top billing */}
      {stats.overdue > 0 && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={handleFilterOverdue}
            aria-label={`View ${stats.overdue} overdue task${stats.overdue > 1 ? 's' : ''}`}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
              darkMode
                ? 'bg-red-500/15 hover:bg-red-500/20 border border-red-500/30 focus-visible:ring-offset-[#0A1628]'
                : 'bg-red-50 hover:bg-red-100 border border-red-200 focus-visible:ring-offset-white'
            }`}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/20">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1 text-left">
              <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                {stats.overdue} task{stats.overdue > 1 ? 's' : ''} overdue
              </p>
              <p className={`text-sm ${darkMode ? 'text-white/80' : 'text-slate-600'}`}>
                Click to view and resolve
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-red-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>
        </motion.div>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Left Column - Today's Focus */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <SectionTitle icon={Target} title="Your Day" />

            {/* AI Focus Suggestion */}
            {aiData.todaysFocus && (
              <div className={`flex items-start gap-3 p-3 rounded-xl mb-4 ${
                darkMode ? 'bg-[#0033A0]/20 border border-[#0033A0]/30' : 'bg-blue-50 border border-blue-200'
              }`}>
                <Brain className={`w-4 h-4 mt-0.5 flex-shrink-0 ${darkMode ? 'text-[#72B5E8]' : 'text-[#0033A0]'}`} />
                <p className={`text-sm ${darkMode ? 'text-[#72B5E8]' : 'text-[#0033A0]'}`}>
                  {aiData.todaysFocus}
                </p>
              </div>
            )}

            {/* Due Today - Enhanced with micro-interactions */}
            {stats.dueToday > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>
                    Due Today
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${
                    darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {stats.dueToday}
                  </span>
                </div>
                {stats.dueTodayTasks.slice(0, 5).map((task, index) => (
                  <motion.button
                    key={task.id}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.05 }}
                    onClick={() => handleTaskClick(task.id)}
                    aria-label={`Open task: ${task.text}`}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0033A0] focus-visible:ring-offset-2 ${
                      darkMode
                        ? 'hover:bg-white/[0.06] active:bg-white/[0.08] active:scale-[0.98] focus-visible:ring-offset-[#162236]'
                        : 'hover:bg-slate-50 active:bg-slate-100 active:scale-[0.98] focus-visible:ring-offset-white'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 transition-transform group-hover:scale-110 ${
                      task.priority === 'urgent'
                        ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                        : task.priority === 'high'
                          ? 'bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.4)]'
                          : 'bg-[#0047CC]'
                    }`} />
                    <span className={`flex-1 text-sm font-medium truncate ${darkMode ? 'text-white/90' : 'text-slate-800'}`}>
                      {task.text}
                    </span>
                    {task.priority === 'urgent' && (
                      <Zap className="w-4 h-4 text-red-500 flex-shrink-0 animate-pulse" />
                    )}
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-all group-hover:translate-x-0.5 ${
                      darkMode ? 'text-white' : 'text-slate-400'
                    }`} />
                  </motion.button>
                ))}
                {stats.dueToday > 5 && (
                  <button
                    onClick={handleFilterDueToday}
                    className={`w-full text-center py-2 mt-1 text-xs font-medium min-h-[44px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0033A0] focus-visible:ring-offset-2 ${
                      darkMode ? 'text-[#72B5E8] hover:text-[#9DC8F0] focus-visible:ring-offset-[#162236]' : 'text-[#0033A0] hover:text-[#0047CC] focus-visible:ring-offset-white'
                    } hover:underline`}
                  >
                    +{stats.dueToday - 5} more due today
                  </button>
                )}
              </div>
            ) : (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center gap-3 py-4 px-4 rounded-xl ${
                  darkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200/50'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <span className={`text-sm font-medium ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  No tasks due today — you're ahead of schedule!
                </span>
              </motion.div>
            )}

            {/* Upcoming Tasks */}
            {stats.upcoming > 0 && (
              <div className="mt-5 pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-white/50' : 'text-slate-400'}`}>
                    Coming Up
                  </span>
                  <Calendar className={`w-4 h-4 ${darkMode ? 'text-white/30' : 'text-slate-300'}`} />
                </div>
                <div className="space-y-1">
                  {stats.upcomingTasks.slice(0, 4).map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskClick(task.id)}
                      aria-label={`Open upcoming task: ${task.text}`}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0033A0] focus-visible:ring-offset-2 ${
                        darkMode ? 'hover:bg-white/5 focus-visible:ring-offset-[#162236]' : 'hover:bg-slate-50 focus-visible:ring-offset-white'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        task.priority === 'urgent' ? 'bg-red-500' :
                        task.priority === 'high' ? 'bg-orange-500' :
                        'bg-slate-300 dark:bg-slate-600'
                      }`} />
                      <span className={`flex-1 text-sm truncate ${darkMode ? 'text-white/80' : 'text-slate-700'}`}>
                        {task.text}
                      </span>
                      <span className={`text-xs flex-shrink-0 ${darkMode ? 'text-white/40' : 'text-slate-400'}`}>
                        {task.due_date && formatDueDate(task.due_date)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Stalled/Neglected Tasks - Enhanced */}
          {aiData.neglectedTasks.length > 0 && (
            <Card>
              <SectionTitle icon={Clock} title="Needs Your Attention" badge={aiData.neglectedTasks.length} />
              <div className="space-y-2">
                {aiData.neglectedTasks.slice(0, 4).map((item, index) => {
                  const badge = getUrgencyBadge(item.urgencyLevel);
                  return (
                    <motion.button
                      key={item.todo.id}
                      initial={prefersReducedMotion ? false : { opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.05 }}
                      aria-label={`Open neglected task: ${item.todo.text}, ${item.daysSinceActivity} days without activity`}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 group min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0033A0] focus-visible:ring-offset-2 ${
                        item.urgencyLevel === 'critical'
                          ? darkMode ? 'bg-red-500/10 hover:bg-red-500/15 border-l-4 border-l-red-500 focus-visible:ring-offset-[#162236]' : 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500 focus-visible:ring-offset-white'
                          : darkMode ? 'bg-white/5 hover:bg-white/10 focus-visible:ring-offset-[#162236]' : 'bg-slate-50 hover:bg-slate-100 focus-visible:ring-offset-white'
                      } active:scale-[0.98]`}
                      onClick={() => handleTaskClick(item.todo.id)}
                    >
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold tabular-nums ${badge.bg} ${badge.text}`}>
                        {item.daysSinceActivity}d
                      </span>
                      <span className={`flex-1 truncate text-sm font-medium ${darkMode ? 'text-white/90' : 'text-slate-800'}`}>
                        {item.todo.text}
                      </span>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-all group-hover:translate-x-0.5 ${darkMode ? 'text-white' : 'text-slate-400'}`} />
                    </motion.button>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Progress & Stats */}
        <div className="space-y-6">
          {/* Weekly Progress - Enhanced */}
          <Card>
            <SectionTitle icon={TrendingUp} title="Your Progress" />
            <div className="space-y-4">
              <div className="text-center">
                <motion.div
                  initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                  className={`text-5xl font-bold tabular-nums ${darkMode ? 'text-white' : 'text-slate-900'}`}
                >
                  {stats.weeklyCompleted}
                </motion.div>
                <p className={`text-sm mt-1 ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>
                  completed this week
                </p>
              </div>

              {/* Enhanced Progress Bar */}
              <div className="relative">
                <div className={`h-4 rounded-full overflow-hidden ${darkMode ? 'bg-white/[0.08]' : 'bg-slate-100'}`}>
                  <motion.div
                    initial={prefersReducedMotion ? false : { width: 0 }}
                    animate={{ width: `${Math.min(stats.weeklyRatio, 100)}%` }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
                    className="h-full rounded-full relative overflow-hidden"
                    style={{
                      background: stats.weeklyRatio >= 80
                        ? 'linear-gradient(90deg, #059669 0%, #10B981 100%)'
                        : stats.weeklyRatio >= 50
                          ? 'linear-gradient(90deg, #0033A0 0%, #0047CC 100%)'
                          : 'linear-gradient(90deg, #0033A0 0%, #72B5E8 100%)'
                    }}
                  >
                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 opacity-30">
                      <div
                        className="absolute inset-0 -translate-x-full"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                          animation: 'shimmer 2s infinite'
                        }}
                      />
                    </div>
                  </motion.div>
                </div>
              </div>

              <p className={`text-xs text-center font-medium tabular-nums ${darkMode ? 'text-white/50' : 'text-slate-400'}`}>
                {stats.weeklyRatio}% of weekly workload done
              </p>
            </div>
          </Card>

          {/* Quick Stats - Enhanced */}
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <div className={`text-center p-4 rounded-xl transition-colors ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                <p className={`text-2xl font-bold tabular-nums ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {stats.totalActive}
                </p>
                <p className={`text-[10px] uppercase font-medium tracking-wide ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>Active Tasks</p>
              </div>
              <div className={`text-center p-4 rounded-xl transition-colors ${
                stats.highPriority > 0
                  ? darkMode ? 'bg-orange-500/15 border border-orange-500/20' : 'bg-orange-50 border border-orange-200/50'
                  : darkMode ? 'bg-white/5' : 'bg-slate-50'
              }`}>
                <p className={`text-2xl font-bold tabular-nums ${stats.highPriority > 0 ? 'text-orange-500' : darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {stats.highPriority}
                </p>
                <p className={`text-[10px] uppercase font-medium tracking-wide ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>High Priority</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
