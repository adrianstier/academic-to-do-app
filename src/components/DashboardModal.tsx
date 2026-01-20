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
  Wand2,
  Zap,
  GitBranch,
} from 'lucide-react';
import { Todo, AuthUser, ActivityLogEntry } from '@/types/todo';
import { useEscapeKey } from '@/hooks';
import {
  generateDashboardAIData,
  NeglectedTask,
  ProductivityInsight,
} from '@/lib/aiDashboardInsights';
import {
  generateManagerDashboardData,
} from '@/lib/managerDashboardInsights';
import {
  analyzeTaskForDecomposition,
  generateBottleneckResolutions,
} from '@/lib/orchestratorIntegration';
// Re-export utilities for backwards compatibility
export { shouldShowDailyDashboard, markDailyDashboardShown } from '@/lib/dashboardUtils';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  todos: Todo[];
  currentUser: AuthUser;
  onNavigateToTasks: () => void;
  onAddTask: () => void;
  onFilterOverdue: () => void;
  onFilterDueToday: () => void;
  activityLog?: ActivityLogEntry[];
  darkMode?: boolean;
  users?: string[]; // Team members list for manager view
  onReassignTask?: (taskId: string, newAssignee: string) => void;
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

export default function DashboardModal({
  isOpen,
  onClose,
  todos,
  currentUser,
  onNavigateToTasks,
  onAddTask,
  onFilterOverdue,
  onFilterDueToday,
  activityLog = [],
  darkMode = true,
  users = [],
  onReassignTask: _onReassignTask,
}: DashboardModalProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'team'>('overview');

  // Check if user has team members (is a manager)
  const hasTeam = users.length > 1;

  // Handle Escape key to close modal
  useEscapeKey(onClose, { enabled: isOpen });

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Generate AI insights
  const aiData = useMemo(() => {
    return generateDashboardAIData(todos, activityLog, currentUser.name);
  }, [todos, activityLog, currentUser.name]);

  // Generate manager/team insights (only if user has team members)
  const managerData = useMemo(() => {
    if (!hasTeam) return null;
    return generateManagerDashboardData(todos, currentUser.name, users);
  }, [todos, currentUser.name, users, hasTeam]);

  // Generate orchestrator suggestions for bottleneck resolution
  const orchestratorSuggestions = useMemo(() => {
    if (!hasTeam || !managerData) return [];
    return generateBottleneckResolutions(managerData.bottlenecks, todos);
  }, [hasTeam, managerData, todos]);

  // Analyze complex pending tasks for potential decomposition
  const complexTaskAnalysis = useMemo(() => {
    if (!hasTeam) return [];
    const activeTodos = todos.filter(t => !t.completed);
    // Analyze tasks that might benefit from decomposition (high priority or long titles)
    const complexTasks = activeTodos
      .filter(t => t.priority === 'urgent' || t.priority === 'high' || t.text.length > 50)
      .slice(0, 3);
    return complexTasks.map(task => ({
      task,
      analysis: analyzeTaskForDecomposition(task.text, task.notes),
    }));
  }, [hasTeam, todos]);

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
      .sort((a, b) => new Date(a.due_date || '').getTime() - new Date(b.due_date || '').getTime());

    const nextTask: UpcomingTask | null = upcoming.length > 0 && upcoming[0].due_date
      ? {
          id: upcoming[0].id,
          text: upcoming[0].text,
          due_date: upcoming[0].due_date,
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
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-modal-title"
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
                    aria-label="Close dashboard"
                    className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Greeting */}
                  <div className="flex items-center gap-2 mb-1">
                    <greeting.Icon className="w-4 h-4 text-white/60" />
                    <span className="text-white/60 text-sm font-medium">{greeting.text}</span>
                  </div>

                  <h1 id="dashboard-modal-title" className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
                    {currentUser.name}
                  </h1>

                  {/* Streak Badge or Weekly Summary */}
                  {aiData.streakMessage ? (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-amber-300 text-sm font-medium"
                    >
                      <Flame className="w-4 h-4" />
                      {aiData.streakMessage}
                    </motion.div>
                  ) : (
                    <p className="text-white/70 text-sm">
                      {stats.weeklyCompleted} completed this week
                    </p>
                  )}

                  {/* Productivity Score Badge */}
                  <div className="absolute top-4 right-14 flex flex-col items-center">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center
                      ${aiData.productivityScore >= 70
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : aiData.productivityScore >= 40
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-red-500/20 text-red-400'
                      }
                    `}>
                      <span className="text-lg font-bold">{aiData.productivityScore}</span>
                    </div>
                    <span className="text-white/40 text-[10px] mt-1">Score</span>
                  </div>
                </div>
              </div>

              {/* Tab Switcher */}
              <div className={`flex gap-2 px-5 py-3 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`
                    flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors
                    ${activeTab === 'overview'
                      ? darkMode
                        ? 'bg-[#0033A0] text-white'
                        : 'bg-[#0033A0] text-white'
                      : darkMode
                        ? 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }
                  `}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('insights')}
                  className={`
                    flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2
                    ${activeTab === 'insights'
                      ? darkMode
                        ? 'bg-[#0033A0] text-white'
                        : 'bg-[#0033A0] text-white'
                      : darkMode
                        ? 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }
                  `}
                >
                  <Sparkles className="w-4 h-4" />
                  AI
                  {(aiData.neglectedTasks.length > 0 || aiData.insights.length > 0) && (
                    <span className={`
                      w-2 h-2 rounded-full
                      ${activeTab === 'insights' ? 'bg-white' : 'bg-[#0033A0]'}
                    `} />
                  )}
                </button>
                {hasTeam && (
                  <button
                    onClick={() => setActiveTab('team')}
                    className={`
                      flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2
                      ${activeTab === 'team'
                        ? darkMode
                          ? 'bg-[#0033A0] text-white'
                          : 'bg-[#0033A0] text-white'
                        : darkMode
                          ? 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }
                    `}
                  >
                    <Users className="w-4 h-4" />
                    Team
                    {managerData && managerData.bottlenecks.length > 0 && (
                      <span className={`
                        w-2 h-2 rounded-full
                        ${activeTab === 'team' ? 'bg-white' : 'bg-amber-500'}
                      `} />
                    )}
                  </button>
                )}
              </div>

              {/* Content */}
              <div className={`px-5 py-5 space-y-4 ${darkMode ? 'bg-[#0A1628]' : 'bg-slate-50'}`}>
                <AnimatePresence mode="wait">
                  {activeTab === 'overview' ? (
                    <motion.div
                      key="overview"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Today's Focus (AI Suggested) */}
                      {aiData.todaysFocus && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                            darkMode
                              ? 'bg-violet-500/10 border border-violet-500/30'
                              : 'bg-violet-50 border border-violet-200'
                          }`}
                        >
                          <Target className="w-5 h-5 text-violet-500 flex-shrink-0" />
                          <p className={`text-sm font-medium ${darkMode ? 'text-violet-300' : 'text-violet-700'}`}>
                            {aiData.todaysFocus}
                          </p>
                        </motion.div>
                      )}

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

                      {/* Motivational Quote */}
                      <div className={`text-center py-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        <p className="text-xs italic">&ldquo;{aiData.motivationalQuote}&rdquo;</p>
                      </div>
                    </motion.div>
                  ) : activeTab === 'insights' ? (
                    <motion.div
                      key="insights"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Neglected Tasks Section */}
                      {aiData.neglectedTasks.length > 0 && (
                        <div className={`rounded-xl p-4 ${
                          darkMode
                            ? 'bg-[#1E293B] border border-[#334155]'
                            : 'bg-white border border-slate-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <h3 className={`text-xs font-semibold uppercase tracking-wide ${
                              darkMode ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              Needs Attention
                            </h3>
                          </div>

                          <div className="space-y-3">
                            {aiData.neglectedTasks.slice(0, 3).map((item) => (
                              <div
                                key={item.todo.id}
                                className={`p-3 rounded-lg border ${getUrgencyBg(item.urgencyLevel)}`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${getUrgencyColor(item.urgencyLevel)}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                      {item.todo.text}
                                    </p>
                                    <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                      {item.daysSinceActivity} days without activity
                                    </p>
                                    <p className={`text-xs mt-2 italic ${
                                      darkMode ? 'text-slate-400' : 'text-slate-600'
                                    }`}>
                                      <Brain className="w-3 h-3 inline mr-1" />
                                      {item.aiSuggestion}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {aiData.neglectedTasks.length > 3 && (
                            <button
                              onClick={() => handleAction(onNavigateToTasks)}
                              className={`w-full text-center py-2 mt-3 text-sm font-medium ${
                                darkMode ? 'text-[#72B5E8]' : 'text-[#0033A0]'
                              } hover:underline`}
                            >
                              View all {aiData.neglectedTasks.length} neglected tasks
                            </button>
                          )}
                        </div>
                      )}

                      {/* AI Insights */}
                      {aiData.insights.length > 0 && (
                        <div className={`rounded-xl p-4 ${
                          darkMode
                            ? 'bg-[#1E293B] border border-[#334155]'
                            : 'bg-white border border-slate-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-violet-500" />
                            <h3 className={`text-xs font-semibold uppercase tracking-wide ${
                              darkMode ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              AI Insights
                            </h3>
                          </div>

                          <div className="space-y-3">
                            {aiData.insights.map((insight, index) => {
                              const _IconComponent = getInsightIcon(insight.type);
                              return (
                                <motion.div
                                  key={index}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.1 }}
                                  className={`flex items-start gap-3 p-3 rounded-lg ${
                                    darkMode ? 'bg-slate-700/30' : 'bg-slate-50'
                                  }`}
                                >
                                  <span className="text-xl flex-shrink-0">{insight.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                      {insight.title}
                                    </p>
                                    <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                      {insight.message}
                                    </p>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Empty state for insights */}
                      {aiData.neglectedTasks.length === 0 && aiData.insights.length === 0 && (
                        <div className={`text-center py-8 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p className="text-sm font-medium">All caught up!</p>
                          <p className="text-xs mt-1">No special insights right now. Keep up the good work!</p>
                        </div>
                      )}

                      {/* Productivity Tips */}
                      <div className={`rounded-xl p-4 ${
                        darkMode
                          ? 'bg-gradient-to-br from-violet-900/20 to-indigo-900/20 border border-violet-500/20'
                          : 'bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="w-4 h-4 text-violet-500" />
                          <h3 className={`text-xs font-semibold uppercase tracking-wide ${
                            darkMode ? 'text-violet-300' : 'text-violet-600'
                          }`}>
                            Daily Tip
                          </h3>
                        </div>
                        <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          {aiData.motivationalQuote}
                        </p>
                      </div>
                    </motion.div>
                  ) : activeTab === 'team' && managerData ? (
                    <motion.div
                      key="team"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Team Overview Stats */}
                      <div className={`rounded-xl p-4 ${
                        darkMode
                          ? 'bg-[#1E293B] border border-[#334155]'
                          : 'bg-white border border-slate-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-3">
                          <BarChart3 className="w-4 h-4 text-[#0033A0]" />
                          <h3 className={`text-xs font-semibold uppercase tracking-wide ${
                            darkMode ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            Team Overview
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className={`text-center p-3 rounded-lg ${darkMode ? 'bg-slate-700/30' : 'bg-slate-50'}`}>
                            <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                              {managerData.teamOverview.totalActive}
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Active Tasks</p>
                          </div>
                          <div className={`text-center p-3 rounded-lg ${darkMode ? 'bg-slate-700/30' : 'bg-slate-50'}`}>
                            <p className={`text-2xl font-bold ${
                              managerData.teamOverview.totalOverdue > 0
                                ? 'text-red-500'
                                : darkMode ? 'text-emerald-400' : 'text-emerald-600'
                            }`}>
                              {managerData.teamOverview.totalOverdue}
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Overdue</p>
                          </div>
                          <div className={`text-center p-3 rounded-lg ${darkMode ? 'bg-slate-700/30' : 'bg-slate-50'}`}>
                            <p className={`text-2xl font-bold text-[#0033A0]`}>
                              {managerData.teamOverview.weeklyTeamCompleted}
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>This Week</p>
                          </div>
                          <div className={`text-center p-3 rounded-lg ${darkMode ? 'bg-slate-700/30' : 'bg-slate-50'}`}>
                            <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                              {managerData.teamOverview.teamCompletionRate}%
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Completion</p>
                          </div>
                        </div>

                        {/* Highlights */}
                        {(managerData.teamOverview.topPerformer || managerData.teamOverview.needsAttention) && (
                          <div className="mt-3 space-y-2">
                            {managerData.teamOverview.topPerformer && (
                              <div className={`flex items-center gap-2 text-xs ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                <Award className="w-3.5 h-3.5" />
                                <span><strong>{managerData.teamOverview.topPerformer}</strong> is crushing it this week!</span>
                              </div>
                            )}
                            {managerData.teamOverview.needsAttention && (
                              <div className={`flex items-center gap-2 text-xs ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span><strong>{managerData.teamOverview.needsAttention}</strong> may need support</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Team Member Workload */}
                      <div className={`rounded-xl p-4 ${
                        darkMode
                          ? 'bg-[#1E293B] border border-[#334155]'
                          : 'bg-white border border-slate-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="w-4 h-4 text-[#0033A0]" />
                          <h3 className={`text-xs font-semibold uppercase tracking-wide ${
                            darkMode ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            Team Workload
                          </h3>
                        </div>

                        <div className="space-y-3">
                          {managerData.memberStats.slice(0, 5).map((member) => (
                            <div key={member.name} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                    {member.name}
                                  </span>
                                  {member.workloadLevel === 'overloaded' && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-500/20 text-red-500">
                                      OVERLOADED
                                    </span>
                                  )}
                                  {member.workloadLevel === 'heavy' && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500/20 text-amber-500">
                                      HEAVY
                                    </span>
                                  )}
                                </div>
                                <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {member.activeTasks} active
                                  {member.overdueTasks > 0 && (
                                    <span className="text-red-500 ml-1">({member.overdueTasks} overdue)</span>
                                  )}
                                </span>
                              </div>
                              {/* Workload bar */}
                              <div className={`h-2 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
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
                      </div>

                      {/* Bottlenecks & Alerts */}
                      {managerData.bottlenecks.length > 0 && (
                        <div className={`rounded-xl p-4 ${
                          darkMode
                            ? 'bg-[#1E293B] border border-[#334155]'
                            : 'bg-white border border-slate-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            <AlertOctagon className="w-4 h-4 text-amber-500" />
                            <h3 className={`text-xs font-semibold uppercase tracking-wide ${
                              darkMode ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              Needs Attention
                            </h3>
                          </div>

                          <div className="space-y-3">
                            {managerData.bottlenecks.slice(0, 3).map((bottleneck, index) => (
                              <div
                                key={index}
                                className={`p-3 rounded-lg border ${
                                  bottleneck.severity === 'critical'
                                    ? darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
                                    : bottleneck.severity === 'warning'
                                      ? darkMode ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                                      : darkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
                                }`}
                              >
                                <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {bottleneck.title}
                                </p>
                                <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {bottleneck.description}
                                </p>
                                <p className={`text-xs mt-2 italic ${
                                  darkMode ? 'text-slate-400' : 'text-slate-500'
                                }`}>
                                  <Lightbulb className="w-3 h-3 inline mr-1" />
                                  {bottleneck.suggestion}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Delegation Stats */}
                      {managerData.delegationStats.totalDelegated > 0 && (
                        <div className={`rounded-xl p-4 ${
                          darkMode
                            ? 'bg-gradient-to-br from-indigo-900/20 to-violet-900/20 border border-indigo-500/20'
                            : 'bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Send className="w-4 h-4 text-indigo-500" />
                            <h3 className={`text-xs font-semibold uppercase tracking-wide ${
                              darkMode ? 'text-indigo-300' : 'text-indigo-600'
                            }`}>
                              Your Delegations
                            </h3>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <span className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                {managerData.delegationStats.pendingDelegated}
                              </span>
                              <span className={`ml-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>pending</span>
                            </div>
                            <div>
                              <span className={`font-bold text-emerald-500`}>
                                {managerData.delegationStats.completedDelegated}
                              </span>
                              <span className={`ml-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>completed</span>
                            </div>
                            {managerData.delegationStats.overdueDelegated > 0 && (
                              <div>
                                <span className="font-bold text-red-500">
                                  {managerData.delegationStats.overdueDelegated}
                                </span>
                                <span className={`ml-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>overdue</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Recent Team Completions */}
                      {managerData.recentTeamCompletions.length > 0 && (
                        <div className={`rounded-xl p-4 ${
                          darkMode
                            ? 'bg-[#1E293B] border border-[#334155]'
                            : 'bg-white border border-slate-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            <UserCheck className="w-4 h-4 text-emerald-500" />
                            <h3 className={`text-xs font-semibold uppercase tracking-wide ${
                              darkMode ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              Recent Wins
                            </h3>
                          </div>

                          <div className="space-y-2">
                            {managerData.recentTeamCompletions.slice(0, 3).map((task) => (
                              <div
                                key={task.id}
                                className={`flex items-center gap-2 text-sm ${
                                  darkMode ? 'text-slate-300' : 'text-slate-700'
                                }`}
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                <span className="truncate flex-1">{task.text}</span>
                                <span className={`text-xs flex-shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {task.assigned_to}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI-Powered Task Decomposition Suggestions */}
                      {complexTaskAnalysis.length > 0 && (
                        <div className={`rounded-xl p-4 ${
                          darkMode
                            ? 'bg-gradient-to-br from-violet-900/20 to-purple-900/20 border border-violet-500/20'
                            : 'bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            <Wand2 className="w-4 h-4 text-violet-500" />
                            <h3 className={`text-xs font-semibold uppercase tracking-wide ${
                              darkMode ? 'text-violet-300' : 'text-violet-600'
                            }`}>
                              AI Task Decomposition
                            </h3>
                          </div>

                          <div className="space-y-3">
                            {complexTaskAnalysis.slice(0, 2).map(({ task, analysis }) => (
                              <div
                                key={task.id}
                                className={`p-3 rounded-lg ${darkMode ? 'bg-black/20' : 'bg-white/60'}`}
                              >
                                <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {task.text}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                                    analysis.estimatedComplexity === 'high'
                                      ? 'bg-red-500/20 text-red-500'
                                      : analysis.estimatedComplexity === 'medium'
                                        ? 'bg-amber-500/20 text-amber-500'
                                        : 'bg-emerald-500/20 text-emerald-500'
                                  }`}>
                                    {analysis.estimatedComplexity.toUpperCase()} COMPLEXITY
                                  </span>
                                  <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    → {analysis.suggestedSubtasks.length} subtasks
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {analysis.suggestedSubtasks.slice(0, 4).map((subtask, idx) => (
                                    <span
                                      key={idx}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${
                                        darkMode ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      <GitBranch className="w-3 h-3" />
                                      {subtask.agentType.replace('_', ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>

                          <p className={`text-xs mt-3 ${darkMode ? 'text-violet-400' : 'text-violet-600'}`}>
                            <Zap className="w-3 h-3 inline mr-1" />
                            Complex tasks can be broken down using AI agents
                          </p>
                        </div>
                      )}

                      {/* AI-Powered Bottleneck Resolution */}
                      {orchestratorSuggestions.length > 0 && (
                        <div className={`rounded-xl p-4 ${
                          darkMode
                            ? 'bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border border-cyan-500/20'
                            : 'bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            <Zap className="w-4 h-4 text-cyan-500" />
                            <h3 className={`text-xs font-semibold uppercase tracking-wide ${
                              darkMode ? 'text-cyan-300' : 'text-cyan-600'
                            }`}>
                              AI Resolution Suggestions
                            </h3>
                          </div>

                          <div className="space-y-2">
                            {orchestratorSuggestions.slice(0, 2).map((suggestion, index) => (
                              <div
                                key={index}
                                className={`p-3 rounded-lg ${darkMode ? 'bg-black/20' : 'bg-white/60'}`}
                              >
                                <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                  {suggestion.suggestedAction}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${
                                    darkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'
                                  }`}>
                                    <Brain className="w-3 h-3" />
                                    {suggestion.agentRecommendation.replace('_', ' ')} can help
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty state for team tab */}
                      {managerData.memberStats.length === 0 && (
                        <div className={`text-center py-8 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p className="text-sm font-medium">No team data yet</p>
                          <p className="text-xs mt-1">Assign tasks to team members to see their stats here.</p>
                        </div>
                      )}
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleAction(onNavigateToTasks)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl font-semibold transition-colors min-h-[48px] touch-manipulation ${
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
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#0033A0] text-white font-semibold hover:bg-[#0028A0] transition-colors min-h-[48px] touch-manipulation"
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
