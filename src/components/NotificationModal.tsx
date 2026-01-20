'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  X,
  Activity,
  Clock,
  User,
  CheckCircle2,
  Circle,
  ArrowRight,
  Flag,
  Calendar,
  StickyNote,
  ListTodo,
  Trash2,
  RefreshCw,
  Paperclip,
  GitMerge,
  BellRing,
  Settings,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { ActivityLogEntry, ActivityAction, PRIORITY_CONFIG } from '@/types/todo';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import { fetchWithCsrf } from '@/lib/csrf';
import { useTheme } from '@/contexts/ThemeContext';

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION MODAL - Facebook-style notification dropdown
// Shows recent activity with clickable items to navigate to related tasks
// ═══════════════════════════════════════════════════════════════════════════

interface NotificationModalProps {
  currentUserName: string;
  isOpen: boolean;
  onClose: () => void;
  onActivityClick?: (activity: ActivityLogEntry) => void;
  onMarkAllRead?: () => void;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
  onViewAllActivity?: () => void;
}

const ACTION_CONFIG: Record<ActivityAction, { icon: React.ElementType; label: string; color: string; verb: string }> = {
  task_created: { icon: Circle, label: 'created task', color: '#10b981', verb: 'created' },
  task_updated: { icon: RefreshCw, label: 'updated task', color: '#3b82f6', verb: 'updated' },
  task_deleted: { icon: Trash2, label: 'deleted task', color: '#ef4444', verb: 'deleted' },
  task_completed: { icon: CheckCircle2, label: 'completed task', color: '#10b981', verb: 'completed' },
  task_reopened: { icon: Circle, label: 'reopened task', color: '#f59e0b', verb: 'reopened' },
  status_changed: { icon: ArrowRight, label: 'changed status', color: '#8b5cf6', verb: 'moved' },
  priority_changed: { icon: Flag, label: 'changed priority', color: '#f59e0b', verb: 'reprioritized' },
  assigned_to_changed: { icon: User, label: 'reassigned task', color: '#3b82f6', verb: 'assigned' },
  due_date_changed: { icon: Calendar, label: 'updated due date', color: '#3b82f6', verb: 'rescheduled' },
  subtask_added: { icon: ListTodo, label: 'added subtask', color: '#10b981', verb: 'added subtask to' },
  subtask_completed: { icon: CheckCircle2, label: 'completed subtask', color: '#10b981', verb: 'completed subtask in' },
  subtask_deleted: { icon: Trash2, label: 'removed subtask', color: '#ef4444', verb: 'removed subtask from' },
  notes_updated: { icon: StickyNote, label: 'updated notes', color: '#8b5cf6', verb: 'noted on' },
  template_created: { icon: Activity, label: 'created template', color: '#10b981', verb: 'created template' },
  template_used: { icon: Activity, label: 'used template', color: '#3b82f6', verb: 'used template on' },
  attachment_added: { icon: Paperclip, label: 'added attachment', color: '#10b981', verb: 'attached to' },
  attachment_removed: { icon: Paperclip, label: 'removed attachment', color: '#ef4444', verb: 'removed attachment from' },
  tasks_merged: { icon: GitMerge, label: 'merged tasks', color: '#0033A0', verb: 'merged' },
  reminder_added: { icon: Bell, label: 'added reminder', color: '#8b5cf6', verb: 'set reminder for' },
  reminder_removed: { icon: BellOff, label: 'removed reminder', color: '#ef4444', verb: 'removed reminder from' },
  reminder_sent: { icon: BellRing, label: 'sent reminder', color: '#10b981', verb: 'reminder sent for' },
};

// Local storage key for last seen notification
const LAST_SEEN_KEY = 'notificationLastSeenAt';

