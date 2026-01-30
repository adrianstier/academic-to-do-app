'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlertCircle, Flag, ChevronRight } from 'lucide-react';
import { Todo, AuthUser, PRIORITY_CONFIG } from '@/types/todo';
import { supabase } from '@/lib/supabaseClient';

interface WelcomeBackNotificationProps {
  show: boolean;
  onClose: () => void;
  onViewProgress: () => void;
  todos: Todo[];
  currentUser: AuthUser;
  onUserUpdate: (user: AuthUser) => void;
}

const AUTO_DISMISS_MS = 8000; // Increased to give time to read high priority tasks

export default function WelcomeBackNotification({
  show,
  onClose,
  onViewProgress,
  todos,
  currentUser,
  onUserUpdate,
}: WelcomeBackNotificationProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [highPriorityTasks, setHighPriorityTasks] = useState<Todo[]>([]);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

      // Get recent high priority tasks (urgent or high, not completed)
      const highPriority = todos
        .filter(t => !t.completed && (t.priority === 'urgent' || t.priority === 'high'))
        .sort((a, b) => {
          // Sort by priority first (urgent before high), then by creation date
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          const priorityDiff = (priorityOrder[a.priority || 'medium'] || 2) - (priorityOrder[b.priority || 'medium'] || 2);
          if (priorityDiff !== 0) return priorityDiff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .slice(0, 3); // Show up to 3 high priority tasks

      setPendingCount(pending);
      setOverdueCount(overdue);
      setHighPriorityTasks(highPriority);
      setProgress(100);

      // Mark welcome as shown in database
      markWelcomeShown();

      // Auto-dismiss timer
      timerRef.current = setTimeout(() => {
        onClose();
      }, AUTO_DISMISS_MS);

      // Progress bar animation
      const step = 100 / (AUTO_DISMISS_MS / 50);
      intervalRef.current = setInterval(() => {
        setProgress(prev => Math.max(0, prev - step));
      }, 50);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const handleClick = () => {
    onClose();
    onViewProgress();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  // Pause auto-dismiss on hover
  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleMouseLeave = () => {
    const remaining = (progress / 100) * AUTO_DISMISS_MS;
    timerRef.current = setTimeout(() => {
      onClose();
    }, remaining);

    const step = 100 / (AUTO_DISMISS_MS / 50);
    intervalRef.current = setInterval(() => {
      setProgress(prev => Math.max(0, prev - step));
    }, 50);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: 0 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 20, x: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 right-4 z-50 w-full max-w-md cursor-pointer"
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          role="status"
          aria-live="polite"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Progress bar for auto-dismiss */}
            <div className="h-1 bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full bg-gradient-to-r from-[#2c5282] to-[#72B5E8] transition-all duration-50"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="p-4">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    Welcome back, {currentUser.name}!
                  </p>

                  {/* Stats inline */}
                  <div className="flex items-center gap-3 mt-1">
                    {pendingCount > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500 dark:text-slate-400">
                          {pendingCount} pending
                        </span>
                      </div>
                    )}
                    {overdueCount > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-red-600 dark:text-red-400">
                          {overdueCount} overdue
                        </span>
                      </div>
                    )}
                    {pendingCount === 0 && overdueCount === 0 && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        All caught up!
                      </span>
                    )}
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0"
                  aria-label="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* High Priority Tasks Section */}
              {highPriorityTasks.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Flag className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                      Priority Tasks
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {highPriorityTasks.map((task) => {
                      const priorityConfig = PRIORITY_CONFIG[task.priority || 'medium'];
                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 border-l-2"
                          style={{ borderLeftColor: priorityConfig.color }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: priorityConfig.color }}
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-200 truncate flex-1">
                            {task.text}
                          </span>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase"
                            style={{
                              backgroundColor: priorityConfig.bgColor,
                              color: priorityConfig.color,
                            }}
                          >
                            {task.priority}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Call to action */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Click to view all tasks
                </p>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Helper to safely access sessionStorage (handles private browsing mode)
function safeSessionStorageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    // sessionStorage may be unavailable in private browsing mode
    return null;
  }
}

function safeSessionStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    // sessionStorage may be unavailable in private browsing mode
    return false;
  }
}

// Helper to check if we should show the notification (using cloud data)
// Shows on first login of the session, and again after 4+ hours away
export function shouldShowWelcomeNotification(currentUser: AuthUser): boolean {
  const { welcome_shown_at } = currentUser;
  const now = new Date();

  // Check session storage to see if we've shown it this browser session
  const sessionShown = safeSessionStorageGet(`welcomeShown_${currentUser.id}`);
  if (sessionShown) {
    // Already shown this session, don't show again
    return false;
  }

  // Check if welcome was shown recently (in case of page refresh within session)
  if (welcome_shown_at) {
    const shownAt = new Date(welcome_shown_at);
    const hoursSinceShown = (now.getTime() - shownAt.getTime()) / (1000 * 60 * 60);
    // Don't show again if shown within last 4 hours
    if (hoursSinceShown < 4) return false;
  }

  // Mark as shown in session storage (best effort - may fail in private browsing)
  safeSessionStorageSet(`welcomeShown_${currentUser.id}`, 'true');

  return true;
}
