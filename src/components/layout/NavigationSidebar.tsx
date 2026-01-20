'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  CheckSquare,
  MessageCircle,
  Activity,
  Target,
  Archive,
  ChevronLeft,
  ChevronRight,
  Search,
  LogOut,
  Moon,
  Sun,
  Plus,
  Command,
  Inbox,
  Bell,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthUser, OWNER_USERNAME, ActivityLogEntry } from '@/types/todo';
import { useAppShell, ActiveView } from './AppShell';
import NotificationModal from '../NotificationModal';
import { supabase } from '@/lib/supabaseClient';

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION SIDEBAR
// A refined, collapsible navigation with clear visual hierarchy
// Inspired by Linear, Notion, and Figma's elegant sidebar patterns
// ═══════════════════════════════════════════════════════════════════════════

interface NavigationSidebarProps {
  currentUser: AuthUser;
  onUserChange?: (user: AuthUser | null) => void;
}

interface NavItem {
  id: ActiveView;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  badgeColor?: string;
  ownerOnly?: boolean;
}

const primaryNavItems: NavItem[] = [
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'ai_inbox', label: 'AI Inbox', icon: Inbox },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'chat', label: 'Messages', icon: MessageCircle },
];

const secondaryNavItems: NavItem[] = [
  { id: 'goals', label: 'Strategic Goals', icon: Target, ownerOnly: true },
  { id: 'archive', label: 'Archive', icon: Archive },
];

