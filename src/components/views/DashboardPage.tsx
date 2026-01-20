'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
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
  Sparkles,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  Target,
  Flame,
  Award,
  Brain,
  Users,
  UserCheck,
  BarChart3,
  AlertOctagon,
  Send,
  RefreshCw,
  Calendar,
  ListTodo,
  FileText,
  Phone,
  DollarSign,
  Shield,
  Car,
} from 'lucide-react';
import { Todo, AuthUser, ActivityLogEntry } from '@/types/todo';
import { useTheme } from '@/contexts/ThemeContext';
import { useTodoStore } from '@/store/todoStore';
import { useAppShell } from '../layout';
import {
  generateDashboardAIData,
  NeglectedTask,
  ProductivityInsight,
} from '@/lib/aiDashboardInsights';
import {
  generateManagerDashboardData,
} from '@/lib/managerDashboardInsights';
import {
  getInsuranceWorkloadSummary,
  InsuranceTaskCategory,
} from '@/lib/orchestratorIntegration';

interface DashboardPageProps {
  currentUser: AuthUser;
  todos: Todo[];
  activityLog?: ActivityLogEntry[];
  users?: string[];
  onNavigateToTasks?: () => void;
  onAddTask?: () => void;
  onFilterOverdue?: () => void;
  onFilterDueToday?: () => void;
}

interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  completed: number;
  isToday: boolean;
}

