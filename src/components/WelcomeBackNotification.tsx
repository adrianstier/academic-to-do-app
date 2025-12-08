'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { Todo, AuthUser } from '@/types/todo';
import { supabase } from '@/lib/supabase';

interface WelcomeBackNotificationProps {
  show: boolean;
  onClose: () => void;
  onViewProgress: () => void;
  todos: Todo[];
  currentUser: AuthUser;
  onUserUpdate: (user: AuthUser) => void;
}

export default function WelcomeBackNotification({
  show,
  onClose,
  onViewProgress,
  todos,
  currentUser,
  onUserUpdate,
}: WelcomeBackNotificationProps) {
  const [message, setMessage] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    if (show) {
      // Calculate stats
      const pending = todos.filter(t => !t.completed).length;
      const overdue = todos.filter(t => {
        if (!t.due_date || t.completed) return false;
        const d = new Date(t.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        d.setHours(0, 0, 0, 0);
        return d < today;
      }).length;

      setPendingCount(pending);
      setOverdueCount(overdue);

      // Generate personalized message based on time away
      const msg = generateMessage(currentUser.last_login, pending, overdue, currentUser.name);
      setMessage(msg);

      // Mark welcome as shown in database
      markWelcomeShown();
    }
  }, [show, todos, currentUser]);

  const markWelcomeShown = async () => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('users')
      .update({ welcome_shown_at: now })
      .eq('id', currentUser.id);

    if (!error) {
      onUserUpdate({
        ...currentUser,
        welcome_shown_at: now,
      });
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -20, x: '-50%' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-20 left-1/2 z-50 w-full max-w-md px-4"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Gradient accent bar */}
            <div className="h-1 bg-gradient-to-r from-[#0033A0] via-purple-500 to-emerald-500" />

            <div className="p-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0033A0] to-indigo-600 flex items-center justify-center flex-shrink-0"
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                      Welcome back, {currentUser.name}!
                    </h3>
                    <button
                      onClick={onClose}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {message}
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              {(pendingCount > 0 || overdueCount > 0) && (
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  {pendingCount > 0 && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="text-slate-600 dark:text-slate-300">
                        <strong>{pendingCount}</strong> pending
                      </span>
                    </div>
                  )}
                  {overdueCount > 0 && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-red-600 dark:text-red-400">
                        <strong>{overdueCount}</strong> overdue
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Button */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => {
                    onClose();
                    onViewProgress();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-[#0033A0] hover:bg-[#002880] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  View Progress
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function generateMessage(
  lastLoginAt: string | undefined,
  pendingCount: number,
  overdueCount: number,
  userName: string
): string {
  const messages = [];

  // Calculate time since last login
  if (lastLoginAt) {
    const lastLogin = new Date(lastLoginAt);
    const now = new Date();
    const hoursSince = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60));
    const daysSince = Math.floor(hoursSince / 24);

    if (daysSince >= 7) {
      messages.push(`It's been ${daysSince} days! We missed you.`);
    } else if (daysSince >= 2) {
      messages.push(`Good to see you after ${daysSince} days!`);
    } else if (hoursSince >= 24) {
      messages.push("A new day, new opportunities!");
    } else if (hoursSince >= 8) {
      messages.push("Hope you had a good break!");
    }
  }

  // Add task-related message
  if (overdueCount > 0) {
    messages.push(`You have ${overdueCount} overdue task${overdueCount > 1 ? 's' : ''} waiting for you.`);
  } else if (pendingCount > 0) {
    if (pendingCount === 1) {
      messages.push("Just one task to tackle today!");
    } else if (pendingCount <= 3) {
      messages.push(`Only ${pendingCount} tasks - you've got this!`);
    } else {
      messages.push(`${pendingCount} tasks ready for your attention.`);
    }
  } else {
    messages.push("All caught up! Ready to add some new tasks?");
  }

  // Return combined or single message
  return messages.length > 1 ? messages.join(' ') : messages[0] || "Let's make today productive!";
}

// Helper to check if we should show the notification (using cloud data)
export function shouldShowWelcomeNotification(currentUser: AuthUser): boolean {
  const { last_login, welcome_shown_at } = currentUser;

  if (!last_login) return false;

  const lastLogin = new Date(last_login);
  const now = new Date();
  const hoursSinceLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);

  // Don't show if logged in less than 4 hours ago
  if (hoursSinceLogin < 4) return false;

  // Check if welcome was already shown recently
  if (welcome_shown_at) {
    const shownAt = new Date(welcome_shown_at);
    const hoursSinceShown = (now.getTime() - shownAt.getTime()) / (1000 * 60 * 60);
    // Don't show again if shown within last 4 hours
    if (hoursSinceShown < 4) return false;
  }

  return true;
}