export default function NavigationSidebar({
  currentUser,
  onUserChange,
}: NavigationSidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';
  const {
    activeView,
    setActiveView,
    sidebarCollapsed,
    toggleSidebar,
    openCommandPalette,
    openRightPanel,
    triggerNewTask,
  } = useAppShell();

  const [hovering, setHovering] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [activityCount, setActivityCount] = useState(0);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);

  // Track last seen notification timestamp
  const LAST_SEEN_KEY = 'notificationLastSeenAt';
  // Track last seen activity timestamp for Activity nav badge
  const ACTIVITY_LAST_SEEN_KEY = 'activityLastSeenAt';

  // Calculate unread notifications count
  const updateUnreadCount = useCallback(() => {
    if (typeof window === 'undefined') return;

    const lastSeenStr = localStorage.getItem(LAST_SEEN_KEY);
    const lastSeen = lastSeenStr ? new Date(lastSeenStr) : new Date(0);

    // Fetch count of activities since last seen
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

  // Calculate unread activity count for Activity nav badge
  const updateActivityCount = useCallback(() => {
    if (typeof window === 'undefined') return;

    const lastSeenStr = localStorage.getItem(ACTIVITY_LAST_SEEN_KEY);
    const lastSeen = lastSeenStr ? new Date(lastSeenStr) : new Date(0);

    const fetchActivityCount = async () => {
      try {
        const { count, error } = await supabase
          .from('activity_log')
          .select('*', { count: 'exact', head: true })
          .gt('created_at', lastSeen.toISOString());

        if (!error && count !== null) {
          setActivityCount(count);
        }
      } catch {
        // Silently fail - not critical
      }
    };

    fetchActivityCount();
  }, []);

  // Update unread count on mount and when modal closes
  useEffect(() => {
    updateUnreadCount();
  }, [updateUnreadCount]);

  // Update activity count on mount and when navigating away from activity view
  useEffect(() => {
    updateActivityCount();
  }, [updateActivityCount]);

  // Mark activity as seen when user navigates to the Activity view
  useEffect(() => {
    if (activeView === 'activity') {
      // Mark as seen after a short delay to allow the view to load
      const timeout = setTimeout(() => {
        localStorage.setItem(ACTIVITY_LAST_SEEN_KEY, new Date().toISOString());
        setActivityCount(0);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [activeView]);

  // Subscribe to real-time activity updates for badge count
  useEffect(() => {
    const channel = supabase
      .channel('notification-badge')
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

  // Subscribe to real-time activity updates for Activity nav badge
  useEffect(() => {
    const channel = supabase
      .channel('activity-nav-badge')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
        },
        () => {
          // Only increment if not currently viewing activity
          if (activeView !== 'activity') {
            setActivityCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeView]);

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

  // Determine if the sidebar should be expanded (collapsed=false OR hovering while collapsed)
  const isExpanded = !sidebarCollapsed || hovering;

  // Keyboard shortcut hint
  const shortcutKey = typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';

  const handleLogout = () => {
    if (onUserChange) {
      localStorage.removeItem('todoSession');
      onUserChange(null);
    }
  };

  const navItemClass = (isActive: boolean) => `
    group relative flex items-center gap-3 px-3 py-2.5 rounded-xl
    font-medium text-sm transition-all duration-150 cursor-pointer
    ${isActive
      ? darkMode
        ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
        : 'bg-[var(--accent-light)] text-[var(--accent)]'
      : darkMode
        ? 'text-white/60 hover:text-white hover:bg-white/5'
        : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
    }
  `;

  const iconClass = (isActive: boolean) => `
    w-5 h-5 flex-shrink-0 transition-colors
    ${isActive
      ? 'text-[var(--accent)]'
      : darkMode
        ? 'text-white/40 group-hover:text-white/70'
        : 'text-[var(--text-muted)] group-hover:text-[var(--foreground)]'
    }
  `;

  return (
    <motion.aside
      initial={false}
      animate={{
        width: isExpanded ? 260 : 72,
      }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => sidebarCollapsed && setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`
        hidden md:flex flex-col flex-shrink-0 overflow-hidden
        border-r transition-colors
        ${darkMode
          ? 'bg-[var(--surface)] border-white/10'
          : 'bg-white border-[var(--border)]'
        }
      `}
      aria-label="Main navigation"
    >
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-[var(--border-subtle)]">
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 overflow-hidden"
            >
              {/* Logo/Brand */}
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <div className="overflow-hidden">
                <h1 className={`font-semibold text-sm truncate ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                  Bealer Agency
                </h1>
                <p className={`text-xs truncate ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
                  Task Manager
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] flex items-center justify-center mx-auto"
            >
              <span className="text-white font-bold text-sm">B</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification Bell - Prominent position in header */}
        <div className="flex items-center gap-1">
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
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full text-[10px] font-bold bg-[var(--danger)] text-white"
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
            />
          </div>

          {/* Collapse toggle - only visible when expanded */}
          {isExpanded && (
            <button
              onClick={toggleSidebar}
              className={`
                p-1.5 rounded-lg transition-colors
                ${darkMode
                  ? 'text-white/40 hover:text-white hover:bg-white/10'
                  : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                }
              `}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* ─── Search / Command Bar ─── */}
      <div className="px-3 py-3">
        <button
          onClick={openCommandPalette}
          className={`
            w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
            transition-all border
            ${darkMode
              ? 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
              : 'bg-[var(--surface-2)] border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]'
            }
          `}
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          {isExpanded && (
            <>
              <span className="flex-1 text-left text-sm">Search...</span>
              <kbd className={`
                hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium
                ${darkMode
                  ? 'bg-white/10 text-white/40'
                  : 'bg-[var(--surface)] text-[var(--text-light)]'
                }
              `}>
                <Command className="w-3 h-3" />K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* ─── Quick Add Button ─── */}
      <div className="px-3 pb-2">
        <button
          onClick={triggerNewTask}
          className={`
            w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
            font-medium text-sm transition-all
            bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-blue-light)]
            text-white shadow-md hover:shadow-lg hover:brightness-110
          `}
        >
          <Plus className="w-4 h-4" />
          {isExpanded && <span>New Task</span>}
        </button>
      </div>

      {/* ─── Primary Navigation ─── */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto" aria-label="Primary">
        {primaryNavItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const badge = item.id === 'chat' ? unreadMessages : item.id === 'activity' ? activityCount : 0;

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={navItemClass(isActive)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={iconClass(isActive)} />
              {isExpanded && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {badge > 0 && (
                    <span className={`
                      min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full text-xs font-semibold
                      ${darkMode
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--accent)] text-white'
                      }
                    `}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </>
              )}

              {/* Collapsed badge indicator */}
              {!isExpanded && badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--accent)]" />
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div className={`my-3 border-t ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}`} />

        {/* Section label */}
        {isExpanded && (
          <p className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-white/30' : 'text-[var(--text-light)]'}`}>
            More
          </p>
        )}

        {/* Secondary Navigation */}
        {secondaryNavItems
          .filter(item => !item.ownerOnly || currentUser.name === OWNER_USERNAME)
          .map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={navItemClass(isActive)}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={iconClass(isActive)} />
                {isExpanded && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
              </button>
            );
          })}
      </nav>

      {/* ─── Footer / User Section ─── */}
      <div className={`
        border-t px-3 py-3 space-y-2
        ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}
      `}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`
            w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
            transition-colors
            ${darkMode
              ? 'text-white/60 hover:text-white hover:bg-white/10'
              : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
            }
          `}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isExpanded && <span className="text-sm">{darkMode ? 'Light' : 'Dark'}</span>}
        </button>

        {/* User profile */}
        <div className={`
          flex items-center gap-3 px-3 py-2.5 rounded-xl
          transition-colors cursor-pointer
          ${darkMode
            ? 'hover:bg-white/5'
            : 'hover:bg-[var(--surface-2)]'
          }
        `}>
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
            style={{ backgroundColor: currentUser.color }}
          >
            {currentUser.name[0]}
          </div>

          {isExpanded && (
            <>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                  {currentUser.name}
                </p>
                <p className={`text-xs truncate ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
                  {currentUser.role === 'admin' ? 'Administrator' : 'Team Member'}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className={`
                  p-1.5 rounded-lg transition-colors
                  ${darkMode
                    ? 'text-white/40 hover:text-white hover:bg-white/10'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                  }
                `}
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
