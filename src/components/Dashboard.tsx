'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  ArrowRight,
  Plus,
  Flame,
  Target,
  Users,
  ListTodo,
  Zap,
  ChevronRight,
  Sun,
  Moon,
  Sunrise,
  Sparkles,
  BarChart3,
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
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate stats
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

    const urgent = activeTodos.filter(t => t.priority === 'urgent' || t.priority === 'high');

    // Weekly completion data
    const weekData: WeekDay[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      const completed = completedTodos.filter(t => {
        const updatedAt = t.updated_at ? new Date(t.updated_at) : new Date(t.created_at);
        return updatedAt >= date && updatedAt <= dateEnd;
      }).length;

      weekData.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        completed,
        isToday: i === 0,
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
      urgent: urgent.length,
      weekData,
      weeklyCompleted,
      maxDaily,
      completionRate: todos.length > 0 ? Math.round((completedTodos.length / todos.length) * 100) : 0,
    };
  }, [todos, currentUser.name]);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: 'Good morning', Icon: Sunrise };
    if (hour < 17) return { text: 'Good afternoon', Icon: Sun };
    return { text: 'Good evening', Icon: Moon };
  };

  const greeting = getGreeting();

  // Stagger animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#0A1628]' : 'bg-[var(--background)]'}`}>
      {/* Hero Header with enhanced gradient and texture */}
      <div className="relative overflow-hidden">
        {/* Background gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-navy)] via-[var(--brand-blue)] to-[var(--brand-sky)]" />

        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{
              x: [0, 30, 0],
              y: [0, -20, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute -top-20 -right-20 w-[500px] h-[500px] bg-[var(--brand-sky)]/30 rounded-full blur-[100px]"
          />
          <motion.div
            animate={{
              x: [0, -20, 0],
              y: [0, 30, 0],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute -bottom-40 -left-20 w-[400px] h-[400px] bg-[#00205B]/50 rounded-full blur-[80px]"
          />
        </div>

        {/* Subtle noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {/* Greeting with animated icon */}
            <motion.div variants={itemVariants} className="flex items-center gap-3 mb-3">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <greeting.Icon className="w-6 h-6 text-[var(--brand-sky)]" />
              </motion.div>
              <span className="text-[var(--brand-sky)] font-medium tracking-wide uppercase text-sm">{greeting.text}</span>
            </motion.div>

            {/* Name with gradient text effect */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight"
              style={{
                textShadow: '0 2px 20px rgba(0,0,0,0.15)',
              }}
            >
              {currentUser.name}
            </motion.h1>

            {/* Status message */}
            <motion.p variants={itemVariants} className="text-white/80 text-lg font-light">
              {stats.active === 0
                ? "All caught up! No active tasks."
                : (
                  <>
                    You have <span className="font-semibold text-white">{stats.active}</span> active task{stats.active !== 1 ? 's' : ''}
                    {stats.overdue > 0 && (
                      <span className="text-red-300 font-medium"> including {stats.overdue} overdue</span>
                    )}
                  </>
                )}
            </motion.p>

            {/* Quick Stats Badges */}
            <motion.div variants={itemVariants} className="flex flex-wrap gap-3 mt-8">
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md rounded-full px-5 py-2.5 border border-white/10 shadow-lg shadow-black/10"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Flame className="w-4 h-4 text-orange-400" />
                </motion.div>
                <span className="text-white text-sm font-semibold">
                  {currentUser.streak_count || 0} day streak
                </span>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md rounded-full px-5 py-2.5 border border-white/10 shadow-lg shadow-black/10"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-white text-sm font-semibold">
                  {stats.weeklyCompleted} completed this week
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 -mt-4 relative z-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* Priority Action Cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {/* Overdue Card */}
            <motion.button
              onClick={onFilterOverdue}
              disabled={stats.overdue === 0}
              onHoverStart={() => setHoveredCard('overdue')}
              onHoverEnd={() => setHoveredCard(null)}
              whileHover={stats.overdue > 0 ? { scale: 1.03, y: -4 } : {}}
              whileTap={stats.overdue > 0 ? { scale: 0.98 } : {}}
              className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-500 ${
                stats.overdue > 0
                  ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-xl shadow-red-500/25'
                  : darkMode
                    ? 'bg-[var(--surface)] border border-[var(--border)]'
                    : 'bg-white border border-[var(--border)] shadow-sm'
              }`}
            >
              {/* Animated background pattern for active state */}
              {stats.overdue > 0 && (
                <motion.div
                  className="absolute inset-0 opacity-20"
                  animate={{
                    backgroundPosition: ['0% 0%', '100% 100%'],
                  }}
                  transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                  style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                  }}
                />
              )}

              <div className="relative">
                <div className={`flex items-center justify-between mb-4 ${stats.overdue > 0 ? 'text-white/90' : 'text-[var(--text-muted)]'}`}>
                  <div className={`p-2 rounded-xl ${stats.overdue > 0 ? 'bg-white/20' : 'bg-red-50 dark:bg-red-500/10'}`}>
                    <AlertTriangle className={`w-5 h-5 ${stats.overdue > 0 ? 'text-white' : 'text-red-500'}`} />
                  </div>
                  <AnimatePresence>
                    {stats.overdue > 0 && hoveredCard === 'overdue' && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <p className={`text-4xl font-bold tracking-tight ${stats.overdue > 0 ? 'text-white' : 'text-[var(--foreground)]'}`}>
                  {stats.overdue}
                </p>
                <p className={`text-sm font-medium mt-1 ${stats.overdue > 0 ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                  Overdue
                </p>
              </div>
            </motion.button>

            {/* Due Today Card */}
            <motion.button
              onClick={onFilterDueToday}
              disabled={stats.dueToday === 0}
              onHoverStart={() => setHoveredCard('today')}
              onHoverEnd={() => setHoveredCard(null)}
              whileHover={stats.dueToday > 0 ? { scale: 1.03, y: -4 } : {}}
              whileTap={stats.dueToday > 0 ? { scale: 0.98 } : {}}
              className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-500 ${
                stats.dueToday > 0
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-amber-500/25'
                  : darkMode
                    ? 'bg-[var(--surface)] border border-[var(--border)]'
                    : 'bg-white border border-[var(--border)] shadow-sm'
              }`}
            >
              {stats.dueToday > 0 && (
                <motion.div
                  className="absolute inset-0 opacity-20"
                  animate={{
                    backgroundPosition: ['0% 0%', '100% 100%'],
                  }}
                  transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                  style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                  }}
                />
              )}

              <div className="relative">
                <div className={`flex items-center justify-between mb-4 ${stats.dueToday > 0 ? 'text-white/90' : 'text-[var(--text-muted)]'}`}>
                  <div className={`p-2 rounded-xl ${stats.dueToday > 0 ? 'bg-white/20' : 'bg-amber-50 dark:bg-amber-500/10'}`}>
                    <Calendar className={`w-5 h-5 ${stats.dueToday > 0 ? 'text-white' : 'text-amber-500'}`} />
                  </div>
                  <AnimatePresence>
                    {stats.dueToday > 0 && hoveredCard === 'today' && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <p className={`text-4xl font-bold tracking-tight ${stats.dueToday > 0 ? 'text-white' : 'text-[var(--foreground)]'}`}>
                  {stats.dueToday}
                </p>
                <p className={`text-sm font-medium mt-1 ${stats.dueToday > 0 ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                  Due Today
                </p>
              </div>
            </motion.button>

            {/* My Tasks Card */}
            <motion.button
              onClick={onFilterMyTasks}
              disabled={stats.myTasks === 0}
              onHoverStart={() => setHoveredCard('mytasks')}
              onHoverEnd={() => setHoveredCard(null)}
              whileHover={stats.myTasks > 0 ? { scale: 1.03, y: -4 } : {}}
              whileTap={stats.myTasks > 0 ? { scale: 0.98 } : {}}
              className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-500 ${
                stats.myTasks > 0
                  ? 'bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] shadow-xl shadow-[var(--brand-blue)]/25'
                  : darkMode
                    ? 'bg-[var(--surface)] border border-[var(--border)]'
                    : 'bg-white border border-[var(--border)] shadow-sm'
              }`}
            >
              {stats.myTasks > 0 && (
                <motion.div
                  className="absolute inset-0 opacity-20"
                  animate={{
                    backgroundPosition: ['0% 0%', '100% 100%'],
                  }}
                  transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                  style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                  }}
                />
              )}

              <div className="relative">
                <div className={`flex items-center justify-between mb-4 ${stats.myTasks > 0 ? 'text-white/90' : 'text-[var(--text-muted)]'}`}>
                  <div className={`p-2 rounded-xl ${stats.myTasks > 0 ? 'bg-white/20' : 'bg-blue-50 dark:bg-blue-500/10'}`}>
                    <Target className={`w-5 h-5 ${stats.myTasks > 0 ? 'text-white' : 'text-[var(--brand-blue)]'}`} />
                  </div>
                  <AnimatePresence>
                    {stats.myTasks > 0 && hoveredCard === 'mytasks' && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <p className={`text-4xl font-bold tracking-tight ${stats.myTasks > 0 ? 'text-white' : 'text-[var(--foreground)]'}`}>
                  {stats.myTasks}
                </p>
                <p className={`text-sm font-medium mt-1 ${stats.myTasks > 0 ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                  My Tasks
                </p>
              </div>
            </motion.button>
          </motion.div>

          {/* Weekly Progress Chart - Enhanced */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 mb-8 ${darkMode ? 'bg-[var(--surface)]' : 'bg-white'} border border-[var(--border)] shadow-sm overflow-hidden relative`}
          >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-blue)]/[0.02] to-transparent pointer-events-none" />

            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[var(--brand-blue)]/10">
                    <BarChart3 className="w-5 h-5 text-[var(--brand-blue)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)]">This Week</h3>
                    <p className="text-sm text-[var(--text-muted)]">{stats.weeklyCompleted} tasks completed</p>
                  </div>
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10"
                >
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.completionRate}%</span>
                </motion.div>
              </div>

              {/* Enhanced Bar Chart */}
              <div className="flex items-end justify-between gap-3 h-32">
                {stats.weekData.map((day, index) => {
                  const height = stats.maxDaily > 0 ? (day.completed / stats.maxDaily) * 100 : 0;
                  return (
                    <motion.div
                      key={day.dayName}
                      className="flex-1 flex flex-col items-center gap-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                    >
                      {/* Count label */}
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 + index * 0.05 }}
                        className={`text-xs font-semibold ${
                          day.isToday ? 'text-[var(--brand-blue)]' :
                          day.completed > 0 ? 'text-[var(--foreground)]' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {day.completed > 0 ? day.completed : ''}
                      </motion.span>

                      {/* Bar container */}
                      <div className="w-full flex-1 flex flex-col justify-end">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(height, 8)}%` }}
                          transition={{
                            delay: 0.4 + index * 0.06,
                            duration: 0.6,
                            type: 'spring',
                            stiffness: 100,
                          }}
                          className={`w-full rounded-lg relative overflow-hidden ${
                            day.isToday
                              ? 'bg-gradient-to-t from-[var(--brand-blue)] to-[var(--brand-sky)]'
                              : day.completed > 0
                                ? 'bg-[var(--brand-blue)]/30'
                                : darkMode ? 'bg-[var(--surface-2)]' : 'bg-slate-100'
                          }`}
                        >
                          {/* Shine effect for today */}
                          {day.isToday && (
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                              animate={{
                                x: ['-100%', '100%'],
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                repeatDelay: 3,
                              }}
                            />
                          )}
                        </motion.div>
                      </div>

                      {/* Day label */}
                      <div className={`text-xs font-medium px-2 py-1 rounded-md ${
                        day.isToday
                          ? 'bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]'
                          : 'text-[var(--text-muted)]'
                      }`}>
                        {day.dayName}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Quick Actions - Enhanced */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <motion.button
              onClick={onAddTask}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group relative flex items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] text-white font-semibold shadow-xl shadow-[var(--brand-blue)]/25 overflow-hidden"
            >
              {/* Animated background */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 4,
                }}
              />

              <motion.div
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.3 }}
              >
                <Plus className="w-5 h-5" />
              </motion.div>
              <span className="relative">Add New Task</span>
            </motion.button>

            <motion.button
              onClick={onNavigateToTasks}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`group flex items-center justify-center gap-3 p-6 rounded-2xl font-semibold transition-all border-2 ${
                darkMode
                  ? 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--brand-blue)]/50'
                  : 'bg-white border-[var(--border)] text-[var(--foreground)] hover:border-[var(--brand-blue)] shadow-sm'
              }`}
            >
              <ListTodo className="w-5 h-5" />
              <span>View All Tasks</span>
              <motion.div
                className="ml-1"
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ArrowRight className="w-4 h-4" />
              </motion.div>
            </motion.button>
          </motion.div>

          {/* Team Activity - Enhanced */}
          <motion.div
            variants={itemVariants}
            className={`rounded-2xl p-6 ${darkMode ? 'bg-[var(--surface)]' : 'bg-white'} border border-[var(--border)] shadow-sm`}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-500/10">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-[var(--foreground)]">Team</h3>
            </div>

            <div className="flex flex-wrap gap-3">
              {users.map((user, index) => {
                const userTasks = todos.filter(t => t.assigned_to === user && !t.completed).length;
                const colors = [
                  'from-blue-500 to-blue-600',
                  'from-emerald-500 to-emerald-600',
                  'from-purple-500 to-purple-600',
                  'from-amber-500 to-amber-600',
                  'from-pink-500 to-pink-600',
                  'from-cyan-500 to-cyan-600',
                ];
                const color = colors[index % colors.length];

                return (
                  <motion.div
                    key={user}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + index * 0.05 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-default ${
                      darkMode ? 'bg-[var(--surface-2)]' : 'bg-slate-50 hover:bg-slate-100'
                    } transition-colors`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
                      {user.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-[var(--foreground)]">{user}</span>
                    {userTasks > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-xs px-2 py-0.5 rounded-full bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] font-semibold"
                      >
                        {userTasks}
                      </motion.span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