export default function NotificationModal({
  currentUserName,
  isOpen,
  onClose,
  onActivityClick,
  onMarkAllRead,
  anchorRef,
  onViewAllActivity,
}: NotificationModalProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const modalRef = useRef<HTMLDivElement>(null);

  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  // Load last seen timestamp
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LAST_SEEN_KEY);
      if (stored) {
        setLastSeenAt(stored);
      }
    }
  }, []);

  // Fetch recent activities when modal opens
  const fetchActivities = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithCsrf(
        `/api/activity?userName=${encodeURIComponent(currentUserName)}&limit=30&offset=0`
      );
      if (response.ok) {
        const data = await response.json();
        setActivities(data);
      } else {
        setError('Failed to load notifications');
      }
    } catch (err) {
      logger.error('Failed to fetch notifications', err, { component: 'NotificationModal' });
      setError('Unable to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, currentUserName]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Mark all as read when modal closes
  useEffect(() => {
    if (!isOpen && activities.length > 0) {
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SEEN_KEY, now);
      setLastSeenAt(now);
      onMarkAllRead?.();
    }
  }, [isOpen, activities.length, onMarkAllRead]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel('notification-modal')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
        },
        (payload) => {
          const newActivity = payload.new as ActivityLogEntry;
          setActivities((prev) => [newActivity, ...prev].slice(0, 30));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Check if activity is unread (happened after last seen)
  const isUnread = useCallback(
    (activity: ActivityLogEntry) => {
      if (!lastSeenAt) return true;
      return new Date(activity.created_at) > new Date(lastSeenAt);
    },
    [lastSeenAt]
  );

  // Count unread
  const unreadCount = useMemo(() => {
    return activities.filter(isUnread).length;
  }, [activities, isUnread]);

  // Handle activity click
  const handleActivityClick = (activity: ActivityLogEntry) => {
    onActivityClick?.(activity);
    onClose();
  };

  // Handle mark all as read button click
  const handleMarkAllReadClick = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem(LAST_SEEN_KEY, now);
    setLastSeenAt(now);
    onMarkAllRead?.();
  }, [onMarkAllRead]);

  // Calculate position based on anchor element
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const modalWidth = 380;
      const modalHeight = 520;
      const padding = 16;

      // Position below the bell button
      let top = rect.bottom + 8;
      let left = rect.left;

      // Ensure modal doesn't go off-screen to the right
      if (left + modalWidth > window.innerWidth - padding) {
        left = window.innerWidth - modalWidth - padding;
      }

      // Ensure modal doesn't go off-screen to the left
      if (left < padding) {
        left = padding;
      }

      // Ensure modal doesn't go off-screen at the bottom
      if (top + modalHeight > window.innerHeight - padding) {
        // Position above the button instead
        top = rect.top - modalHeight - 8;
        if (top < padding) {
          top = padding;
        }
      }

      setPosition({ top, left });
    }
  }, [isOpen, anchorRef]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
          }}
          className={`
            z-[100] w-[380px] max-h-[520px] rounded-xl overflow-hidden
            shadow-2xl border
            ${darkMode
              ? 'bg-[var(--surface)] border-white/10'
              : 'bg-white border-[var(--border)]'
            }
          `}
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className={`
            flex items-center justify-between px-4 py-3 border-b
            ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}
          `}>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[var(--accent)]" />
              <h2 className={`font-semibold ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent)] text-white">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllReadClick}
                  className={`
                    px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${darkMode
                      ? 'text-[var(--accent)] hover:bg-[var(--accent)]/10'
                      : 'text-[var(--accent)] hover:bg-[var(--accent-light)]'
                    }
                  `}
                  aria-label="Mark all notifications as read"
                >
                  Mark all as read
                </button>
              )}
              <button
                onClick={onClose}
                className={`
                  p-1.5 rounded-lg transition-colors
                  ${darkMode
                    ? 'text-white/40 hover:text-white hover:bg-white/10'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                  }
                `}
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[420px]">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto border-[var(--accent)]" />
                <p className="mt-3 text-sm text-[var(--text-muted)]">Loading notifications...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 mx-auto mb-3 opacity-50 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
                <button
                  onClick={fetchActivities}
                  className={`
                    mt-3 px-4 py-2 text-sm rounded-lg transition-colors
                    ${darkMode
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--foreground)]'
                    }
                  `}
                >
                  Try Again
                </button>
              </div>
            ) : activities.length === 0 ? (
              <div className="p-10 text-center">
                <motion.div
                  className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                    darkMode
                      ? 'bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10'
                      : 'bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200'
                  }`}
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <BellRing className={`w-8 h-8 ${darkMode ? 'text-white/30' : 'text-slate-400'}`} />
                </motion.div>
                <p className={`font-semibold text-base ${darkMode ? 'text-white/80' : 'text-slate-700'}`}>
                  No notifications yet
                </p>
                <p className={`text-sm mt-2 max-w-[200px] mx-auto ${darkMode ? 'text-white/40' : 'text-slate-500'}`}>
                  When there is activity on your tasks, you will be notified here
                </p>
              </div>
            ) : (
              <div>
                {activities.map((activity) => (
                  <NotificationItem
                    key={activity.id}
                    activity={activity}
                    darkMode={darkMode}
                    isUnread={isUnread(activity)}
                    onClick={() => handleActivityClick(activity)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {activities.length > 0 && (
            <div className={`
              px-4 py-3 border-t text-center
              ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}
            `}>
              <button
                onClick={() => {
                  onClose();
                  // Navigate to full activity view
                  onViewAllActivity?.();
                }}
                className={`
                  text-sm font-medium transition-colors
                  ${darkMode ? 'text-[var(--accent)] hover:text-[var(--accent-light)]' : 'text-[var(--accent)] hover:underline'}
                `}
              >
                View all activity
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION ITEM - Individual notification row
// ═══════════════════════════════════════════════════════════════════════════

interface NotificationItemProps {
  activity: ActivityLogEntry;
  darkMode: boolean;
  isUnread: boolean;
  onClick: () => void;
}

function NotificationItem({ activity, darkMode, isUnread, onClick }: NotificationItemProps) {
  const config = ACTION_CONFIG[activity.action];
  const Icon = config.icon;
  const details = activity.details as Record<string, string | number | undefined>;

  // Build a more readable notification message
  const getMessage = () => {
    const userName = activity.user_name;
    const taskText = activity.todo_text ? `"${truncateText(activity.todo_text, 40)}"` : '';

    switch (activity.action) {
      case 'task_completed':
        return <><strong>{userName}</strong> completed {taskText}</>;
      case 'task_created':
        return <><strong>{userName}</strong> created {taskText}</>;
      case 'assigned_to_changed':
        return (
          <>
            <strong>{userName}</strong> assigned {taskText} to{' '}
            <strong>{details.to || 'someone'}</strong>
          </>
        );
      case 'status_changed':
        return (
          <>
            <strong>{userName}</strong> moved {taskText} to{' '}
            <span style={{ color: config.color }}>{details.to}</span>
          </>
        );
      case 'priority_changed':
        return (
          <>
            <strong>{userName}</strong> changed priority of {taskText} to{' '}
            <span style={{ color: PRIORITY_CONFIG[details.to as keyof typeof PRIORITY_CONFIG]?.color }}>
              {details.to}
            </span>
          </>
        );
      case 'subtask_completed':
        return (
          <>
            <strong>{userName}</strong> completed subtask in {taskText}
          </>
        );
      default:
        return <><strong>{userName}</strong> {config.label} {taskText}</>;
    }
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
        ${isUnread
          ? darkMode
            ? 'bg-[var(--accent)]/10 hover:bg-[var(--accent)]/15'
            : 'bg-[var(--accent-light)]/50 hover:bg-[var(--accent-light)]'
          : darkMode
            ? 'hover:bg-white/5'
            : 'hover:bg-[var(--surface-2)]'
        }
      `}
    >
      {/* Icon with colored background */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${config.color}20` }}
      >
        <Icon className="w-5 h-5" style={{ color: config.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${darkMode ? 'text-white/90' : 'text-[var(--foreground)]'}`}>
          {getMessage()}
        </p>

        <div className={`flex items-center gap-2 mt-1 text-xs ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </div>
      </div>

      {/* Unread indicator */}
      {isUnread && (
        <div className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0 mt-2" />
      )}

      {/* Chevron for clickable hint */}
      <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-2 ${darkMode ? 'text-white/20' : 'text-[var(--text-light)]'}`} />
    </button>
  );
}

// Helper to truncate text
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION BELL BUTTON - Use this in the navigation
// ═══════════════════════════════════════════════════════════════════════════

interface NotificationBellProps {
  unreadCount: number;
  onClick: () => void;
  isActive: boolean;
  darkMode: boolean;
}

export function NotificationBell({ unreadCount, onClick, isActive, darkMode }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative p-2 rounded-xl transition-colors
        ${isActive
          ? darkMode
            ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
            : 'bg-[var(--accent-light)] text-[var(--accent)]'
          : darkMode
            ? 'text-white/60 hover:text-white hover:bg-white/10'
            : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
        }
      `}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <Bell className="w-5 h-5" />

      {/* Badge */}
      {unreadCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full text-[10px] font-bold bg-[var(--danger)] text-white"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </motion.span>
      )}
    </button>
  );
}
