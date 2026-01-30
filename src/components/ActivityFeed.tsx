'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Activity, Clock, User, FileText, CheckCircle2, Circle, ArrowRight, Flag, Calendar, StickyNote, ListTodo, Trash2, RefreshCw, X, Bell, BellOff, BellRing, Volume2, VolumeX, Settings, Paperclip, GitMerge, ChevronDown, Filter } from 'lucide-react';
import { ActivityLogEntry, ActivityAction, PRIORITY_CONFIG, ActivityNotificationSettings, DEFAULT_NOTIFICATION_SETTINGS } from '@/types/todo';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import { fetchWithCsrf } from '@/lib/csrf';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useTheme } from '@/contexts/ThemeContext';

interface ActivityFeedProps {
  currentUserName: string;
  darkMode?: boolean;
  onClose?: () => void;
}

// Constants for pagination and memory management
const INITIAL_LOAD_LIMIT = 50;
const LOAD_MORE_LIMIT = 25;
const MAX_ACTIVITIES_IN_MEMORY = 200; // Prevent unbounded memory growth

// Local storage key for notification settings
const NOTIFICATION_SETTINGS_KEY = 'activityNotificationSettings';

// Get notification settings from localStorage
function getNotificationSettings(): ActivityNotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    // Log parse errors for debugging but continue with defaults
    logger.error('Failed to parse notification settings from localStorage', e, { component: 'ActivityFeed' });
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

// Save notification settings to localStorage
function saveNotificationSettings(settings: ActivityNotificationSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
}

const ACTION_CONFIG: Record<ActivityAction, { icon: React.ElementType; label: string; color: string }> = {
  task_created: { icon: Circle, label: 'created task', color: '#10b981' },
  task_updated: { icon: RefreshCw, label: 'updated task', color: '#3b82f6' },
  task_deleted: { icon: Trash2, label: 'deleted task', color: '#ef4444' },
  task_completed: { icon: CheckCircle2, label: 'completed task', color: '#10b981' },
  task_reopened: { icon: Circle, label: 'reopened task', color: '#f59e0b' },
  status_changed: { icon: ArrowRight, label: 'changed status', color: '#8b5cf6' },
  priority_changed: { icon: Flag, label: 'changed priority', color: '#f59e0b' },
  assigned_to_changed: { icon: User, label: 'reassigned task', color: '#3b82f6' },
  due_date_changed: { icon: Calendar, label: 'updated due date', color: '#3b82f6' },
  subtask_added: { icon: ListTodo, label: 'added subtask', color: '#10b981' },
  subtask_completed: { icon: CheckCircle2, label: 'completed subtask', color: '#10b981' },
  subtask_deleted: { icon: Trash2, label: 'removed subtask', color: '#ef4444' },
  notes_updated: { icon: StickyNote, label: 'updated notes', color: '#8b5cf6' },
  template_created: { icon: FileText, label: 'created template', color: '#10b981' },
  template_used: { icon: FileText, label: 'used template', color: '#3b82f6' },
  attachment_added: { icon: Paperclip, label: 'added attachment', color: '#10b981' },
  attachment_removed: { icon: Paperclip, label: 'removed attachment', color: '#ef4444' },
  tasks_merged: { icon: GitMerge, label: 'merged tasks', color: '#2c5282' },
  reminder_added: { icon: Bell, label: 'added reminder', color: '#8b5cf6' },
  reminder_removed: { icon: BellOff, label: 'removed reminder', color: '#ef4444' },
  reminder_sent: { icon: BellRing, label: 'sent reminder', color: '#10b981' },
};

// Activity type filter options
type ActivityFilterType = 'all' | 'tasks' | 'subtasks' | 'assignments' | 'templates';

const FILTER_OPTIONS: { value: ActivityFilterType; label: string; actions: ActivityAction[] }[] = [
  { value: 'all', label: 'All Activity', actions: [] },
  { value: 'tasks', label: 'Task Changes', actions: ['task_created', 'task_updated', 'task_deleted', 'task_completed', 'task_reopened', 'status_changed', 'priority_changed', 'due_date_changed', 'notes_updated', 'tasks_merged'] },
  { value: 'subtasks', label: 'Subtasks', actions: ['subtask_added', 'subtask_completed', 'subtask_deleted'] },
  { value: 'assignments', label: 'Assignments', actions: ['assigned_to_changed'] },
  { value: 'templates', label: 'Templates', actions: ['template_created', 'template_used'] },
];

