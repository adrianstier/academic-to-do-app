'use client';

import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { LayoutList, LayoutGrid, Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { AuthUser, ViewMode, ActivityLogEntry } from '@/types/todo';
import UserSwitcher from '../UserSwitcher';
import AppMenu from '../AppMenu';
import FocusModeToggle from '../FocusModeToggle';
import NotificationModal from '../NotificationModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useTodoStore } from '@/store/todoStore';
import { useAppShell } from '../layout/AppShell';
import { supabase } from '@/lib/supabaseClient';

interface TodoHeaderProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  canViewArchive: boolean;
  setShowActivityFeed: (show: boolean) => void;
  setShowArchiveView: (show: boolean) => void;
  setShowStrategicDashboard: (show: boolean) => void;
  setShowWeeklyChart: (show: boolean) => void;
  setShowShortcuts: (show: boolean) => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (show: boolean) => void;
  onResetFilters: () => void;
}

/**
 * TodoHeader - Unified single-row header component
 *
 * Layout:
 * - Left side: View toggle (List/Board), Focus mode toggle
 * - Right side: User switcher, Menu button
 *
 * Hidden in focus mode except for the focus mode toggle button.
 */
// Local storage key for last seen notification
const LAST_SEEN_KEY = 'notificationLastSeenAt';

function TodoHeader({
  currentUser,
  onUserChange,
  viewMode,
  setViewMode,
  canViewArchive,
  setShowActivityFeed,
  setShowArchiveView,
  setShowStrategicDashboard,
  setShowWeeklyChart,
  setShowShortcuts,
  showAdvancedFilters,
  setShowAdvancedFilters,
  onResetFilters,
}: TodoHeaderProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const userName = currentUser.name;
  const { focusMode } = useTodoStore((state) => state.ui);
  const { setActiveView } = useAppShell();

  // Notification state
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);

  // Calculate unread notifications count
  const updateUnreadCount = useCallback(() => {
    if (typeof window === 'undefined') return;

    const lastSeenStr = localStorage.getItem(LAST_SEEN_KEY);
    const lastSeen = lastSeenStr ? new Date(lastSeenStr) : new Date(0);

    const fetchCount = async () => {
      try {
        const { count, error } = await supabase
          .from('activity_log')
          .select('*', { count: 'exact', head: true })
          .gt('created_at', lastSeen.toISOString())
          .neq('user_name', currentUser.name);

        if (!error && count !== null) {
          setUnreadNotifications(count);
        }
      } catch {
        // Silently fail - not critical
      }
    };

    fetchCount();
  }, [currentUser.name]);

  // Update unread count on mount
  useEffect(() => {
    updateUnreadCount();
  }, [updateUnreadCount]);

  // Subscribe to real-time activity updates for badge count
  useEffect(() => {
    const channel = supabase
      .channel('notification-badge-header')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
        },
        (payload) => {
          const newActivity = payload.new as ActivityLogEntry;
          // Only increment if from another user and modal is closed
          if (newActivity.user_name !== currentUser.name && !notificationModalOpen) {
            setUnreadNotifications(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.name, notificationModalOpen]);

  // Handle notification click - navigate to task or activity view
  const handleNotificationClick = useCallback((activity: ActivityLogEntry) => {
    // If there's a related todo, navigate to tasks and highlight it
    if (activity.todo_id) {
      setActiveView('tasks');
      // Small delay to ensure view switches, then scroll to task
      setTimeout(() => {
        const taskElement = document.getElementById(`todo-${activity.todo_id}`);
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          taskElement.classList.add('ring-2', 'ring-[var(--accent)]', 'ring-offset-2');
          setTimeout(() => {
            taskElement.classList.remove('ring-2', 'ring-[var(--accent)]', 'ring-offset-2');
          }, 3000);
        }
      }, 100);
    } else {
      // Otherwise go to full activity view
      setActiveView('activity');
    }
  }, [setActiveView]);

  // Mark notifications as read when modal closes
  const handleMarkAllRead = useCallback(() => {
    setUnreadNotifications(0);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b ${
        darkMode
          ? 'bg-[var(--surface)] border-white/5'
          : 'bg-white border-[var(--border)]'
      }`}
    >
      <div className="mx-auto px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Left side: View toggle & Focus mode toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* View toggle - hidden in focus mode */}
            {!focusMode && (
              <div
                className={`flex backdrop-blur-sm rounded-lg sm:rounded-xl p-0.5 sm:p-1 border ${
                  darkMode
                    ? 'bg-white/8 border-white/10'
                    : 'bg-[var(--surface-2)] border-[var(--border)]'
                }`}
              >
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs font-medium transition-all duration-200 ${
                    viewMode === 'list'
                      ? 'bg-[var(--brand-sky)] text-[var(--brand-navy)] shadow-md'
                      : darkMode
                        ? 'text-white/70 hover:text-white hover:bg-white/10'
                        : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-3)]'
                  }`}
                  aria-pressed={viewMode === 'list'}
                  aria-label="List view"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs font-medium transition-all duration-200 ${
                    viewMode === 'kanban'
                      ? 'bg-[var(--brand-sky)] text-[var(--brand-navy)] shadow-md'
                      : darkMode
                        ? 'text-white/70 hover:text-white hover:bg-white/10'
                        : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-3)]'
                  }`}
                  aria-pressed={viewMode === 'kanban'}
                  aria-label="Board view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Board</span>
                </button>
              </div>
            )}

            {/* Focus Mode Toggle - always visible */}
            <FocusModeToggle />
          </div>

          {/* Right side: Notifications, User switcher & Menu - hidden in focus mode */}
          {!focusMode && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Notification Bell - Top right like Facebook/LinkedIn */}
              <div className="relative">
                <button
                  ref={notificationButtonRef}
                  onClick={() => setNotificationModalOpen(!notificationModalOpen)}
                  className={`
                    relative p-2 rounded-lg transition-colors
                    ${notificationModalOpen
                      ? darkMode
                        ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                        : 'bg-[var(--accent-light)] text-[var(--accent)]'
                      : darkMode
                        ? 'text-white/60 hover:text-white hover:bg-white/10'
                        : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                    }
                  `}
                  aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}`}
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotifications > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full text-[10px] font-bold bg-[var(--danger)] text-white"
                    >
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </motion.span>
                  )}
                </button>

                {/* Notification Modal */}
                <NotificationModal
                  currentUserName={currentUser.name}
                  isOpen={notificationModalOpen}
                  onClose={() => setNotificationModalOpen(false)}
                  onActivityClick={handleNotificationClick}
                  onMarkAllRead={handleMarkAllRead}
                  anchorRef={notificationButtonRef}
                  onViewAllActivity={() => setActiveView('activity')}
                />
              </div>

              <UserSwitcher currentUser={currentUser} onUserChange={onUserChange} />

              <AppMenu
                userName={userName}
                canViewArchive={canViewArchive}
                onShowActivityFeed={() => setShowActivityFeed(true)}
                onShowWeeklyChart={() => setShowWeeklyChart(true)}
                onShowStrategicDashboard={() => setShowStrategicDashboard(true)}
                onShowArchive={() => setShowArchiveView(true)}
                onShowShortcuts={() => setShowShortcuts(true)}
                onShowAdvancedFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
                onResetFilters={onResetFilters}
                showAdvancedFilters={showAdvancedFilters}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default memo(TodoHeader);
