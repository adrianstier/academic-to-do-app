'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Calendar,
  ArrowRight,
  Plus,
  Flame,
  Clock,
  ChevronRight,
  Sun,
  Moon,
  Sunrise,
  BarChart3,
  ListTodo,
} from 'lucide-react';
import { Todo, AuthUser } from '@/types/todo';

interface DashboardProps {
  todos: Todo[];
  currentUser: AuthUser;
  users: string[];
  onNavigateToTasks: () => void;
  onAddTask: () => void;
  onFilterOverdue: () => void;
  onFilterDueToday: () => void;
  onFilterMyTasks: () => void;
  darkMode?: boolean;
}

interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  completed: number;
  isToday: boolean;
}

export default function Dashboard({
  todos,
  currentUser,
  users,
  onNavigateToTasks,
  onAddTask,
  onFilterOverdue,
  onFilterDueToday,
  onFilterMyTasks,
  darkMode = false,
}: DashboardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const activeTodos = todos.filter(t => !t.completed);
    const completedTodos = todos.filter(t => t.completed);

    const myTasks = activeTodos.filter(t => t.assigned_to === currentUser.name);

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

    // Upcoming (next 7 days, excluding today)
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcoming = activeTodos.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate > todayEnd && dueDate <= nextWeek;
    });

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

    return {
      total: todos.length,
      active: activeTodos.length,
      completed: completedTodos.length,
      myTasks: myTasks.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      upcoming: upcoming.length,
      weekData,
      weeklyCompleted,
      maxDaily,
      completionRate: todos.length > 0 ? Math.round((completedTodos.length / todos.length) * 100) : 0,
    };
  }, [todos, currentUser.name]);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: 'Good morning', Icon: Sunrise };
    if (hour < 17) return { text: 'Good afternoon', Icon: Sun };
    return { text: 'Good evening', Icon: Moon };
  };

  const greeting = getGreeting();

  // Determine what the hero message should be
  const getHeroMessage = () => {
    if (stats.dueToday > 0) {
      return {
        number: stats.dueToday,
        label: stats.dueToday === 1 ? 'task due today' : 'tasks due today',
        action: onFilterDueToday,
        color: 'text-[#0033A0]',
      };
    }
    if (stats.myTasks > 0) {
      return {
        number: stats.myTasks,
        label: stats.myTasks === 1 ? 'task assigned to you' : 'tasks assigned to you',
        action: onFilterMyTasks,
        color: 'text-[#0033A0]',
      };
    }
    return null;
  };

  const heroMessage = getHeroMessage();

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#0A1628]' : 'bg-slate-50'}`}>
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

        <div className="relative max-w-4xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          {/* Greeting row */}
          <div className="flex items-center gap-2 mb-1">
            <greeting.Icon className="w-4 h-4 text-white/60" />
            <span className="text-white/60 text-sm font-medium">{greeting.text}</span>
          </div>

          {/* Name */}
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
            {currentUser.name}
          </h1>

          {/* Hero stat - what needs doing NOW */}
          {heroMessage ? (
            <button
              onClick={heroMessage.action}
              className="group flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/20 hover:bg-white/15 transition-colors"
            >
              <span className="text-3xl font-bold text-white">{heroMessage.number}</span>
              <span className="text-white/80 text-sm">{heroMessage.label}</span>
              <ChevronRight className="w-4 h-4 text-white/60 group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <div className="flex items-center gap-2 text-white/80">
              <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
              <span className="text-sm font-medium">You're all caught up</span>
            </div>
          )}

          {/* Quick badges */}
          <div className="flex flex-wrap gap-3 mt-6">
            <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 border border-white/10">
              <Flame className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-white/90 text-sm font-medium">
                {currentUser.streak_count || 0} day streak
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              <span className="text-white/90 text-sm font-medium">
                {stats.weeklyCompleted} done this week
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-5 sm:px-6 py-6 space-y-5">
        {/* Overdue Alert Bar - only shows if there are overdue tasks */}
        {stats.overdue > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onFilterOverdue}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] hover:bg-[#FEE2E2] transition-colors group"
          >
            <div className="w-2 h-10 bg-[#EF4444] rounded-full" />
            <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            <div className="flex-1 text-left">
              <span className="text-[#991B1B] font-semibold">{stats.overdue} overdue</span>
              <span className="text-[#B91C1C]/70 text-sm ml-2">needs attention</span>
            </div>
            <span className="text-[#EF4444] text-sm font-medium group-hover:underline">
              View overdue →
            </span>
          </motion.button>
        )}

        {/* Unified Task Breakdown Card */}
        <div className={`rounded-2xl p-5 ${
          darkMode
            ? 'bg-[#1E293B] border border-[#334155]'
            : 'bg-white border border-slate-200'
        }`}>
          <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${
            darkMode ? 'text-slate-400' : 'text-slate-500'
          }`}>
            Task Overview
          </h3>

          <div className="space-y-1">
            {/* Today */}
            <button
              onClick={onFilterDueToday}
              disabled={stats.dueToday === 0}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                stats.dueToday > 0
                  ? darkMode
                    ? 'hover:bg-slate-700/50'
                    : 'hover:bg-slate-50'
                  : 'opacity-50 cursor-default'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  darkMode ? 'bg-[#0033A0]/20' : 'bg-[#0033A0]/10'
                }`}>
                  <Calendar className="w-5 h-5 text-[#0033A0]" />
                </div>
                <div className="text-left">
                  <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Today</p>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Due by end of day</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${
                  stats.dueToday > 0
                    ? 'text-[#0033A0]'
                    : darkMode ? 'text-slate-500' : 'text-slate-300'
                }`}>
                  {stats.dueToday}
                </span>
                {stats.dueToday > 0 && <ChevronRight className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {/* Divider */}
            <div className={`mx-4 border-t ${darkMode ? 'border-slate-700' : 'border-slate-100'}`} />

            {/* Upcoming */}
            <button
              onClick={onNavigateToTasks}
              disabled={stats.upcoming === 0}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                stats.upcoming > 0
                  ? darkMode
                    ? 'hover:bg-slate-700/50'
                    : 'hover:bg-slate-50'
                  : 'opacity-50 cursor-default'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  darkMode ? 'bg-[#72B5E8]/20' : 'bg-[#72B5E8]/10'
                }`}>
                  <Clock className="w-5 h-5 text-[#0047CC]" />
                </div>
                <div className="text-left">
                  <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Upcoming</p>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Due in next 7 days</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${
                  stats.upcoming > 0
                    ? darkMode ? 'text-slate-200' : 'text-slate-700'
                    : darkMode ? 'text-slate-500' : 'text-slate-300'
                }`}>
                  {stats.upcoming}
                </span>
                {stats.upcoming > 0 && <ChevronRight className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {/* Divider */}
            <div className={`mx-4 border-t ${darkMode ? 'border-slate-700' : 'border-slate-100'}`} />

            {/* Assigned to me */}
            <button
              onClick={onFilterMyTasks}
              disabled={stats.myTasks === 0}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                stats.myTasks > 0
                  ? darkMode
                    ? 'hover:bg-slate-700/50'
                    : 'hover:bg-slate-50'
                  : 'opacity-50 cursor-default'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  darkMode ? 'bg-slate-700' : 'bg-slate-100'
                }`}>
                  <ListTodo className="w-5 h-5 text-slate-600" />
                </div>
                <div className="text-left">
                  <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Assigned to me</p>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>All my active tasks</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${
                  stats.myTasks > 0
                    ? darkMode ? 'text-slate-200' : 'text-slate-700'
                    : darkMode ? 'text-slate-500' : 'text-slate-300'
                }`}>
                  {stats.myTasks}
                </span>
                {stats.myTasks > 0 && <ChevronRight className="w-4 h-4 text-slate-400" />}
              </div>
            </button>
          </div>
        </div>

        {/* Weekly Progress */}
        <div className={`rounded-2xl p-5 ${
          darkMode
            ? 'bg-[#1E293B] border border-[#334155]'
            : 'bg-white border border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                darkMode ? 'bg-[#0033A0]/20' : 'bg-[#0033A0]/10'
              }`}>
                <BarChart3 className="w-5 h-5 text-[#0033A0]" />
              </div>
              <div>
                <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Weekly Progress</h3>
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tasks completed each day</p>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
              stats.completionRate >= 50
                ? 'bg-[#10B981]/10 text-[#10B981]'
                : stats.completionRate >= 25
                  ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                  : 'bg-slate-100 text-slate-500'
            }`}>
              <TrendingUp className="w-4 h-4" />
              <span className="font-bold text-sm">{stats.completionRate}%</span>
            </div>
          </div>

          {/* Chart */}
          <div className="flex items-end justify-between gap-3 h-28">
            {stats.weekData.map((day, index) => {
              const height = stats.maxDaily > 0 ? (day.completed / stats.maxDaily) * 100 : 0;
              return (
                <motion.div
                  key={day.dayName}
                  className="flex-1 flex flex-col items-center gap-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <span className={`text-sm font-semibold ${
                    day.completed > 0
                      ? darkMode ? 'text-white' : 'text-slate-700'
                      : darkMode ? 'text-slate-600' : 'text-slate-300'
                  }`}>
                    {day.completed}
                  </span>

                  <div className="w-full flex-1 flex flex-col justify-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(height, 4)}%` }}
                      transition={{ delay: 0.2 + index * 0.05, duration: 0.4 }}
                      className={`w-full rounded-md ${
                        day.isToday
                          ? 'bg-[#0033A0]'
                          : day.completed > 0
                            ? darkMode ? 'bg-[#0033A0]/40' : 'bg-[#0033A0]/20'
                            : darkMode ? 'bg-slate-700' : 'bg-slate-100'
                      }`}
                    />
                  </div>

                  <span className={`text-xs font-medium ${
                    day.isToday
                      ? 'text-[#0033A0] font-semibold'
                      : darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {day.dayName}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <motion.button
            onClick={onAddTask}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-2 p-4 rounded-xl bg-[#0033A0] text-white font-semibold shadow-lg shadow-[#0033A0]/20 hover:bg-[#0028A0] transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Task</span>
          </motion.button>

          <motion.button
            onClick={onNavigateToTasks}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center justify-center gap-2 p-4 rounded-xl font-semibold transition-colors ${
              darkMode
                ? 'bg-slate-700 text-white hover:bg-slate-600'
                : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Team coordination - only show if there's actionable info */}
        {users.length > 1 && (
          <div className={`rounded-2xl p-5 ${
            darkMode
              ? 'bg-[#1E293B] border border-[#334155]'
              : 'bg-white border border-slate-200'
          }`}>
            <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Team Workload
            </h3>

            <div className="space-y-3">
              {users.map((user) => {
                const userTasks = todos.filter(t => t.assigned_to === user && !t.completed).length;
                const isYou = user === currentUser.name;

                return (
                  <div
                    key={user}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                      isYou
                        ? darkMode ? 'bg-[#0033A0]/10' : 'bg-[#0033A0]/5'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-[#0033A0] text-white flex items-center justify-center text-sm font-bold`}>
                        {user.charAt(0)}
                      </div>
                      <span className={`text-sm font-medium ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        {user}
                        {isYou && <span className="text-slate-400 ml-1">(you)</span>}
                      </span>
                    </div>
                    <span className={`text-sm ${
                      userTasks > 0
                        ? darkMode ? 'text-white font-semibold' : 'text-slate-900 font-semibold'
                        : darkMode ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      {userTasks} task{userTasks !== 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