export default function ActivityFeed({ currentUserName, darkMode: darkModeProp, onClose }: ActivityFeedProps) {
  // Use theme context if darkMode prop not explicitly provided
  const { theme } = useTheme();
  const darkMode = darkModeProp ?? theme === 'dark';

  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<ActivityNotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [filterType, setFilterType] = useState<ActivityFilterType>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const lastActivityIdRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEscapeKey(() => onClose?.(), { enabled: !!onClose });

  // Load notification settings on mount
  useEffect(() => {
    setNotificationSettings(getNotificationSettings());
  }, []);

  // Create notification sound using Web Audio API
  const playNotificationSound = useCallback(() => {
    if (!notificationSettings.soundEnabled) return;
    if (typeof window === 'undefined') return;

    try {
      // Access webkit prefixed AudioContext for older Safari versions
      const AudioContextClass = window.AudioContext ||
        (typeof window !== 'undefined' && 'webkitAudioContext' in window
          ? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined);

      if (!AudioContextClass) {
        logger.debug('AudioContext not supported in this browser', { component: 'ActivityFeed' });
        return;
      }

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Pleasant notification tone
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.setValueAtTime(1320, audioContext.currentTime + 0.1); // E6

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);

      logger.debug('Played notification sound', { component: 'ActivityFeed' });
    } catch (e) {
      logger.error('Failed to play notification sound', e, { component: 'ActivityFeed' });
    }
  }, [notificationSettings.soundEnabled]);

  const showBrowserNotification = useCallback((activity: ActivityLogEntry) => {
    if (!notificationSettings.browserNotificationsEnabled) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const config = ACTION_CONFIG[activity.action];
      const notification = new Notification(`${activity.user_name} ${config.label}`, {
        body: activity.todo_text || 'Activity update',
        icon: '/favicon.ico',
        tag: activity.id,
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        try {
          notification.close();
        } catch {
          // Notification may already be closed by user
        }
      }, 5000);
    } catch (e) {
      logger.error('Failed to show browser notification', e, { component: 'ActivityFeed' });
    }
  }, [notificationSettings.browserNotificationsEnabled]);

  const handleNotificationSettingsChange = (key: keyof ActivityNotificationSettings, value: boolean) => {
    const newSettings = { ...notificationSettings, [key]: value };
    setNotificationSettings(newSettings);
    saveNotificationSettings(newSettings);
  };

  const requestBrowserNotificationPermission = async (): Promise<'granted' | 'denied' | 'unsupported'> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    if (Notification.permission === 'granted') {
      handleNotificationSettingsChange('browserNotificationsEnabled', true);
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      // User has previously denied - can't request again
      logger.debug('Browser notifications were previously denied', { component: 'ActivityFeed' });
      return 'denied';
    }

    // Permission is 'default' - request permission
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        handleNotificationSettingsChange('browserNotificationsEnabled', true);
        return 'granted';
      }
      return 'denied';
    } catch (e) {
      logger.error('Failed to request notification permission', e, { component: 'ActivityFeed' });
      return 'denied';
    }
  };

  const fetchActivities = useCallback(async (reset = true) => {
    if (reset) {
      setIsLoading(true);
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const offset = reset ? 0 : activities.length;
      const limit = reset ? INITIAL_LOAD_LIMIT : LOAD_MORE_LIMIT;
      const response = await fetchWithCsrf(
        `/api/activity?userName=${encodeURIComponent(currentUserName)}&limit=${limit}&offset=${offset}`
      );
      if (response.ok) {
        const data = await response.json();

        if (reset) {
          setActivities(data);
        } else {
          setActivities(prev => [...prev, ...data]);
        }

        // Check if we have more to load
        setHasMore(data.length === limit);

        if (data.length > 0 && reset) {
          lastActivityIdRef.current = data[0].id;
        }
      } else {
        setError('Failed to load activity feed');
      }
    } catch (err) {
      logger.error('Failed to fetch activities', err, { component: 'ActivityFeed' });
      setError('Unable to connect to server');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [currentUserName, activities.length]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchActivities(false);
    }
  }, [fetchActivities, isLoadingMore, hasMore]);

  useEffect(() => {
    fetchActivities(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserName]);

  // Subscribe to real-time updates with notifications
  useEffect(() => {
    const channel = supabase
      .channel('activity-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
        },
        (payload) => {
          const newActivity = payload.new as ActivityLogEntry;

          // Check if this is from another user
          const isOtherUser = newActivity.user_name !== currentUserName;

          // Notify for activities from other users (or all if notifyOwnActions is enabled)
          const shouldNotify = notificationSettings.enabled && (isOtherUser || notificationSettings.notifyOwnActions);
          if (shouldNotify) {
            playNotificationSound();
            showBrowserNotification(newActivity);
          }

          // Add to activities with memory limit to prevent unbounded growth
          setActivities((prev) => {
            const updated = [newActivity, ...prev];
            // Trim to max size to prevent memory issues
            return updated.slice(0, MAX_ACTIVITIES_IN_MEMORY);
          });

          // Log for debugging
          logger.debug('Received realtime activity', { component: 'ActivityFeed', action: newActivity.action, from: newActivity.user_name, shouldNotify });
        }
      )
      .subscribe((status) => {
        logger.debug('Realtime subscription status', { component: 'ActivityFeed', status });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserName, notificationSettings.enabled, notificationSettings.notifyOwnActions, playNotificationSound, showBrowserNotification]);

  // Filter activities based on selected filter type
  const filteredActivities = useMemo(() => {
    if (filterType === 'all') return activities;
    const filterConfig = FILTER_OPTIONS.find(f => f.value === filterType);
    if (!filterConfig) return activities;
    return activities.filter(a => filterConfig.actions.includes(a.action));
  }, [activities, filterType]);

  // Group activities by date (memoized for performance)
  const groupedActivities = useMemo(() => {
    return filteredActivities.reduce((groups, activity) => {
      const date = new Date(activity.created_at).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
      return groups;
    }, {} as Record<string, ActivityLogEntry[]>);
  }, [filteredActivities]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className={`h-full flex flex-col ${darkMode ? 'bg-[var(--surface)]' : 'bg-white'}`}>
      {/* Toolbar - Controls for filtering and settings */}
      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${darkMode ? 'border-[var(--border)]' : 'border-[var(--border)]'}`}>
        <div className="flex items-center gap-3">
          {/* Activity count badge */}
          <span className={`text-sm font-medium ${darkMode ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]'}`}>
            {filteredActivities.length}{hasMore ? '+' : ''} activities
          </span>
          
          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterType !== 'all'
                  ? 'text-[var(--accent)] bg-[var(--accent)]/10'
                  : darkMode 
                    ? 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)]' 
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)]'
              }`}
              title="Filter activities"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{FILTER_OPTIONS.find(f => f.value === filterType)?.label || 'All'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showFilterMenu && (
              <div className={`absolute left-0 top-full mt-1 z-10 w-44 rounded-lg border shadow-lg ${
                darkMode ? 'bg-[var(--surface)] border-[var(--border)]' : 'bg-white border-[var(--border)]'
              }`}>
                {FILTER_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => { setFilterType(option.value); setShowFilterMenu(false); }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      filterType === option.value
                        ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                        : darkMode ? 'hover:bg-[var(--surface-2)] text-white' : 'hover:bg-[var(--surface-2)] text-[var(--foreground)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Notification toggle button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]'} ${
              notificationSettings.enabled
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-muted)]'
            }`}
            title="Notification settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification Settings Panel */}
      {showSettings && (
        <div className={`px-4 py-3 border-b ${darkMode ? 'border-[var(--border)] bg-[var(--surface-2)]/50' : 'border-[var(--border)] bg-[var(--surface-2)]'}`}>
          <p className={`text-xs font-medium uppercase tracking-wide mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Notification Settings
          </p>
          <div className="space-y-3">
            {/* Enable notifications */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                {notificationSettings.enabled ? (
                  <Bell className={`w-4 h-4 ${darkMode ? 'text-[#72B5E8]' : 'text-[#2c5282]'}`} />
                ) : (
                  <BellOff className={`w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                )}
                <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Enable notifications
                </span>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.enabled}
                onChange={(e) => handleNotificationSettingsChange('enabled', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#2c5282] focus:ring-[#72B5E8]"
              />
            </label>

            {/* Sound notifications */}
            <label className={`flex items-center justify-between cursor-pointer ${!notificationSettings.enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2">
                {notificationSettings.soundEnabled ? (
                  <Volume2 className={`w-4 h-4 ${darkMode ? 'text-[#72B5E8]' : 'text-[#2c5282]'}`} />
                ) : (
                  <VolumeX className={`w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                )}
                <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Sound alerts
                </span>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.soundEnabled}
                onChange={(e) => handleNotificationSettingsChange('soundEnabled', e.target.checked)}
                disabled={!notificationSettings.enabled}
                className="w-4 h-4 rounded border-slate-300 text-[#2c5282] focus:ring-[#72B5E8] disabled:opacity-50"
              />
            </label>

            {/* Browser notifications */}
            <label className={`flex items-center justify-between cursor-pointer ${!notificationSettings.enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2">
                <Bell className={`w-4 h-4 ${notificationSettings.browserNotificationsEnabled ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-slate-500' : 'text-slate-400')}`} />
                <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Browser notifications
                </span>
              </div>
              {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied' ? (
                <span className={`text-xs ${darkMode ? 'text-red-400' : 'text-red-500'}`}>Blocked</span>
              ) : notificationSettings.browserNotificationsEnabled ? (
                <input
                  type="checkbox"
                  checked={true}
                  onChange={() => handleNotificationSettingsChange('browserNotificationsEnabled', false)}
                  disabled={!notificationSettings.enabled}
                  className="w-4 h-4 rounded border-slate-300 text-[#2c5282] focus:ring-[#72B5E8] disabled:opacity-50"
                />
              ) : (
                <button
                  onClick={requestBrowserNotificationPermission}
                  disabled={!notificationSettings.enabled}
                  className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-[#2c5282] text-white hover:bg-[#1e3a5f]' : 'bg-[#72B5E8]/20 text-[#2c5282] hover:bg-[#72B5E8]/30'} disabled:opacity-50`}
                >
                  Enable
                </button>
              )}
            </label>

            {/* Notify own actions (for testing) */}
            <label className={`flex items-center justify-between cursor-pointer ${!notificationSettings.enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2">
                <User className={`w-4 h-4 ${notificationSettings.notifyOwnActions ? (darkMode ? 'text-[#72B5E8]' : 'text-[#2c5282]') : (darkMode ? 'text-slate-500' : 'text-slate-400')}`} />
                <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Notify my own actions
                </span>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.notifyOwnActions}
                onChange={(e) => handleNotificationSettingsChange('notifyOwnActions', e.target.checked)}
                disabled={!notificationSettings.enabled}
                className="w-4 h-4 rounded border-slate-300 text-[#2c5282] focus:ring-[#72B5E8] disabled:opacity-50"
              />
            </label>
          </div>
        </div>
      )}

      {/* Activity List */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto border-[var(--accent)]" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">Loading activity...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-[var(--text-muted)]">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-50 text-red-400" />
            <p className="font-medium text-red-400">{error}</p>
            <button
              onClick={() => fetchActivities(true)}
              className="mt-3 px-4 py-2 text-sm rounded-lg transition-colors bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--foreground)]"
            >
              Try Again
            </button>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-10 text-center">
            <div
              className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                darkMode ? 'bg-white/5 border border-white/10' : 'bg-[var(--surface-2)] border border-[var(--border)]'
              }`}
            >
              {filterType !== 'all' ? (
                <Filter className={`w-8 h-8 ${darkMode ? 'text-white/30' : 'text-[var(--text-muted)]'}`} />
              ) : (
                <Activity className={`w-8 h-8 ${darkMode ? 'text-white/30' : 'text-[var(--text-muted)]'}`} />
              )}
            </div>
            <p className={`font-semibold text-base ${darkMode ? 'text-white/80' : 'text-[var(--foreground)]'}`}>
              {filterType !== 'all' ? 'No matching activity' : 'No activity yet'}
            </p>
            <p className={`text-sm mt-2 max-w-[200px] mx-auto ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
              {filterType !== 'all'
                ? 'Try selecting a different filter to see more activity'
                : 'When you or your team make changes to tasks, they will appear here'}
            </p>
            {filterType !== 'all' && (
              <button
                onClick={() => setFilterType('all')}
                className={`mt-5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  darkMode
                    ? 'bg-white/10 hover:bg-white/15 text-white'
                    : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--foreground)]'
                }`}
              >
                Show all activity
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]/50">
            {Object.entries(groupedActivities).map(([date, dayActivities]) => (
              <div key={date}>
                {/* Date Header */}
                <div className={`px-4 py-2 text-xs font-medium uppercase tracking-wide sticky top-0 backdrop-blur-sm ${
                  darkMode ? 'bg-[var(--surface)]/80 text-[var(--text-muted)]' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                }`}>
                  {formatDate(date)}
                </div>

                {/* Activities for this date */}
                <div className="divide-y divide-[var(--border)]/30">
                  {dayActivities.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} darkMode={darkMode} />
                  ))}
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="p-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="px-4 py-2 text-sm rounded-lg transition-colors bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--foreground)] disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin border-[var(--accent)]" />
                      Loading...
                    </span>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && activities.length > 0 && (
              <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                End of activity history
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityItem({ activity, darkMode }: { activity: ActivityLogEntry; darkMode: boolean }) {
  const config = ACTION_CONFIG[activity.action];
  const Icon = config.icon;
  const details = activity.details as Record<string, string | number | undefined>;

  const renderDetails = () => {
    switch (activity.action) {
      case 'status_changed':
        return (
          <span className="flex items-center gap-1">
            <span className="text-[var(--text-muted)]">{details.from}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium" style={{ color: config.color }}>{details.to}</span>
          </span>
        );
      case 'priority_changed':
        const fromPriority = PRIORITY_CONFIG[details.from as keyof typeof PRIORITY_CONFIG];
        const toPriority = PRIORITY_CONFIG[details.to as keyof typeof PRIORITY_CONFIG];
        return (
          <span className="flex items-center gap-1">
            <span style={{ color: fromPriority?.color }}>{details.from}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium" style={{ color: toPriority?.color }}>{details.to}</span>
          </span>
        );
      case 'assigned_to_changed':
        return (
          <span className="flex items-center gap-1">
            <span className="text-[var(--text-muted)]">{details.from || 'Unassigned'}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium" style={{ color: config.color }}>{details.to || 'Unassigned'}</span>
          </span>
        );
      case 'due_date_changed':
        return (
          <span className="flex items-center gap-1">
            <span className="text-[var(--text-muted)]">{details.from || 'No date'}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium" style={{ color: config.color }}>{details.to || 'No date'}</span>
          </span>
        );
      case 'subtask_added':
      case 'subtask_completed':
      case 'subtask_deleted':
        return details.subtask_text ? (
          <span className="text-xs text-[var(--text-muted)]">
            &quot;{details.subtask_text}&quot;
          </span>
        ) : null;
      case 'template_created':
      case 'template_used':
        return details.template_name ? (
          <span className="text-xs text-[var(--text-muted)]">
            Template: {details.template_name}
          </span>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="px-4 py-3 flex items-start gap-3 hover:bg-[var(--surface-2)]/50 transition-colors">
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${config.color}20` }}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-[var(--foreground)]">
            {activity.user_name}
          </span>
          <span className="text-[var(--text-muted)]">
            {config.label}
          </span>
        </div>

        {activity.todo_text && (
          <p className="text-sm truncate mt-0.5 text-[var(--text-secondary)]">
            {activity.todo_text}
          </p>
        )}

        {renderDetails() && (
          <div className="mt-1 text-xs">
            {renderDetails()}
          </div>
        )}

        <div className="flex items-center gap-1 mt-1 text-xs text-[var(--text-light)]">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}
