'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  ChevronRight,
  Sun,
  Moon,
  Sunrise,
  Clock,
  X,
} from 'lucide-react';
import { Todo, AuthUser } from '@/types/todo';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  todos: Todo[];
  currentUser: AuthUser;
  onNavigateToTasks: () => void;
  onAddTask: () => void;
  onFilterOverdue: () => void;
  onFilterDueToday: () => void;
  darkMode?: boolean;
}

interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  completed: number;
  isToday: boolean;
}

interface UpcomingTask {
  id: string;
  text: string;
  due_date: string;
  priority: string;
}

const DAILY_VISIT_KEY = 'bealer-last-dashboard-visit';

export function shouldShowDailyDashboard(): boolean {
  if (typeof window === 'undefined') return false;

  const lastVisit = localStorage.getItem(DAILY_VISIT_KEY);
  if (!lastVisit) return true;

  const lastVisitDate = new Date(lastVisit);
  const today = new Date();

  // Check if it's a different day
  return lastVisitDate.toDateString() !== today.toDateString();
}

export function markDailyDashboardShown(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DAILY_VISIT_KEY, new Date().toISOString());
}

export default function DashboardModal({
  isOpen,
  onClose,
  todos,
  currentUser,
  onNavigateToTasks,
  onAddTask,
  onFilterOverdue,
  onFilterDueToday,
  darkMode = true,
}: DashboardModalProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Mark as shown when modal opens
  useEffect(() => {
    if (isOpen) {
      markDailyDashboardShown();
    }
  }, [isOpen]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const activeTodos = todos.filter(t => !t.completed);
    const completedTodos = todos.filter(t => t.completed);

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

    // Next 7 days (excluding today)
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcoming = activeTodos
      .filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);
        return dueDate > todayEnd && dueDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

    const nextTask: UpcomingTask | null = upcoming.length > 0
      ? {
          id: upcoming[0].id,
          text: upcoming[0].text,
          due_date: upcoming[0].due_date!,
          priority: upcoming[0].priority || 'medium',
        }
      : null;

    // Weekly completion data
    const weekData: WeekDay[] = [];
    const currentDay = today.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);

    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      const completed = completedTodos.filter(t => {
        if (!t.completed) return false;
        const updatedAt = t.updated_at ? new Date(t.updated_at) : new Date(t.created_at);
        return updatedAt >= date && updatedAt <= dateEnd;
      }).length;

      weekData.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        completed,
        isToday: date.toDateString() === today.toDateString(),
      });
    }

    const weeklyCompleted = weekData.reduce((sum, d) => sum + d.completed, 0);
    const maxDaily = Math.max(...weekData.map(d => d.completed), 1);
    const weeklyTotal = Math.max(weeklyCompleted + activeTodos.length, 1);
    const weeklyRatio = Math.round((weeklyCompleted / weeklyTotal) * 100);

    return {
      overdue: overdue.length,
      dueToday: dueToday.length,
      dueTodayTasks: dueToday,
      nextTask,
      weekData,
      weeklyCompleted,
      weeklyTotal,
      weeklyRatio,
      maxDaily,
    };
  }, [todos]);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: 'Good morning', Icon: Sunrise };
    if (hour < 17) return { text: 'Good afternoon', Icon: Sun };
    return { text: 'Good evening', Icon: Moon };
  };

  const greeting = getGreeting();

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleAction = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 sm:w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
          >
            <div className={`${darkMode ? 'bg-[#0A1628]' : 'bg-white'}`}>
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

                <div className="relative px-5 py-6">
                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Greeting */}
                  <div className="flex items-center gap-2 mb-1">
                    <greeting.Icon className="w-4 h-4 text-white/60" />
                    <span className="text-white/60 text-sm font-medium">{greeting.text}</span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
                    {currentUser.name}
                  </h1>

                  <p className="text-white/70 text-sm">
                    {stats.weeklyCompleted} completed this week
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className={`px-5 py-5 space-y-4 ${darkMode ? 'bg-[#0A1628]' : 'bg-slate-50'}`}>
                {/* Overdue Alert */}
                {stats.overdue > 0 && (
                  <motion.button
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleAction(onFilterOverdue)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0033A0] text-white hover:bg-[#002580] transition-colors group"
                  >
                    <AlertTriangle className="w-5 h-5" />
                    <div className="flex-1 text-left">
                      <span className="font-semibold">{stats.overdue} overdue</span>
                      <span className="text-white/70 text-sm ml-2">need attention</span>
                    </div>
                    <ArrowRight className="w-4 h-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </motion.button>
                )}

                {/* Today's Tasks */}
                <div className={`rounded-xl p-4 ${
                  darkMode
                    ? 'bg-[#1E293B] border border-[#334155]'
                    : 'bg-white border border-slate-200'
                }`}>
                  <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    Today
                  </h3>

                  {stats.dueToday > 0 ? (
                    <div className="space-y-2">
                      {stats.dueTodayTasks.slice(0, 3).map((task) => (
                        <button
                          key={task.id}
                          onClick={() => handleAction(onFilterDueToday)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            darkMode
                              ? 'hover:bg-slate-700/50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            task.priority === 'urgent' ? 'bg-red-500' :
                            task.priority === 'high' ? 'bg-orange-500' :
                            'bg-[#0033A0]'
                          }`} />
                          <span className={`flex-1 text-sm font-medium truncate ${
                            darkMode ? 'text-white' : 'text-slate-900'
                          }`}>
                            {task.text}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </button>
                      ))}
                      {stats.dueToday > 3 && (
                        <button
                          onClick={() => handleAction(onFilterDueToday)}
                          className={`w-full text-center py-2 text-sm font-medium ${
                            darkMode ? 'text-[#72B5E8]' : 'text-[#0033A0]'
                          } hover:underline`}
                        >
                          +{stats.dueToday - 3} more
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-1">
                      <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                      <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        No tasks due today
                      </span>
                    </div>
                  )}
                </div>

                {/* Next Up */}
                {stats.nextTask && (
                  <div className={`rounded-xl p-4 ${
                    darkMode
                      ? 'bg-[#1E293B] border border-[#334155]'
                      : 'bg-white border border-slate-200'
                  }`}>
                    <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${
                      darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Next Up
                    </h3>

                    <button
                      onClick={() => handleAction(onNavigateToTasks)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        darkMode
                          ? 'hover:bg-slate-700/50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                        stats.nextTask.priority === 'urgent' ? 'bg-red-500' :
                        stats.nextTask.priority === 'high' ? 'bg-orange-500' :
                        'bg-[#0033A0]'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          darkMode ? 'text-white' : 'text-slate-900'
                        }`}>
                          {stats.nextTask.text}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {formatDueDate(stats.nextTask.due_date)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                    </button>
                  </div>
                )}

                {/* Weekly Progress (compact) */}
                <div className={`rounded-xl p-4 ${
                  darkMode
                    ? 'bg-[#1E293B] border border-[#334155]'
                    : 'bg-white border border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-xs font-semibold uppercase tracking-wide ${
                      darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      This Week
                    </h3>
                    <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {stats.weeklyCompleted}/{stats.weeklyTotal} ({stats.weeklyRatio}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className={`h-2 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.weeklyRatio}%` }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className={`h-full rounded-full ${
                        stats.weeklyRatio >= 50 ? 'bg-[#10B981]' :
                        stats.weeklyRatio >= 25 ? 'bg-[#F59E0B]' :
                        'bg-[#0033A0]'
                      }`}
                    />
                  </div>

                  {/* Mini chart */}
                  <div className="flex items-end justify-between gap-2 mt-4 h-12">
                    {stats.weekData.map((day, index) => {
                      const height = stats.maxDaily > 0 ? (day.completed / stats.maxDaily) * 100 : 0;
                      return (
                        <div
                          key={day.dayName}
                          className="flex-1 flex flex-col items-center gap-1"
                        >
                          <div className="w-full flex-1 flex flex-col justify-end min-h-[16px]">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(height, 10)}%` }}
                              transition={{ delay: 0.3 + index * 0.05, duration: 0.3 }}
                              className={`w-full rounded-sm ${
                                day.isToday
                                  ? 'bg-[#0033A0]'
                                  : day.completed > 0
                                    ? darkMode ? 'bg-[#0033A0]/40' : 'bg-[#0033A0]/20'
                                    : darkMode ? 'bg-slate-700' : 'bg-slate-100'
                              }`}
                            />
                          </div>
                          <span className={`text-[10px] ${
                            day.isToday
                              ? 'text-[#0033A0] font-semibold'
                              : darkMode ? 'text-slate-500' : 'text-slate-400'
                          }`}>
                            {day.dayName.charAt(0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleAction(onNavigateToTasks)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl font-semibold transition-colors ${
                      darkMode
                        ? 'bg-slate-700 text-white hover:bg-slate-600'
                        : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">View Tasks</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleAction(onAddTask)}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#0033A0] text-white font-semibold hover:bg-[#0028A0] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Add Task</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
