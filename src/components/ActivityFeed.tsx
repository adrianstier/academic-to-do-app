'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Clock, User, FileText, CheckCircle2, Circle, ArrowRight, Flag, Calendar, StickyNote, ListTodo, Trash2, RefreshCw, X, Bell, BellOff, Volume2, VolumeX, Settings } from 'lucide-react';
import { ActivityLogEntry, ActivityAction, PRIORITY_CONFIG, ActivityNotificationSettings, DEFAULT_NOTIFICATION_SETTINGS } from '@/types/todo';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface ActivityFeedProps {
  currentUserName: string;
  darkMode?: boolean;
  onClose?: () => void;
}

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
  } catch {
    // Ignore parse errors
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
};

export default function ActivityFeed({ currentUserName, darkMode = true, onClose }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState<ActivityNotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastActivityIdRef = useRef<string | null>(null);

  // Load notification settings on mount
  useEffect(() => {
    setNotificationSettings(getNotificationSettings());
  }, []);

  // Create audio element for notification sound
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/notification.mp3');
      audioRef.current.volume = 0.5;
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (notificationSettings.soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }, [notificationSettings.soundEnabled]);

  const showBrowserNotification = useCallback((activity: ActivityLogEntry) => {
    if (!notificationSettings.browserNotificationsEnabled) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const config = ACTION_CONFIG[activity.action];
    new Notification(`${activity.user_name} ${config.label}`, {
      body: activity.todo_text || 'Activity update',
      icon: '/favicon.ico',
      tag: activity.id,
    });
  }, [notificationSettings.browserNotificationsEnabled]);

  const handleNotificationSettingsChange = (key: keyof ActivityNotificationSettings, value: boolean) => {
    const newSettings = { ...notificationSettings, [key]: value };
    setNotificationSettings(newSettings);
    saveNotificationSettings(newSettings);
  };

  const requestBrowserNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        handleNotificationSettingsChange('browserNotificationsEnabled', true);
      }
    } else if (Notification.permission === 'granted') {
      handleNotificationSettingsChange('browserNotificationsEnabled', true);
    }
  };

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/activity?userName=${encodeURIComponent(currentUserName)}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data);
        if (data.length > 0) {
          lastActivityIdRef.current = data[0].id;
        }
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserName]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

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

          // Only notify for activities from other users
          if (notificationSettings.enabled && newActivity.user_name !== currentUserName) {
            playNotificationSound();
            showBrowserNotification(newActivity);
          }

          setActivities((prev) => [newActivity, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserName, notificationSettings.enabled, playNotificationSound, showBrowserNotification]);

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = new Date(activity.created_at).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, ActivityLogEntry[]>);

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
    <div className={`h-full flex flex-col ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Activity className={`w-5 h-5 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
          <h2 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Activity Feed</h2>
        </div>
        <div className="flex items-center gap-1">
          {/* Notification toggle button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} ${
              notificationSettings.enabled
                ? darkMode ? 'text-purple-400' : 'text-purple-600'
                : darkMode ? 'text-slate-500' : 'text-slate-400'
            }`}
            title="Notification settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Notification Settings Panel */}
      {showSettings && (
        <div className={`px-4 py-3 border-b ${darkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
          <p className={`text-xs font-medium uppercase tracking-wide mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Notification Settings
          </p>
          <div className="space-y-3">
            {/* Enable notifications */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                {notificationSettings.enabled ? (
                  <Bell className={`w-4 h-4 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
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
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
            </label>

            {/* Sound notifications */}
            <label className={`flex items-center justify-between cursor-pointer ${!notificationSettings.enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2">
                {notificationSettings.soundEnabled ? (
                  <Volume2 className={`w-4 h-4 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
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
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
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
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                />
              ) : (
                <button
                  onClick={requestBrowserNotificationPermission}
                  disabled={!notificationSettings.enabled}
                  className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'} disabled:opacity-50`}
                >
                  Enable
                </button>
              )}
            </label>
          </div>
        </div>
      )}

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto ${darkMode ? 'border-slate-400' : 'border-slate-600'}`} />
            <p className={`mt-3 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading activity...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className={`p-8 text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No activity yet</p>
            <p className="text-sm mt-1">Task changes will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {Object.entries(groupedActivities).map(([date, dayActivities]) => (
              <div key={date}>
                {/* Date Header */}
                <div className={`px-4 py-2 text-xs font-medium uppercase tracking-wide sticky top-0 ${darkMode ? 'bg-slate-900/80 text-slate-400 backdrop-blur-sm' : 'bg-slate-50 text-slate-500'}`}>
                  {formatDate(date)}
                </div>

                {/* Activities for this date */}
                <div className="divide-y divide-slate-700/30">
                  {dayActivities.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} darkMode={darkMode} />
                  ))}
                </div>
              </div>
            ))}
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
            <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>{details.from}</span>
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
            <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>{details.from || 'Unassigned'}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium" style={{ color: config.color }}>{details.to || 'Unassigned'}</span>
          </span>
        );
      case 'due_date_changed':
        return (
          <span className="flex items-center gap-1">
            <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>{details.from || 'No date'}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium" style={{ color: config.color }}>{details.to || 'No date'}</span>
          </span>
        );
      case 'subtask_added':
      case 'subtask_completed':
      case 'subtask_deleted':
        return details.subtask_text ? (
          <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            &quot;{details.subtask_text}&quot;
          </span>
        ) : null;
      case 'template_created':
      case 'template_used':
        return details.template_name ? (
          <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Template: {details.template_name}
          </span>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${darkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}>
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
          <span className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            {activity.user_name}
          </span>
          <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
            {config.label}
          </span>
        </div>

        {activity.todo_text && (
          <p className={`text-sm truncate mt-0.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {activity.todo_text}
          </p>
        )}

        {renderDetails() && (
          <div className="mt-1 text-xs">
            {renderDetails()}
          </div>
        )}

        <div className={`flex items-center gap-1 mt-1 text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}
