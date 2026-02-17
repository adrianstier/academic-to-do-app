'use client';

/**
 * CalendarSyncSettings — Google Calendar Sync Configuration UI
 *
 * Sections:
 * 1. Connection Status (connect/disconnect, email display)
 * 2. Sync Settings (direction, auto-sync, calendar selection, project filter)
 * 3. Sync Actions (sync now, last sync, sync history)
 * 4. Conflict Resolution (keep local / keep google / ask)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  RefreshCw,
  Link2,
  Unlink,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings,
  AlertTriangle,
  Loader2,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import type {
  GoogleCalendar,
  SyncDirection,
  AutoSyncInterval,
  ConflictResolution,
  CalendarSyncConfig,
  SyncHistoryEntry,
} from '@/lib/googleCalendar';
import { DEFAULT_SYNC_CONFIG } from '@/lib/googleCalendar';

// ============================================
// Types
// ============================================

export interface CalendarSyncSettingsProps {
  onClose?: () => void;
}

interface StoredConnectionData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email: string;
  connected_at: string;
}

// ============================================
// LocalStorage Keys
// ============================================

const LS_KEY_CONNECTION = 'gcal_connection';
const LS_KEY_SYNC_CONFIG = 'gcal_sync_config';
const LS_KEY_SYNC_HISTORY = 'gcal_sync_history';
const LS_KEY_LAST_SYNC = 'gcal_last_sync';

// ============================================
// Helpers
// ============================================

function getStoredConnection(): StoredConnectionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_KEY_CONNECTION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStoredConnection(data: StoredConnectionData | null): void {
  if (typeof window === 'undefined') return;
  if (data) {
    localStorage.setItem(LS_KEY_CONNECTION, JSON.stringify(data));
  } else {
    localStorage.removeItem(LS_KEY_CONNECTION);
  }
}

function getStoredConfig(): CalendarSyncConfig {
  if (typeof window === 'undefined') return DEFAULT_SYNC_CONFIG;
  try {
    const raw = localStorage.getItem(LS_KEY_SYNC_CONFIG);
    if (!raw) return DEFAULT_SYNC_CONFIG;
    return { ...DEFAULT_SYNC_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SYNC_CONFIG;
  }
}

function setStoredConfig(config: CalendarSyncConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY_SYNC_CONFIG, JSON.stringify(config));
}

function getStoredHistory(): SyncHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY_SYNC_HISTORY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function addSyncHistoryEntry(entry: SyncHistoryEntry): void {
  if (typeof window === 'undefined') return;
  const history = getStoredHistory();
  history.unshift(entry);
  // Keep only last 5
  localStorage.setItem(LS_KEY_SYNC_HISTORY, JSON.stringify(history.slice(0, 5)));
}

function getLastSync(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LS_KEY_LAST_SYNC);
}

function setLastSync(timestamp: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY_LAST_SYNC, timestamp);
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ============================================
// Component
// ============================================

export default function CalendarSyncSettings({ onClose }: CalendarSyncSettingsProps) {
  const toast = useToast();

  // Connection state
  const [connection, setConnection] = useState<StoredConnectionData | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [isConfigured, setIsConfigured] = useState(true);

  // Sync settings
  const [config, setConfig] = useState<CalendarSyncConfig>(DEFAULT_SYNC_CONFIG);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSyncState] = useState<string | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);

  // ============================================
  // Initialize from localStorage + check for OAuth callback data
  // ============================================

  useEffect(() => {
    // Load stored data
    const stored = getStoredConnection();
    setConnection(stored);
    setConfig(getStoredConfig());
    setSyncHistory(getStoredHistory());
    setLastSyncState(getLastSync());

    // Check for OAuth callback data in URL fragment
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('gcal_data=')) {
        const dataParam = hash.split('gcal_data=')[1];
        if (dataParam) {
          try {
            // Use browser-safe base64 decoding (no Buffer in client components)
            const base64 = dataParam.replace(/-/g, '+').replace(/_/g, '/');
            const decoded = JSON.parse(atob(base64));
            setStoredConnection(decoded);
            setConnection(decoded);
            toast.success('Google Calendar connected successfully');

            // Clean up the URL
            window.history.replaceState(null, '', window.location.pathname);
          } catch {
            toast.error('Failed to complete Google Calendar connection');
          }
        }
      }

      // Check for error in URL params
      const params = new URLSearchParams(window.location.search);
      const gcalError = params.get('gcal_error');
      if (gcalError) {
        const errorMessages: Record<string, string> = {
          access_denied: 'Google Calendar access was denied',
          missing_params: 'OAuth callback was missing required parameters',
          invalid_state: 'Security check failed. Please try connecting again.',
          token_exchange_failed: 'Failed to complete authentication. Please try again.',
          google_calendar_not_configured:
            'Google Calendar sync is not configured on this server.',
        };
        toast.error(errorMessages[gcalError] || `Connection error: ${gcalError}`);

        // Clean up the URL
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('gcal_error');
        cleanUrl.searchParams.delete('gcal_connected');
        window.history.replaceState(null, '', cleanUrl.pathname);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================
  // Fetch status & calendars when connected
  // ============================================

  const fetchStatus = useCallback(async () => {
    if (!connection) return;

    try {
      const response = await fetch(
        `/api/integrations/google-calendar/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: connection.access_token,
            refreshToken: connection.refresh_token,
          }),
        }
      );
      const data = await response.json();

      if (data.configured === false) {
        setIsConfigured(false);
        return;
      }

      if (data.connected) {
        setCalendars(data.calendars || []);

        // Update tokens if refreshed
        if (data.updatedTokens) {
          const updated = {
            ...connection,
            access_token: data.updatedTokens.access_token,
            expires_at: data.updatedTokens.expires_at,
          };
          setStoredConnection(updated);
          setConnection(updated);
        }
      } else if (data.tokenExpired) {
        toast.warning('Google Calendar connection expired. Please reconnect.');
        setStoredConnection(null);
        setConnection(null);
        setCalendars([]);
        localStorage.removeItem(LS_KEY_SYNC_HISTORY);
        localStorage.removeItem(LS_KEY_LAST_SYNC);
        setSyncHistory([]);
        setLastSyncState(null);
      }
    } catch {
      // Silent fail - status check is not critical
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, toast]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ============================================
  // Handlers
  // ============================================

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/integrations/google-calendar/auth');
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503) {
          setIsConfigured(false);
          toast.error(
            data.message ||
              'Google Calendar sync requires API credentials. Ask your admin to configure them.'
          );
        } else {
          toast.error(data.error || 'Failed to start authentication');
        }
        return;
      }

      // Redirect to Google's consent screen
      window.location.href = data.authUrl;
    } catch {
      toast.error('Failed to connect to Google Calendar');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setStoredConnection(null);
    setConnection(null);
    setCalendars([]);
    localStorage.removeItem(LS_KEY_SYNC_HISTORY);
    localStorage.removeItem(LS_KEY_LAST_SYNC);
    setSyncHistory([]);
    setLastSyncState(null);
    toast.info('Google Calendar disconnected');
  };

  const handleSyncNow = async () => {
    if (!connection) return;
    setIsSyncing(true);

    try {
      const response = await fetch('/api/integrations/google-calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: config.direction,
          accessToken: connection.access_token,
          refreshToken: connection.refresh_token,
          calendarIds: config.pullCalendarIds.length > 0 ? config.pullCalendarIds : ['primary'],
          projectIds: config.pushProjectIds,
          since: lastSync || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.reconnect) {
          toast.error('Session expired. Please reconnect Google Calendar.');
          handleDisconnect();
          return;
        }
        throw new Error(data.error || 'Sync failed');
      }

      // Update tokens if refreshed
      if (data.updatedTokens) {
        const updated = {
          ...connection,
          access_token: data.updatedTokens.access_token,
          expires_at: data.updatedTokens.expires_at,
        };
        setStoredConnection(updated);
        setConnection(updated);
      }

      // Record sync
      const now = new Date().toISOString();
      setLastSync(now);
      setLastSyncState(now);

      const entry: SyncHistoryEntry = {
        timestamp: now,
        direction: config.direction,
        pushed: data.pushed || 0,
        pulled: data.pulled || 0,
        errors: data.errors || [],
      };
      addSyncHistoryEntry(entry);
      setSyncHistory(getStoredHistory());

      // Show result
      const parts: string[] = [];
      if (data.pushed > 0) parts.push(`${data.pushed} pushed`);
      if (data.pulled > 0) parts.push(`${data.pulled} pulled`);
      if (parts.length === 0) parts.push('No changes');

      if (data.errors?.length > 0) {
        toast.warning(`Sync completed with ${data.errors.length} error(s): ${parts.join(', ')}`, {
          description: data.errors[0],
        });
      } else {
        toast.success(`Sync completed: ${parts.join(', ')}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateConfig = (updates: Partial<CalendarSyncConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setStoredConfig(newConfig);
  };

  const toggleCalendarSelection = (calendarId: string) => {
    const current = config.pullCalendarIds;
    const updated = current.includes(calendarId)
      ? current.filter((id) => id !== calendarId)
      : [...current, calendarId];
    updateConfig({ pullCalendarIds: updated });
  };

  // ============================================
  // Render
  // ============================================

  const directionOptions: { value: SyncDirection; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'push', label: 'Push only', icon: <ArrowUp className="w-4 h-4" />, desc: 'Tasks to Calendar' },
    { value: 'pull', label: 'Pull only', icon: <ArrowDown className="w-4 h-4" />, desc: 'Calendar to Tasks' },
    { value: 'both', label: 'Bidirectional', icon: <ArrowUpDown className="w-4 h-4" />, desc: 'Both directions' },
  ];

  const intervalOptions: { value: AutoSyncInterval; label: string }[] = [
    { value: '15min', label: 'Every 15 minutes' },
    { value: '30min', label: 'Every 30 minutes' },
    { value: '1hr', label: 'Every hour' },
    { value: 'off', label: 'Off' },
  ];

  const conflictOptions: { value: ConflictResolution; label: string; desc: string }[] = [
    { value: 'keep_local', label: 'Keep local changes', desc: 'Local tasks take priority over Google Calendar' },
    { value: 'keep_google', label: 'Keep Google changes', desc: 'Google Calendar events take priority' },
    { value: 'ask', label: 'Ask each time', desc: 'Prompt for each conflict during sync' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Google Calendar Sync</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Sync tasks with due dates to Google Calendar
            </p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Not configured message */}
      {!isConfigured && (
        <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-light)] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--warning)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Google Calendar sync requires API credentials
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Ask your admin to configure <code className="text-xs bg-[var(--surface-2)] px-1.5 py-0.5 rounded">GOOGLE_CLIENT_ID</code>{' '}
                and <code className="text-xs bg-[var(--surface-2)] px-1.5 py-0.5 rounded">GOOGLE_CLIENT_SECRET</code> environment variables.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Connection Status */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
          <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Connection Status
          </h3>
        </div>
        <div className="p-4">
          {connection ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">Connected</p>
                  <p className="text-xs text-[var(--text-muted)]">{connection.email}</p>
                </div>
                <Badge variant="success" size="sm" dot>
                  Active
                </Badge>
              </div>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Unlink className="w-4 h-4" />}
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-[var(--text-muted)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">Not connected</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Connect your Google account to sync tasks
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Link2 className="w-4 h-4" />}
                loading={isConnecting}
                disabled={!isConfigured}
                onClick={handleConnect}
              >
                Connect
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Sync Settings (only when connected) */}
      {connection && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
            <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Sync Settings
            </h3>
          </div>
          <div className="p-4 space-y-5">
            {/* Direction */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Sync Direction
              </label>
              <div className="grid grid-cols-3 gap-2">
                {directionOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateConfig({ direction: opt.value })}
                    className={`
                      flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm
                      transition-all duration-150
                      ${
                        config.direction === opt.value
                          ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]'
                          : 'border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:border-[var(--border-hover)]'
                      }
                    `}
                  >
                    {opt.icon}
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-sync */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[var(--foreground)]">
                  Auto-sync
                </label>
                <button
                  onClick={() => updateConfig({ autoSync: !config.autoSync })}
                  className={`
                    relative w-11 h-6 rounded-full transition-colors duration-200
                    ${config.autoSync ? 'bg-[var(--accent)]' : 'bg-[var(--surface-3)]'}
                  `}
                  role="switch"
                  aria-checked={config.autoSync}
                >
                  <span
                    className={`
                      absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm
                      transition-transform duration-200
                      ${config.autoSync ? 'translate-x-5' : 'translate-x-0'}
                    `}
                  />
                </button>
              </div>
              {config.autoSync && (
                <div className="ml-0 mt-2">
                  <label className="block text-xs text-[var(--text-muted)] mb-1.5">
                    Sync interval
                  </label>
                  <select
                    value={config.autoSyncInterval}
                    onChange={(e) =>
                      updateConfig({ autoSyncInterval: e.target.value as AutoSyncInterval })
                    }
                    className="
                      w-full px-3 py-2 text-sm rounded-lg
                      bg-[var(--surface-2)] border border-[var(--border)]
                      text-[var(--foreground)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                    "
                  >
                    {intervalOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Calendar selection (for pull) */}
            {(config.direction === 'pull' || config.direction === 'both') && (
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  Pull from calendars
                </label>
                {calendars.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {calendars.map((cal) => (
                      <label
                        key={cal.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-2)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={config.pullCalendarIds.includes(cal.id)}
                          onChange={() => toggleCalendarSelection(cal.id)}
                          className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                        />
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cal.backgroundColor || '#4285f4' }}
                        />
                        <span className="text-sm text-[var(--foreground)] truncate">
                          {cal.summary}
                          {cal.primary && (
                            <span className="ml-1.5 text-xs text-[var(--text-muted)]">(Primary)</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)] italic">
                    Loading calendars...
                  </p>
                )}
              </div>
            )}

            {/* Project filter (for push) */}
            {(config.direction === 'push' || config.direction === 'both') && (
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  Push tasks from
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateConfig({ pushProjectIds: 'all' })}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                      ${
                        config.pushProjectIds === 'all'
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]'
                      }
                    `}
                  >
                    All projects
                  </button>
                  <button
                    onClick={() =>
                      updateConfig({
                        pushProjectIds: config.pushProjectIds === 'all' ? [] : config.pushProjectIds,
                      })
                    }
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                      ${
                        config.pushProjectIds !== 'all'
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]'
                      }
                    `}
                  >
                    Specific projects
                  </button>
                </div>
                {config.pushProjectIds !== 'all' && (
                  <p className="mt-2 text-xs text-[var(--text-muted)] flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Project-level filtering will be available in a future update.
                    Currently pushes all tasks with due dates.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 3: Sync Actions (only when connected) */}
      {connection && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
            <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Sync Actions
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Sync Now button + last sync */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Manual sync</p>
                {lastSync && (
                  <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    Last synced {formatRelativeTime(lastSync)}
                  </p>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={
                  isSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )
                }
                loading={isSyncing}
                onClick={handleSyncNow}
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>

            {/* Sync History */}
            {syncHistory.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Recent Syncs
                </p>
                <div className="space-y-1.5">
                  {syncHistory.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-[var(--surface-2)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatRelativeTime(entry.timestamp)}
                        </span>
                        <Badge variant="default" size="sm">
                          {entry.direction === 'push'
                            ? 'Push'
                            : entry.direction === 'pull'
                            ? 'Pull'
                            : 'Both'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {entry.pushed > 0 && (
                          <span className="text-[var(--success)]">
                            {entry.pushed} pushed
                          </span>
                        )}
                        {entry.pulled > 0 && (
                          <span className="text-[var(--accent)]">
                            {entry.pulled} pulled
                          </span>
                        )}
                        {entry.pushed === 0 && entry.pulled === 0 && (
                          <span className="text-[var(--text-muted)]">No changes</span>
                        )}
                        {entry.errors.length > 0 && (
                          <Badge variant="warning" size="sm">
                            {entry.errors.length} error{entry.errors.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 4: Conflict Resolution (only when connected and bidirectional) */}
      {connection && (config.direction === 'both') && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
            <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Conflict Resolution
            </h3>
          </div>
          <div className="p-4">
            <p className="text-sm text-[var(--text-muted)] mb-3">
              When both a task and its calendar event have been modified since the last sync:
            </p>
            <div className="space-y-2">
              {conflictOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg border cursor-pointer
                    transition-all duration-150
                    ${
                      config.conflictResolution === opt.value
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] bg-[var(--surface-1)] hover:border-[var(--border-hover)]'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="conflictResolution"
                    value={opt.value}
                    checked={config.conflictResolution === opt.value}
                    onChange={() => updateConfig({ conflictResolution: opt.value })}
                    className="mt-0.5 w-4 h-4 text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">{opt.label}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