export default function DashboardPage({
  currentUser,
  todos,
  activityLog = [],
  users = [],
  onNavigateToTasks,
  onAddTask,
  onFilterOverdue,
  onFilterDueToday,
}: DashboardPageProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const { setActiveView, triggerNewTask } = useAppShell();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if user has team members (is a manager)
  const hasTeam = users.length > 1;

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Generate AI insights
  const aiData = useMemo(() => {
    return generateDashboardAIData(todos, activityLog, currentUser.name);
  }, [todos, activityLog, currentUser.name]);

  // Generate manager/team insights
  const managerData = useMemo(() => {
    if (!hasTeam) return null;
    return generateManagerDashboardData(todos, currentUser.name, users);
  }, [todos, currentUser.name, users, hasTeam]);

  // Generate insurance workload summary (for agency manager view)
  const insuranceWorkload = useMemo(() => {
    return getInsuranceWorkloadSummary(todos);
  }, [todos]);

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
        if (!t.updated_at && !t.created_at) return false;
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

  const handleAddTask = useCallback(() => {
    if (onAddTask) {
      onAddTask();
    } else {
      triggerNewTask();
    }
  }, [onAddTask, triggerNewTask]);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const getInsightIcon = (type: ProductivityInsight['type']) => {
    switch (type) {
      case 'streak': return Flame;
      case 'milestone': return Award;
      case 'pattern': return TrendingUp;
      case 'encouragement': return Sparkles;
      case 'tip': return Lightbulb;
      default: return Brain;
    }
  };

  const getUrgencyColor = (urgency: NeglectedTask['urgencyLevel']) => {
    switch (urgency) {
      case 'critical': return 'text-red-500';
      case 'warning': return 'text-amber-500';
      case 'notice': return 'text-blue-400';
    }
  };

  const getUrgencyBg = (urgency: NeglectedTask['urgencyLevel']) => {
    switch (urgency) {
      case 'critical': return darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200';
      case 'warning': return darkMode ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200';
      case 'notice': return darkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200';
    }
  };

  // Card component for consistency
  const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-2xl p-5 ${
      darkMode
        ? 'bg-[var(--surface)] border border-white/10'
        : 'bg-white border border-[var(--border)] shadow-sm'
    } ${className}`}>
      {children}
    </div>
  );

  const SectionTitle = ({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) => (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`w-5 h-5 ${darkMode ? 'text-[var(--accent)]' : 'text-[#0033A0]'}`} />
      <h2 className={`text-sm font-semibold uppercase tracking-wide ${
        darkMode ? 'text-white/70' : 'text-slate-600'
      }`}>
        {title}
      </h2>
    </div>
  );

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
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <greeting.Icon className="w-5 h-5 text-white/60" />
                <span className="text-white/60 text-sm font-medium">{greeting.text}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
                {currentUser.name}
              </h1>
              {aiData.streakMessage ? (
                <div className="flex items-center gap-2 text-amber-300 text-sm font-medium">
                  <Flame className="w-4 h-4" />
                  {aiData.streakMessage}
                </div>
              ) : (
                <p className="text-white/70 text-sm">
                  {stats.weeklyCompleted} completed this week • {stats.totalActive} active tasks
                </p>
              )}
            </div>

            {/* Productivity Score */}
            <div className="flex flex-col items-center">
              <div className={`
                w-16 h-16 rounded-2xl flex items-center justify-center
                ${aiData.productivityScore >= 70
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : aiData.productivityScore >= 40
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-red-500/20 text-red-400'
                }
              `}>
                <span className="text-2xl font-bold">{aiData.productivityScore}</span>
              </div>
              <span className="text-white/40 text-xs mt-2">Productivity</span>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <button
              onClick={handleFilterOverdue}
              className={`p-4 rounded-xl text-left transition-all ${
                stats.overdue > 0
                  ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30'
                  : 'bg-white/10 hover:bg-white/15'
              }`}
            >
              <p className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-red-400' : 'text-white'}`}>
                {stats.overdue}
              </p>
              <p className="text-white/60 text-xs">Overdue</p>
            </button>

            <button
              onClick={handleFilterDueToday}
              className="p-4 rounded-xl text-left bg-white/10 hover:bg-white/15 transition-all"
            >
              <p className="text-2xl font-bold text-white">{stats.dueToday}</p>
              <p className="text-white/60 text-xs">Due Today</p>
            </button>

            <div className="p-4 rounded-xl text-left bg-white/10">
              <p className="text-2xl font-bold text-amber-400">{stats.highPriority}</p>
              <p className="text-white/60 text-xs">High Priority</p>
            </div>

            <div className="p-4 rounded-xl text-left bg-white/10">
              <p className="text-2xl font-bold text-emerald-400">{stats.weeklyCompleted}</p>
              <p className="text-white/60 text-xs">This Week</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column - Tasks */}
          <div className="lg:col-span-2 space-y-6">

            {/* Critical Alerts */}
            {(stats.overdue > 0 || aiData.neglectedTasks.length > 0) && (
              <Card>
                <SectionTitle icon={AlertTriangle} title="Critical Alerts" />
                <div className="space-y-3">
                  {stats.overdue > 0 && (
                    <button
                      onClick={handleFilterOverdue}
                      className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors group"
                    >
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <div className="flex-1 text-left">
                        <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                          {stats.overdue} overdue tasks
                        </span>
                        <span className={`text-sm ml-2 ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>
                          need immediate attention
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-red-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </button>
                  )}

                  {aiData.neglectedTasks.slice(0, 2).map((item) => (
                    <div
                      key={item.todo.id}
                      className={`p-4 rounded-xl border ${getUrgencyBg(item.urgencyLevel)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${getUrgencyColor(item.urgencyLevel)}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            {item.todo.text}
                          </p>
                          <p className={`text-xs mt-1 ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>
                            {item.daysSinceActivity} days without activity
                          </p>
                          <p className={`text-xs mt-2 italic ${darkMode ? 'text-white/50' : 'text-slate-600'}`}>
                            <Brain className="w-3 h-3 inline mr-1" />
                            {item.aiSuggestion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Today's Focus */}
            <Card>
              <SectionTitle icon={Target} title="Today's Focus" />

              {aiData.todaysFocus && (
                <div className={`flex items-center gap-3 p-4 rounded-xl mb-4 ${
                  darkMode
                    ? 'bg-violet-500/10 border border-violet-500/30'
                    : 'bg-violet-50 border border-violet-200'
                }`}>
                  <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0" />
                  <p className={`text-sm font-medium ${darkMode ? 'text-violet-300' : 'text-violet-700'}`}>
                    {aiData.todaysFocus}
                  </p>
                </div>
              )}

              {stats.dueToday > 0 ? (
                <div className="space-y-2">
                  {stats.dueTodayTasks.slice(0, 5).map((task) => (
                    <button
                      key={task.id}
                      onClick={handleNavigateToTasks}
                      className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                        darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-3 h-3 mt-1 rounded-full flex-shrink-0 ${
                        task.priority === 'urgent' ? 'bg-red-500' :
                        task.priority === 'high' ? 'bg-orange-500' :
                        'bg-[#0033A0]'
                      }`} />
                      <span className={`flex-1 font-medium line-clamp-2 ${
                        darkMode ? 'text-white' : 'text-slate-900'
                      }`}>
                        {task.text}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.assigned_to && task.assigned_to !== currentUser.name && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            darkMode ? 'bg-white/10 text-white/60' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {task.assigned_to}
                          </span>
                        )}
                        <ChevronRight className={`w-4 h-4 ${darkMode ? 'text-white/40' : 'text-slate-400'}`} />
                      </div>
                    </button>
                  ))}
                  {stats.dueToday > 5 && (
                    <button
                      onClick={handleFilterDueToday}
                      className={`w-full text-center py-2 text-sm font-medium ${
                        darkMode ? 'text-[#72B5E8]' : 'text-[#0033A0]'
                      } hover:underline`}
                    >
                      View all {stats.dueToday} tasks due today
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 py-4">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  <span className={`${darkMode ? 'text-white/70' : 'text-slate-600'}`}>
                    No tasks due today. Great job staying ahead!
                  </span>
                </div>
              )}
            </Card>

            {/* This Week Progress */}
            <Card>
              <SectionTitle icon={BarChart3} title="This Week's Progress" />

              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    {stats.weeklyCompleted}
                  </span>
                  <span className={`text-sm ml-2 ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>
                    of {stats.weeklyTotal} tasks ({stats.weeklyRatio}%)
                  </span>
                </div>
                <div className={`text-right ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>
                  <p className="text-xs">Best day</p>
                  <p className="font-semibold">{stats.maxDaily} {stats.maxDaily === 1 ? 'task' : 'tasks'}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className={`h-3 rounded-full mb-6 ${darkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(stats.weeklyRatio, 2)}%` }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className={`h-full rounded-full ${
                    stats.weeklyRatio >= 50 ? 'bg-emerald-500' :
                    stats.weeklyRatio >= 25 ? 'bg-amber-500' :
                    'bg-[#0033A0]'
                  }`}
                />
              </div>

              {/* Daily chart */}
              <div className="flex items-end justify-between gap-3 h-32">
                {stats.weekData.map((day, index) => {
                  const height = stats.maxDaily > 0 ? (day.completed / stats.maxDaily) * 100 : 0;
                  // Minimum bar height for visibility: 12px for empty, 24px for non-empty
                  // Max height is ~80px (leaving room for labels below in h-32 container)
                  const maxBarHeight = 80;
                  const barHeight = day.completed > 0
                    ? Math.max((height / 100) * maxBarHeight, 24)
                    : 12;
                  return (
                    <div key={day.dayName} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex-1 flex flex-col justify-end">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: barHeight }}
                          transition={{ delay: 0.3 + index * 0.05, duration: 0.3 }}
                          className={`w-full rounded-t-lg ${
                            day.isToday
                              ? 'bg-[#0033A0]'
                              : day.completed > 0
                                ? darkMode ? 'bg-[#0033A0]/60' : 'bg-[#0033A0]/30'
                                : darkMode ? 'bg-white/10' : 'bg-slate-200'
                          }`}
                        />
                      </div>
                      <div className="text-center">
                        <p className={`text-xs font-medium ${
                          day.isToday
                            ? darkMode ? 'text-[#72B5E8]' : 'text-[#0033A0]'
                            : darkMode ? 'text-white/60' : 'text-slate-500'
                        }`}>
                          {day.dayName}
                        </p>
                        <p className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                          {day.completed}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Upcoming This Week */}
            {stats.upcoming > 0 && (
              <Card>
                <SectionTitle icon={Calendar} title="Coming Up This Week" />
                <div className="space-y-2">
                  {stats.upcomingTasks.slice(0, 4).map((task) => (
                    <button
                      key={task.id}
                      onClick={handleNavigateToTasks}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                        darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        task.priority === 'urgent' ? 'bg-red-500' :
                        task.priority === 'high' ? 'bg-orange-500' :
                        'bg-slate-400'
                      }`} />
                      <span className={`flex-1 truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        {task.text}
                      </span>
                      <span className={`text-xs ${darkMode ? 'text-white/50' : 'text-slate-500'}`}>
                        {task.due_date && formatDueDate(task.due_date)}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right Column - Insights & Team */}
          <div className="space-y-6">

            {/* AI Insights */}
            <Card>
              <SectionTitle icon={Sparkles} title="AI Insights" />

              {aiData.insights.length > 0 ? (
                <div className="space-y-3">
                  {aiData.insights.slice(0, 4).map((insight, index) => {
                    const IconComponent = getInsightIcon(insight.type);
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`flex items-start gap-3 p-3 rounded-xl ${
                          darkMode ? 'bg-white/5' : 'bg-slate-50'
                        }`}
                      >
                        <span className="text-xl flex-shrink-0">{insight.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            {insight.title}
                          </p>
                          <p className={`text-xs mt-0.5 ${darkMode ? 'text-white/60' : 'text-slate-600'}`}>
                            {insight.message}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className={`text-center py-6 ${darkMode ? 'text-white/50' : 'text-slate-400'}`}>
                  <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">All caught up! No insights right now.</p>
                </div>
              )}

              {/* Daily Tip */}
              <div className={`mt-4 p-4 rounded-xl ${
                darkMode
                  ? 'bg-gradient-to-br from-violet-900/20 to-indigo-900/20 border border-violet-500/20'
                  : 'bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-violet-500" />
                  <span className={`text-xs font-semibold uppercase ${
                    darkMode ? 'text-violet-300' : 'text-violet-600'
                  }`}>
                    Daily Tip
                  </span>
                </div>
                <p className={`text-sm italic ${darkMode ? 'text-white/70' : 'text-slate-700'}`}>
                  "{aiData.motivationalQuote}"
                </p>
              </div>
            </Card>

            {/* Team Overview (if manager) */}
            {hasTeam && managerData && (
              <Card>
                <SectionTitle icon={Users} title="Team Overview" />

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className={`text-center p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {managerData.teamOverview.totalActive}
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>Active</p>
                  </div>
                  <div className={`text-center p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <p className={`text-2xl font-bold ${
                      managerData.teamOverview.totalOverdue > 0 ? 'text-red-500' : 'text-emerald-500'
                    }`}>
                      {managerData.teamOverview.totalOverdue}
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>Overdue</p>
                  </div>
                </div>

                {/* Team workload bars */}
                <div className="space-y-3">
                  {managerData.memberStats.slice(0, 4).map((member) => (
                    <div key={member.name} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                          {member.name}
                        </span>
                        <span className={`text-xs ${darkMode ? 'text-white/50' : 'text-slate-500'}`}>
                          {member.activeTasks} tasks
                        </span>
                      </div>
                      <div className={`h-2 rounded-full ${darkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                        <div
                          className={`h-full rounded-full transition-all ${
                            member.workloadLevel === 'overloaded' ? 'bg-red-500' :
                            member.workloadLevel === 'heavy' ? 'bg-amber-500' :
                            member.workloadLevel === 'normal' ? 'bg-[#0033A0]' :
                            'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(member.activeTasks / 15 * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottlenecks */}
                {managerData.bottlenecks.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {managerData.bottlenecks.slice(0, 2).map((bottleneck, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-xl text-sm ${
                          bottleneck.severity === 'critical'
                            ? darkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-700'
                            : darkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        {bottleneck.title}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Insurance Workload Summary (Agency-specific) */}
            {hasTeam && (
              <Card>
                <SectionTitle icon={Shield} title="Insurance Workload" />
                <div className="space-y-3">
                  {/* Key Categories with icons */}
                  {[
                    { key: 'claim' as InsuranceTaskCategory, label: 'Claims', icon: FileText, color: 'text-red-500' },
                    { key: 'follow_up' as InsuranceTaskCategory, label: 'Follow-ups', icon: Phone, color: 'text-blue-500' },
                    { key: 'payment' as InsuranceTaskCategory, label: 'Payments', icon: DollarSign, color: 'text-emerald-500' },
                    { key: 'vehicle_add' as InsuranceTaskCategory, label: 'Vehicle Adds', icon: Car, color: 'text-purple-500' },
                    { key: 'policy_review' as InsuranceTaskCategory, label: 'Policy Reviews', icon: Shield, color: 'text-amber-500' },
                  ].map(({ key, label, icon: Icon, color }) => {
                    const data = insuranceWorkload[key];
                    const hasItems = data.active > 0 || data.overdue > 0;
                    if (!hasItems) return null;

                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${color}`} />
                          <span className={`text-sm ${darkMode ? 'text-white/80' : 'text-slate-700'}`}>
                            {label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className={`${darkMode ? 'text-white/60' : 'text-slate-500'}`}>
                            {data.active} active
                          </span>
                          {data.overdue > 0 && (
                            <span className="text-red-500 font-medium">
                              {data.overdue} overdue
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* No active insurance tasks */}
                  {Object.values(insuranceWorkload).every(d => d.active === 0) && (
                    <p className={`text-sm text-center py-2 ${darkMode ? 'text-white/40' : 'text-slate-400'}`}>
                      No active insurance tasks
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <SectionTitle icon={ListTodo} title="Quick Actions" />
              <div className="space-y-2">
                <button
                  onClick={handleAddTask}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-[#0033A0] text-white font-semibold hover:bg-[#0028A0] transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add New Task
                </button>
                <button
                  onClick={handleNavigateToTasks}
                  className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-semibold transition-colors ${
                    darkMode
                      ? 'bg-white/10 text-white hover:bg-white/15'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  View All Tasks
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
