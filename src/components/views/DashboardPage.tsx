'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Sun,
  Moon,
  Sunrise,
  Target,
  Brain,
  Users,
  FileText,
  Phone,
  DollarSign,
  Shield,
  Car,
  Clock,
} from 'lucide-react';
import { Todo, AuthUser, ActivityLogEntry } from '@/types/todo';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppShell } from '../layout';
import {
  generateDashboardAIData,
  NeglectedTask,
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
  onFilterOverdue,
  onFilterDueToday,
}: DashboardPageProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const { setActiveView } = useAppShell();
  const [currentTime, setCurrentTime] = useState(new Date());

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
              <p className="text-white/70 text-sm">
                {stats.totalActive} active tasks
              </p>
            </div>
          </div>

          {/* Quick Stats Row - Reordered: Overdue (critical) -> Due Today (urgent) -> Due This Week */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <motion.button
              onClick={handleFilterOverdue}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
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
            </motion.button>

            <motion.button
              onClick={handleFilterDueToday}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`p-4 rounded-xl text-left transition-all ${
                stats.dueToday > 0
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30'
                  : 'bg-white/10 hover:bg-white/15'
              }`}
            >
              <p className={`text-2xl font-bold ${stats.dueToday > 0 ? 'text-amber-400' : 'text-white'}`}>
                {stats.dueToday}
              </p>
              <p className="text-white/60 text-xs">Due Today</p>
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-4 rounded-xl text-left bg-white/10"
            >
              <p className="text-2xl font-bold text-white">{stats.upcoming}</p>
              <p className="text-white/60 text-xs">Due This Week</p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Status Summary - Quick glance at what needs attention */}
        {(stats.overdue > 0 || aiData.neglectedTasks.length > 0) && (
          <div className="mb-6">
            <div className={`rounded-2xl overflow-hidden ${
              darkMode ? 'bg-[var(--surface)] border border-white/10' : 'bg-white border border-[var(--border)] shadow-sm'
            }`}>
              {/* Overdue Alert Banner - Most critical */}
              {stats.overdue > 0 && (
                <button
                  onClick={handleFilterOverdue}
                  className="w-full flex items-center gap-4 p-4 bg-red-500/10 hover:bg-red-500/15 transition-colors group border-b border-red-500/20"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {stats.overdue} task{stats.overdue > 1 ? 's' : ''} overdue
                    </p>
                    <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>
                      Click to view and resolve
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-red-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              )}

              {/* Stalled/Neglected Tasks - Compact list */}
              {aiData.neglectedTasks.length > 0 && (
                <div className={`p-4 ${stats.overdue > 0 ? '' : ''}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className={`w-4 h-4 ${darkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-white/70' : 'text-slate-600'}`}>
                      Needs Attention
                    </span>
                  </div>
                  <div className="space-y-2">
                    {aiData.neglectedTasks.slice(0, 3).map((item) => {
                      const badge = getUrgencyBadge(item.urgencyLevel);
                      return (
                        <div
                          key={item.todo.id}
                          className={`flex items-center gap-3 p-3 rounded-xl ${
                            darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-50 hover:bg-slate-100'
                          } transition-colors cursor-pointer`}
                          onClick={handleNavigateToTasks}
                        >
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                            {item.daysSinceActivity}d
                          </span>
                          <span className={`flex-1 truncate text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            {item.todo.text}
                          </span>
                          <ChevronRight className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-white/30' : 'text-slate-300'}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}


        <div className={`grid gap-6 ${hasTeam ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1 lg:grid-cols-3'}`}>

          {/* Main Column - Your Day */}
          <div className={`${hasTeam ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-6`}>

            {/* Your Day - Combined Today + Coming Up */}
            <Card>
              <SectionTitle icon={Target} title="Your Day" />

              {/* AI Focus Suggestion - Only if relevant */}
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

              {/* Due Today Section */}
              {stats.dueToday > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-white/50' : 'text-slate-400'}`}>
                      Due Today
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {stats.dueToday}
                    </span>
                  </div>
                  {stats.dueTodayTasks.slice(0, 5).map((task) => (
                    <button
                      key={task.id}
                      onClick={handleNavigateToTasks}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        task.priority === 'urgent' ? 'bg-red-500' :
                        task.priority === 'high' ? 'bg-orange-500' :
                        'bg-[#0033A0]'
                      }`} />
                      <span className={`flex-1 text-sm truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        {task.text}
                      </span>
                      {task.assigned_to && task.assigned_to !== currentUser.name && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          darkMode ? 'bg-white/10 text-white/50' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {task.assigned_to.split(' ')[0]}
                        </span>
                      )}
                    </button>
                  ))}
                  {stats.dueToday > 5 && (
                    <button
                      onClick={handleFilterDueToday}
                      className={`w-full text-center py-2 text-xs font-medium ${
                        darkMode ? 'text-[#72B5E8]' : 'text-[#0033A0]'
                      } hover:underline`}
                    >
                      +{stats.dueToday - 5} more due today
                    </button>
                  )}
                </div>
              ) : (
                <div className={`flex items-center gap-3 py-3 px-3 rounded-lg ${
                  darkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'
                }`}>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className={`text-sm ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    No tasks due today - you're ahead of schedule
                  </span>
                </div>
              )}

              {/* Coming Up Section - Only show if there's upcoming tasks */}
              {stats.upcoming > 0 && (
                <div className="mt-5 pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-white/50' : 'text-slate-400'}`}>
                      Coming Up
                    </span>
                    <span className={`text-xs ${darkMode ? 'text-white/40' : 'text-slate-400'}`}>
                      Next 7 days
                    </span>
                  </div>
                  <div className="space-y-1">
                    {stats.upcomingTasks.slice(0, 4).map((task) => (
                      <button
                        key={task.id}
                        onClick={handleNavigateToTasks}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
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
          </div>

          {/* Right Column - Team Health (for managers) or Insurance Summary */}
          <div className={`${hasTeam ? 'lg:col-span-2' : 'lg:col-span-1'} space-y-6`}>

            {/* Team Health - Simplified, action-oriented */}
            {hasTeam && managerData && (
              <Card>
                <SectionTitle icon={Users} title="Team Health" />

                {/* Quick Stats Row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className={`text-center p-2 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {managerData.teamOverview.totalActive}
                    </p>
                    <p className={`text-[10px] uppercase ${darkMode ? 'text-white/50' : 'text-slate-400'}`}>Active</p>
                  </div>
                  <div className={`text-center p-2 rounded-lg ${
                    managerData.teamOverview.totalOverdue > 0
                      ? darkMode ? 'bg-red-500/10' : 'bg-red-50'
                      : darkMode ? 'bg-white/5' : 'bg-slate-50'
                  }`}>
                    <p className={`text-xl font-bold ${
                      managerData.teamOverview.totalOverdue > 0 ? 'text-red-500' : darkMode ? 'text-white' : 'text-slate-900'
                    }`}>
                      {managerData.teamOverview.totalOverdue}
                    </p>
                    <p className={`text-[10px] uppercase ${darkMode ? 'text-white/50' : 'text-slate-400'}`}>Overdue</p>
                  </div>
                  <div className={`text-center p-2 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <p className={`text-xl font-bold text-emerald-500`}>
                      {managerData.teamOverview.weeklyTeamCompleted}
                    </p>
                    <p className={`text-[10px] uppercase ${darkMode ? 'text-white/50' : 'text-slate-400'}`}>This Week</p>
                  </div>
                </div>

                {/* Who Needs Help - Only show if there are issues */}
                {(managerData.bottlenecks.length > 0 || managerData.memberStats.some(m => m.overdueTasks > 0)) && (
                  <div className="mb-4">
                    <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${darkMode ? 'text-white/50' : 'text-slate-400'}`}>
                      Needs Attention
                    </div>
                    <div className="space-y-2">
                      {managerData.memberStats
                        .filter(m => m.overdueTasks > 0 || m.workloadLevel === 'overloaded')
                        .slice(0, 3)
                        .map((member) => (
                          <div
                            key={member.name}
                            className={`flex items-center gap-3 p-2.5 rounded-lg ${
                              member.workloadLevel === 'overloaded'
                                ? darkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'
                                : darkMode ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              member.workloadLevel === 'overloaded'
                                ? 'bg-red-500/20 text-red-500'
                                : 'bg-amber-500/20 text-amber-500'
                            }`}>
                              {member.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                {member.name}
                              </p>
                              <p className={`text-xs ${darkMode ? 'text-white/60' : 'text-slate-500'}`}>
                                {member.overdueTasks > 0 && `${member.overdueTasks} overdue`}
                                {member.overdueTasks > 0 && member.workloadLevel === 'overloaded' && ' · '}
                                {member.workloadLevel === 'overloaded' && `${member.activeTasks} tasks`}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Team Workload Bars - Compact */}
                <div>
                  <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${darkMode ? 'text-white/50' : 'text-slate-400'}`}>
                    Workload
                  </div>
                  <div className="space-y-2">
                    {managerData.memberStats.slice(0, 5).map((member) => (
                      <div key={member.name} className="flex items-center gap-2">
                        <span className={`w-20 text-xs truncate ${darkMode ? 'text-white/70' : 'text-slate-600'}`}>
                          {member.name.split(' ')[0]}
                        </span>
                        <div className={`flex-1 h-1.5 rounded-full ${darkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
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
                        <span className={`w-6 text-right text-xs ${darkMode ? 'text-white/50' : 'text-slate-400'}`}>
                          {member.activeTasks}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Insurance Workload - Only show categories with issues */}
            {hasTeam && (
              <Card>
                <SectionTitle icon={Shield} title="Insurance Tasks" />

                {/* Only show categories that have overdue items or significant active work */}
                {(() => {
                  const categories = [
                    { key: 'claim' as InsuranceTaskCategory, label: 'Claims', icon: FileText, color: 'text-red-500', bgColor: 'bg-red-500/10' },
                    { key: 'follow_up' as InsuranceTaskCategory, label: 'Follow-ups', icon: Phone, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
                    { key: 'payment' as InsuranceTaskCategory, label: 'Payments', icon: DollarSign, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
                    { key: 'vehicle_add' as InsuranceTaskCategory, label: 'Vehicle Adds', icon: Car, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
                    { key: 'policy_review' as InsuranceTaskCategory, label: 'Policy Reviews', icon: Shield, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
                  ];

                  // Prioritize categories with overdue items
                  const withOverdue = categories.filter(c => insuranceWorkload[c.key].overdue > 0);
                  const withActive = categories.filter(c => insuranceWorkload[c.key].active > 0 && insuranceWorkload[c.key].overdue === 0);
                  const relevantCategories = [...withOverdue, ...withActive].slice(0, 4);

                  if (relevantCategories.length === 0) {
                    return (
                      <div className={`text-center py-4 ${darkMode ? 'text-white/40' : 'text-slate-400'}`}>
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">All insurance tasks on track</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {relevantCategories.map(({ key, label, icon: Icon, color, bgColor }) => {
                        const data = insuranceWorkload[key];
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-3 p-2.5 rounded-lg ${
                              data.overdue > 0
                                ? darkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'
                                : darkMode ? 'bg-white/5' : 'bg-slate-50'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgColor}`}>
                              <Icon className={`w-4 h-4 ${color}`} />
                            </div>
                            <span className={`flex-1 text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                              {label}
                            </span>
                            <div className="flex items-center gap-2 text-xs">
                              {data.overdue > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-red-500 text-white font-medium">
                                  {data.overdue} late
                                </span>
                              )}
                              <span className={`${darkMode ? 'text-white/50' : 'text-slate-400'}`}>
                                {data.active} active
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </Card>
            )}

            {/* For non-managers, show a simple status card */}
            {!hasTeam && (
              <Card>
                <SectionTitle icon={CheckCircle2} title="Your Progress" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${darkMode ? 'text-white/70' : 'text-slate-600'}`}>Completed this week</span>
                    <span className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {stats.weeklyCompleted}
                    </span>
                  </div>
                  <div className={`h-2 rounded-full ${darkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(stats.weeklyRatio, 100)}%` }}
                    />
                  </div>
                  <p className={`text-xs ${darkMode ? 'text-white/50' : 'text-slate-400'}`}>
                    {stats.weeklyRatio}% of your weekly tasks completed
                  </p>
                </div>
              </Card>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
