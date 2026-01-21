'use client';

import { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  Sunrise,
} from 'lucide-react';
import { Todo, AuthUser, ActivityLogEntry } from '@/types/todo';
import { useTheme } from '@/contexts/ThemeContext';
import DoerDashboard from '../dashboard/DoerDashboard';
import ManagerDashboard from '../dashboard/ManagerDashboard';
import DailyDigestPanel from '../dashboard/DailyDigestPanel';

interface DashboardPageProps {
  currentUser: AuthUser;
  todos: Todo[];
  activityLog?: ActivityLogEntry[];
  users?: string[];
  onNavigateToTasks?: () => void;
  onTaskClick?: (taskId: string) => void;
  onFilterOverdue?: () => void;
  onFilterDueToday?: () => void;
}

export default function DashboardPage({
  currentUser,
  todos,
  activityLog = [],
  users = [],
  onNavigateToTasks,
  onTaskClick,
  onFilterOverdue,
  onFilterDueToday,
}: DashboardPageProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const [currentTime, setCurrentTime] = useState(new Date());

  // Check if user has team members (is a manager)
  const isManager = users.length > 1;

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: 'Good morning', Icon: Sunrise };
    if (hour < 17) return { text: 'Good afternoon', Icon: Sun };
    return { text: 'Good evening', Icon: Moon };
  };

  const greeting = getGreeting();

  // Calculate stats for header
  const stats = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const activeTodos = todos.filter(t => !t.completed);

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

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcoming = activeTodos.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate > todayEnd && dueDate <= nextWeek;
    });

    return {
      totalActive: activeTodos.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      upcoming: upcoming.length,
    };
  })();

  return (
    <div className={`min-h-full ${darkMode ? 'bg-[var(--background)]' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: darkMode
              ? 'linear-gradient(135deg, #0A1628 0%, #0033A0 50%, #1E3A5F 100%)'
              : 'linear-gradient(135deg, #0033A0 0%, #0047CC 50%, #1E3A5F 100%)',
          }}
        />
        <div className="relative px-6 py-8 max-w-7xl mx-auto">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <greeting.Icon className="w-5 h-5 text-white/80" />
              <span className="text-white/80 text-sm font-medium">{greeting.text}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
              {currentUser.name}
            </h1>
            <p className="text-white/80 text-sm">
              {isManager ? `${users.length} team members · ` : ''}{stats.totalActive} active tasks
            </p>
          </div>

          {/* Quick Stats Row - Enhanced urgency hierarchy */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {/* Overdue - Most Critical */}
            <button
              onClick={onFilterOverdue}
              aria-label={`View ${stats.overdue} overdue task${stats.overdue !== 1 ? 's' : ''}`}
              className={`p-4 rounded-xl text-left transition-all duration-200 min-h-[92px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0033A0] ${
                stats.overdue > 0
                  ? 'bg-gradient-to-br from-red-500/25 to-red-500/10 hover:from-red-500/30 hover:to-red-500/15 border-2 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                  : 'bg-white/10 hover:bg-white/15 border border-white/10'
              }`}
            >
              <p className={`text-3xl font-bold tabular-nums ${
                stats.overdue > 0 ? 'text-red-400' : 'text-white'
              }`}>
                {stats.overdue}
              </p>
              <p className="text-white/80 text-xs mt-1 font-medium tracking-wide uppercase">
                Overdue
              </p>
            </button>

            {/* Due Today - High Priority */}
            <button
              onClick={onFilterDueToday}
              aria-label={`View ${stats.dueToday} task${stats.dueToday !== 1 ? 's' : ''} due today`}
              className={`p-4 rounded-xl text-left transition-all duration-200 min-h-[92px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0033A0] ${
                stats.dueToday > 0
                  ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 hover:from-amber-500/25 hover:to-amber-500/10 border border-amber-500/30'
                  : 'bg-white/10 hover:bg-white/15 border border-white/10'
              }`}
            >
              <p className={`text-3xl font-bold tabular-nums ${
                stats.dueToday > 0 ? 'text-amber-400' : 'text-white'
              }`}>
                {stats.dueToday}
              </p>
              <p className="text-white/80 text-xs mt-1 font-medium tracking-wide uppercase">
                Due Today
              </p>
            </button>

            {/* Due This Week - Informational */}
            <div className="p-4 rounded-xl text-left bg-white/8 border border-white/10 min-h-[92px]" role="status" aria-label={`${stats.upcoming} tasks due this week`}>
              <p className="text-3xl font-bold text-white tabular-nums">
                {stats.upcoming}
              </p>
              <p className="text-white/80 text-xs mt-1 font-medium tracking-wide uppercase">
                This Week
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Daily Digest Panel - auto-loads AI briefing */}
        <DailyDigestPanel
          currentUser={currentUser}
          onFilterOverdue={onFilterOverdue}
          onFilterDueToday={onFilterDueToday}
          defaultExpanded={true}
        />

        {/* Role-based dashboard */}
        {isManager ? (
          <ManagerDashboard
            currentUser={currentUser}
            todos={todos}
            activityLog={activityLog}
            users={users}
            onNavigateToTasks={onNavigateToTasks}
            onTaskClick={onTaskClick}
            onFilterOverdue={onFilterOverdue}
            onFilterDueToday={onFilterDueToday}
          />
        ) : (
          <DoerDashboard
            currentUser={currentUser}
            todos={todos}
            activityLog={activityLog}
            onNavigateToTasks={onNavigateToTasks}
            onTaskClick={onTaskClick}
            onFilterOverdue={onFilterOverdue}
            onFilterDueToday={onFilterDueToday}
          />
        )}
      </div>
    </div>
  );
}
