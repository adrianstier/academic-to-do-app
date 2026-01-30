'use client';

import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { Todo, AuthUser } from '@/types/todo';
import { Card, Badge, Button, ProgressRing } from '@/components/ui';
import DailyDigestPanel from '@/components/dashboard/DailyDigestPanel';

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

interface UpcomingTask {
  id: string;
  text: string;
  due_date: string;
  priority: string;
}

export default function Dashboard({
  todos,
  currentUser,
  onNavigateToTasks,
  onAddTask,
  onFilterOverdue,
  onFilterDueToday,
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

    // Get first upcoming task for "Next Up" display
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

    // Weekly ratio: completed vs total tasks touched this week
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
      hasActionableWork: overdue.length > 0 || dueToday.length > 0 || nextTask !== null,
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

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[var(--background)]' : 'bg-[var(--background)]'}`}>
      {/* Header - Academic gradient using brand colors */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: darkMode
              ? 'linear-gradient(135deg, var(--brand-navy) 0%, #2c5282 50%, #3b6ea8 100%)'
              : 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-blue) 50%, var(--brand-blue-light) 100%)',
          }}
        />

        <div className="relative max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          {/* Greeting row */}
          <div className="flex items-center gap-2 mb-1">
            <greeting.Icon className="w-4 h-4 text-white/60" />
            <span className="text-white/60 text-sm font-medium">{greeting.text}</span>
          </div>

          {/* Name */}
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
            {currentUser.name}
          </h1>

          {/* Single contextual stat */}
          <p className="text-white/70 text-sm">
            {stats.weeklyCompleted} completed this week
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-6 py-6 space-y-5">
        {/* Daily Digest Panel - auto-loads AI briefing */}
        <DailyDigestPanel
          currentUser={currentUser}
          onFilterOverdue={onFilterOverdue}
          onFilterDueToday={onFilterDueToday}
          defaultExpanded={true}
        />

        {/* Overdue Alert - Primary CTA when there are overdue tasks */}
        {stats.overdue > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              variant="brand"
              size="lg"
              fullWidth
              onClick={onFilterOverdue}
              leftIcon={<AlertTriangle className="w-5 h-5" />}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="justify-between"
            >
              <div className="flex-1 text-left">
                <span className="font-semibold">{stats.overdue} overdue task{stats.overdue !== 1 ? 's' : ''}</span>
                <span className="text-white/70 text-sm ml-2">need attention</span>
              </div>
            </Button>
          </motion.div>
        )}

        {/* Today's Tasks */}
        <Card variant="default" padding="lg" radius="2xl">
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 text-[var(--text-muted)]">
            Today
          </h3>

          {stats.dueToday > 0 ? (
            <div className="space-y-2">
              {stats.dueTodayTasks.slice(0, 3).map((task) => (
                <button
                  key={task.id}
                  onClick={onFilterDueToday}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors hover:bg-[var(--surface-2)]"
                >
                  <Badge
                    variant={
                      task.priority === 'urgent' ? 'danger' :
                      task.priority === 'high' ? 'warning' :
                      'primary'
                    }
                    size="sm"
                    dot
                  />
                  <span className="flex-1 text-sm font-medium truncate text-[var(--foreground)]">
                    {task.text}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              ))}
              {stats.dueToday > 3 && (
                <button
                  onClick={onFilterDueToday}
                  className="w-full text-center py-2 text-sm font-medium text-[var(--accent)] hover:underline"
                >
                  +{stats.dueToday - 3} more due today
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 py-2">
              <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
              <span className="text-sm text-[var(--text-secondary)]">
                No tasks due today
              </span>
            </div>
          )}
        </Card>

        {/* Next Up - only show if there's something coming */}
        {stats.nextTask && (
          <Card variant="default" padding="lg" radius="2xl">
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4 text-[var(--text-muted)]">
              Next Up
            </h3>

            <button
              onClick={onNavigateToTasks}
              className="w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-colors hover:bg-[var(--surface-2)]"
            >
              <div className="mt-1">
                <Badge
                  variant={
                    stats.nextTask.priority === 'urgent' ? 'danger' :
                    stats.nextTask.priority === 'high' ? 'warning' :
                    'primary'
                  }
                  size="sm"
                  dot
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-[var(--foreground)]">
                  {stats.nextTask.text}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-muted)]">
                    {formatDueDate(stats.nextTask.due_date)}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] mt-1" />
            </button>
          </Card>
        )}

        {/* Weekly Progress */}
        <Card variant="default" padding="lg" radius="2xl">
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--foreground)]">
                Weekly Progress
              </h3>
              <p className="text-sm mt-1 text-[var(--text-muted)]">
                {stats.weeklyCompleted} of {stats.weeklyTotal} tasks completed
              </p>
            </div>
            <ProgressRing
              progress={stats.weeklyRatio}
              size={56}
              strokeWidth={5}
              color={
                stats.weeklyRatio >= 50 ? 'var(--success)' :
                stats.weeklyRatio >= 25 ? 'var(--warning)' :
                'var(--brand-blue)'
              }
              trackColor="var(--surface-3)"
              showPercentage
              animationDuration={0.6}
            />
          </div>

          {/* Daily breakdown */}
          <p className="text-xs font-medium uppercase tracking-wide mb-3 text-[var(--text-muted)]">
            Tasks completed each day
          </p>

          <div className="flex items-end justify-between gap-3 h-20">
            {stats.weekData.map((day, index) => {
              const height = stats.maxDaily > 0 ? (day.completed / stats.maxDaily) * 100 : 0;
              return (
                <motion.div
                  key={day.dayName}
                  className="flex-1 flex flex-col items-center gap-1.5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <span className={`text-xs font-semibold ${
                    day.completed > 0
                      ? 'text-[var(--foreground)]'
                      : 'text-[var(--text-muted)]'
                  }`}>
                    {day.completed}
                  </span>

                  <div className="w-full flex-1 flex flex-col justify-end min-h-[20px]">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(height, 8)}%` }}
                      transition={{ delay: 0.2 + index * 0.05, duration: 0.4 }}
                      className={`w-full rounded-sm ${
                        day.isToday
                          ? 'bg-[var(--brand-blue)]'
                          : day.completed > 0
                            ? 'bg-[var(--brand-blue)]/30'
                            : 'bg-[var(--surface-3)]'
                      }`}
                    />
                  </div>

                  <span className={`text-xs ${
                    day.isToday
                      ? 'text-[var(--brand-blue)] font-semibold'
                      : 'text-[var(--text-muted)]'
                  }`}>
                    {day.dayName}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </Card>

        {/* Action Buttons - Priority based on context */}
        <div className="grid grid-cols-2 gap-4">
          {stats.overdue > 0 ? (
            <>
              {/* When overdue exists, View All is secondary */}
              <Button
                variant="secondary"
                size="lg"
                onClick={onNavigateToTasks}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                View All Tasks
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={onAddTask}
                leftIcon={<Plus className="w-5 h-5" />}
              >
                Add Task
              </Button>
            </>
          ) : (
            <>
              {/* No overdue - Add Task can be more prominent */}
              <Button
                variant="brand"
                size="lg"
                onClick={onAddTask}
                leftIcon={<Plus className="w-5 h-5" />}
              >
                Add Task
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={onNavigateToTasks}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                View All Tasks
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
