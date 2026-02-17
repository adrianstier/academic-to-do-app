'use client';

import { useState, useEffect } from 'react';
import {
  BookOpen,
  Key,
  User,
  Library,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Trash2,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface ConnectionStatus {
  connected: boolean;
  userId?: string;
  libraryType?: 'user' | 'group';
  libraryId?: string;
  lastSync?: string;
}

// ============================================
// Main Component
// ============================================

export default function ZoteroSettings() {
  // Form state
  const [apiKey, setApiKey] = useState('');
  const [userId, setUserId] = useState('');
  const [libraryType, setLibraryType] = useState<'user' | 'group'>('user');
  const [libraryId, setLibraryId] = useState('');

  // UI state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // ---- Load existing connection on mount ----
  useEffect(() => {
    async function loadConnection() {
      try {
        const res = await fetch('/api/integrations/zotero');
        if (res.ok) {
          const json = await res.json();
          const conn = json.data?.connection;
          if (conn) {
            setConnectionStatus({
              connected: conn.connected,
              userId: conn.userId,
              libraryType: conn.libraryType,
              libraryId: conn.libraryId,
              lastSync: conn.lastSync,
            });
            setUserId(conn.userId || '');
            setLibraryType(conn.libraryType || 'user');
            setLibraryId(conn.libraryId || '');
          } else {
            setConnectionStatus({ connected: false });
          }
        }
      } catch {
        setConnectionStatus({ connected: false });
      } finally {
        setIsLoadingStatus(false);
      }
    }
    loadConnection();
  }, []);

  // ---- Auto-clear messages ----
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // ---- Handlers ----
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!userId.trim()) {
      setError('Zotero User ID is required.');
      return;
    }
    if (!apiKey.trim()) {
      setError('Zotero API Key is required.');
      return;
    }

    if (libraryType === 'group' && !libraryId.trim()) {
      setError('Group Library ID is required when using a group library.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/integrations/zotero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.trim(),
          apiKey: apiKey.trim(),
          libraryType,
          libraryId: libraryType === 'group' ? libraryId.trim() : userId.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to connect to Zotero.');
        return;
      }

      setConnectionStatus({
        connected: true,
        userId: userId.trim(),
        libraryType,
        libraryId: libraryType === 'group' ? libraryId.trim() : userId.trim(),
        lastSync: json.data?.connection?.lastSync,
      });
      setApiKey(''); // Clear API key from form after successful save
      setSuccessMessage('Zotero connected successfully!');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!userId.trim() || !apiKey.trim()) {
      setError('Please enter both User ID and API Key to test the connection.');
      return;
    }

    if (libraryType === 'group' && !libraryId.trim()) {
      setError('Group Library ID is required when using a group library.');
      return;
    }

    setIsTesting(true);
    try {
      const res = await fetch('/api/integrations/zotero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.trim(),
          apiKey: apiKey.trim(),
          libraryType,
          libraryId: libraryType === 'group' ? libraryId.trim() : userId.trim(),
        }),
      });

      const json = await res.json();

      if (res.ok) {
        setSuccessMessage('Connection successful! Your Zotero library is accessible.');
        setConnectionStatus({
          connected: true,
          userId: userId.trim(),
          libraryType,
          libraryId: libraryType === 'group' ? libraryId.trim() : userId.trim(),
          lastSync: json.data?.connection?.lastSync,
        });
        setApiKey('');
      } else {
        setError(json.error || 'Connection test failed.');
      }
    } catch {
      setError('Network error. Could not reach Zotero.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/zotero', { method: 'DELETE' });
      if (res.ok) {
        setConnectionStatus({ connected: false });
        setUserId('');
        setApiKey('');
        setLibraryType('user');
        setLibraryId('');
        setSuccessMessage('Zotero disconnected.');
      } else {
        setError('Failed to disconnect.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[var(--accent)]/10">
          <BookOpen className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">
            Zotero Integration
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
            Connect your Zotero library to link references to tasks.
          </p>
        </div>
      </div>

      {/* Connection status indicator */}
      {isLoadingStatus ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--surface-2)]">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-muted)]">Checking connection...</span>
        </div>
      ) : connectionStatus?.connected ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <div>
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Connected
              </span>
              {connectionStatus.lastSync && (
                <span className="text-xs text-[var(--text-muted)] ml-2">
                  Last sync: {new Date(connectionStatus.lastSync).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {isDisconnecting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
          <XCircle className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-muted)]">Not connected</span>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-600 dark:text-green-400">
          {successMessage}
        </div>
      )}

      {/* Configuration form */}
      <form onSubmit={handleSave} className="space-y-4">
        {/* Instructions */}
        <div className="px-4 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            To connect your Zotero library, you need your User ID and an API key.
            Get your API key at{' '}
            <a
              href="https://www.zotero.org/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline inline-flex items-center gap-0.5"
            >
              zotero.org/settings/keys
              <ExternalLink className="w-3 h-3" />
            </a>
            . Your User ID is shown on the same page under &ldquo;Your userID for use in API calls&rdquo;.
          </p>
        </div>

        {/* User ID */}
        <div className="space-y-1.5">
          <label htmlFor="zotero-user-id" className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
            <User className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            User ID
          </label>
          <input
            id="zotero-user-id"
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="e.g., 1234567"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label htmlFor="zotero-api-key" className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
            <Key className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            API Key
          </label>
          <div className="relative">
            <input
              id="zotero-api-key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={connectionStatus?.connected ? 'Enter new key to update' : 'Paste your API key'}
              className="w-full px-3 py-2 pr-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] px-2 py-1 rounded"
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Library Type */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
            <Library className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            Library Type
          </label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="libraryType"
                value="user"
                checked={libraryType === 'user'}
                onChange={() => setLibraryType('user')}
                className="w-4 h-4 text-[var(--accent)] border-[var(--border)] focus:ring-[var(--accent)]/50"
              />
              <span className="text-sm text-[var(--foreground)]">Personal Library</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="libraryType"
                value="group"
                checked={libraryType === 'group'}
                onChange={() => setLibraryType('group')}
                className="w-4 h-4 text-[var(--accent)] border-[var(--border)] focus:ring-[var(--accent)]/50"
              />
              <span className="text-sm text-[var(--foreground)]">Group Library</span>
            </label>
          </div>
        </div>

        {/* Group Library ID (only shown for group type) */}
        {libraryType === 'group' && (
          <div className="space-y-1.5">
            <label htmlFor="zotero-library-id" className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
              <Library className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              Group Library ID
            </label>
            <input
              id="zotero-library-id"
              type="text"
              value={libraryId}
              onChange={(e) => setLibraryId(e.target.value)}
              placeholder="e.g., 9876543"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
            />
            <p className="text-xs text-[var(--text-muted)]">
              Find this in your group&apos;s Zotero URL: zotero.org/groups/[ID]
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving || !userId.trim() || !apiKey.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--accent)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Save Connection
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !userId.trim() || !apiKey.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
