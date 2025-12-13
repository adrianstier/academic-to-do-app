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
  Flame
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

  const getEmoji = () => {
    if (stats.completedToday === 0) return '💪';
    if (stats.completedToday < 3) return '⭐';
    if (stats.completedToday < 5) return '🔥';
    return '🏆';
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
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with gradient */}
            <div className="relative bg-gradient-to-br from-[#0033A0] to-indigo-600 p-6 text-white">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ rotate: -20 }}
                  animate={{ rotate: [-20, 20, -10, 10, 0] }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center"
                >
                  <Trophy className="w-8 h-8" />
                </motion.div>
                <div>
                  <h2 className="text-2xl font-bold">Your Progress</h2>
                  <p className="text-white/80 text-sm flex items-center gap-1">
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
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Completed Today */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Completed</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.totalCompleted}
                  </p>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">tasks done</p>
                </motion.div>

                {/* Total Tasks */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Total</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {todos.length}
                  </p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70">all tasks</p>
                </motion.div>

                {/* Streak */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Streak</span>
                  </div>
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {stats.streak}
                  </p>
                  <p className="text-xs text-orange-600/70 dark:text-orange-400/70">days active</p>
                </motion.div>

                {/* Productivity */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Done</span>
                  </div>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.productivity}%
                  </p>
                  <p className="text-xs text-purple-600/70 dark:text-purple-400/70">completion rate</p>
                </motion.div>
              </div>

              {/* Motivational Message */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 rounded-xl p-4 text-center"
              >
                <span className="text-2xl mb-2 block">{getEmoji()}</span>
                <p className="text-slate-700 dark:text-slate-200 font-medium">
                  {getMessage()}
                </p>
              </motion.div>

              {/* Close Button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={onClose}
                className="w-full mt-6 py-3 px-4 bg-[#0033A0] hover:bg-[#002880] text-white font-medium rounded-xl transition-colors"
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
