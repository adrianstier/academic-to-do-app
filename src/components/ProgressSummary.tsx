'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Flame,
  Dumbbell,
  Star,
  Sparkles,
  LucideIcon
} from 'lucide-react';
import { Todo, AuthUser } from '@/types/todo';
import { supabase } from '@/lib/supabase';

interface ProgressSummaryProps {
  show: boolean;
  onClose: () => void;
  todos: Todo[];
  currentUser: AuthUser;
  onUserUpdate: (user: AuthUser) => void;
}

interface DailyStats {
  completedToday: number;
  totalCompleted: number;
  streak: number;
  productivity: number;
}

export default function ProgressSummary({ show, onClose, todos, currentUser, onUserUpdate }: ProgressSummaryProps) {
  const [stats, setStats] = useState<DailyStats>({
    completedToday: 0,
    totalCompleted: 0,
    streak: 0,
    productivity: 0,
  });

  const calculateAndUpdateStreak = async () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const completedTodos = todos.filter(t => t.completed);

    // Calculate completed today (approximation based on todos that are completed)
    const completedToday = completedTodos.length;

    const productivity = todos.length > 0
      ? Math.round((completedTodos.length / todos.length) * 100)
      : 0;

    // Get current streak from user data
    let streak = currentUser.streak_count || 0;
    const lastStreakDate = currentUser.streak_last_date;

    // Update streak logic
    if (lastStreakDate) {
      const lastDate = new Date(lastStreakDate);
      lastDate.setHours(0, 0, 0, 0);
      const todayDate = new Date(todayStr);
      todayDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Same day, keep streak
      } else if (diffDays === 1) {
        // Next day, increment streak
        streak += 1;
        await updateStreakInDatabase(streak, todayStr);
      } else if (diffDays > 1) {
        // Streak broken, reset to 1
        streak = 1;
        await updateStreakInDatabase(streak, todayStr);
      }
    } else {
      // First time, start streak at 1
      streak = 1;
      await updateStreakInDatabase(streak, todayStr);
    }

    setStats({
      completedToday,
      totalCompleted: completedTodos.length,
      streak,
      productivity,
    });
  };

  const updateStreakInDatabase = async (streak: number, date: string) => {
    const { error } = await supabase
      .from('users')
      .update({
        streak_count: streak,
        streak_last_date: date
      })
      .eq('id', currentUser.id);

    if (!error) {
      // Update local user state
      onUserUpdate({
        ...currentUser,
        streak_count: streak,
        streak_last_date: date,
      });
    }
  };

  useEffect(() => {
    if (show) {
      calculateAndUpdateStreak();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const getMessage = () => {
    if (stats.completedToday === 0) {
      return "Ready to tackle some tasks? You've got this!";
    } else if (stats.completedToday < 3) {
      return "Great start! Keep the momentum going!";
    } else if (stats.completedToday < 5) {
      return "You're on fire! Excellent progress today!";
    } else {
      return "Incredible productivity! You're a task-crushing machine!";
    }
  };

  const getMotivationIcon = (): { Icon: LucideIcon; color: string } => {
    if (stats.completedToday === 0) return { Icon: Dumbbell, color: 'var(--accent)' };
    if (stats.completedToday < 3) return { Icon: Star, color: 'var(--warning)' };
    if (stats.completedToday < 5) return { Icon: Flame, color: '#EF4444' };
    return { Icon: Trophy, color: 'var(--success)' };
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="bg-[var(--surface)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with gradient */}
            <div className="relative bg-[var(--gradient-hero)] p-6 text-white">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ rotate: -20 }}
                  animate={{ rotate: [-20, 20, -10, 10, 0] }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] flex items-center justify-center shadow-lg"
                  style={{ boxShadow: '0 8px 24px rgba(0, 51, 160, 0.35)' }}
                >
                  <Trophy className="w-8 h-8 text-white" />
                </motion.div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Your Progress</h2>
                  <p className="text-white/70 text-sm flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3 mb-6">
                {/* Completed Today */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-[var(--success-light)] rounded-[var(--radius-lg)] p-4 border border-[var(--success)]/10"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
                    <span className="text-sm font-medium text-[var(--success)]">Completed</span>
                  </div>
                  <p className="text-3xl font-bold text-[var(--success)]">
                    {stats.totalCompleted}
                  </p>
                  <p className="text-xs text-[var(--success)]/70">tasks done</p>
                </motion.div>

                {/* Total Tasks */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-[var(--accent-light)] rounded-[var(--radius-lg)] p-4 border border-[var(--accent)]/10"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5 text-[var(--accent)]" />
                    <span className="text-sm font-medium text-[var(--accent)]">Total</span>
                  </div>
                  <p className="text-3xl font-bold text-[var(--accent)]">
                    {todos.length}
                  </p>
                  <p className="text-xs text-[var(--accent)]/70">all tasks</p>
                </motion.div>

                {/* Streak */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-[var(--warning-light)] rounded-[var(--radius-lg)] p-4 border border-[var(--warning)]/10"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-5 h-5 text-[var(--warning)]" />
                    <span className="text-sm font-medium text-[var(--warning)]">Streak</span>
                  </div>
                  <p className="text-3xl font-bold text-[var(--warning)]">
                    {stats.streak}
                  </p>
                  <p className="text-xs text-[var(--warning)]/70">days active</p>
                </motion.div>

                {/* Productivity */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-[var(--accent-gold-light)] rounded-[var(--radius-lg)] p-4 border border-[var(--accent-gold)]/10"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-[var(--accent-gold)]" />
                    <span className="text-sm font-medium text-[var(--accent-gold)]">Done</span>
                  </div>
                  <p className="text-3xl font-bold text-[var(--accent-gold)]">
                    {stats.productivity}%
                  </p>
                  <p className="text-xs text-[var(--accent-gold)]/70">completion rate</p>
                </motion.div>
              </div>

              {/* Motivational Message */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-[var(--surface-2)] rounded-[var(--radius-lg)] p-4 text-center border border-[var(--border-subtle)]"
              >
                {(() => {
                  const { Icon, color } = getMotivationIcon();
                  return (
                    <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                      <Icon className="w-6 h-6" style={{ color }} />
                    </div>
                  );
                })()}
                <p className="text-[var(--foreground)] font-medium">
                  {getMessage()}
                </p>
              </motion.div>

              {/* Close Button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={onClose}
                className="w-full mt-6 py-3.5 px-4 bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] hover:opacity-90 text-white font-semibold rounded-[var(--radius-lg)] transition-all shadow-[var(--shadow-blue)] active:scale-[0.98]"
              >
                Keep Going!
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
