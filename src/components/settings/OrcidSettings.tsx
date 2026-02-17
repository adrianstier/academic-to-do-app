'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Trash2,
  Search,
  Link,
  BookOpen,
  Building2,
  Copy,
  Check,
} from 'lucide-react';
import type { OrcidProfile } from '@/types/orcid';

// ============================================
// ORCID brand color
// ============================================

const ORCID_GREEN = '#A6CE39';

// ============================================
// ORCID iD Icon (SVG)
// ============================================

function OrcidIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      className={className}
      aria-hidden="true"
    >
      <circle cx="128" cy="128" r="128" fill={ORCID_GREEN} />
      <path
        fill="#fff"
        d="M86.3 186.2H70.9V79.1h15.4v107.1zM108.9 79.1h41.6c39.6 0 57.6 30.2 57.6 53.6 0 22.7-18.2 53.6-57.6 53.6h-41.6V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7 0-21.5-13.7-39.7-43.7-39.7h-23.7v79.4z"
      />
      <circle cx="78.9" cy="62.1" r="11.4" fill="#fff" />
    </svg>
  );
}

// ============================================
// Types
// ============================================

interface LinkStatus {
  linked: boolean;
  orcidId?: string;
  profile?: OrcidProfile;
  linkedAt?: string;
}

// ============================================
// Main Component
// ============================================

export default function OrcidSettings() {
  // Form state
  const [orcidInput, setOrcidInput] = useState('');

  // UI state
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null);
  const [previewProfile, setPreviewProfile] = useState<OrcidProfile | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // ---- Load existing link on mount ----
  useEffect(() => {
    async function loadLink() {
      try {
        const res = await fetch('/api/integrations/orcid');
        if (res.ok) {
          const json = await res.json();
          if (json.data?.linked && json.data.orcid) {
            setLinkStatus({
              linked: true,
              orcidId: json.data.orcid.orcidId,
              profile: json.data.orcid.profile,
              linkedAt: json.data.orcid.linkedAt,
            });
          } else {
            setLinkStatus({ linked: false });
          }
        }
      } catch {
        setLinkStatus({ linked: false });
      } finally {
        setIsLoadingStatus(false);
      }
    }
    loadLink();
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

  // ---- Format input as user types ----
  const handleOrcidInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9Xx-]/g, '').toUpperCase();

    // Auto-insert hyphens
    const digits = value.replace(/-/g, '');
    if (digits.length > 4) {
      const parts = [];
      for (let i = 0; i < digits.length && i < 16; i += 4) {
        parts.push(digits.slice(i, i + 4));
      }
      value = parts.join('-');
    }

    setOrcidInput(value);
    setPreviewProfile(null);
  };

  // ---- Look up ORCID profile ----
  const handleLookup = async () => {
    setError(null);
    setSuccessMessage(null);
    setPreviewProfile(null);

    const trimmed = orcidInput.trim();
    if (!trimmed) {
      setError('Please enter an ORCID iD.');
      return;
    }

    // Basic format validation
    const pattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
    if (!pattern.test(trimmed)) {
      setError('Invalid format. ORCID iD should be XXXX-XXXX-XXXX-XXXX.');
      return;
    }

    // ORCID checksum validation (ISO 7064 Mod 11,2)
    const digits = trimmed.replace(/-/g, '');
    let total = 0;
    for (let i = 0; i < digits.length - 1; i++) {
      total = (total + parseInt(digits[i], 10)) * 2;
    }
    const remainder = total % 11;
    const checkDigit = (12 - remainder) % 11;
    const expectedCheck = checkDigit === 10 ? 'X' : checkDigit.toString();
    if (digits[digits.length - 1] !== expectedCheck) {
      setError('Invalid ORCID iD checksum. Please double-check your ORCID.');
      return;
    }

    setIsLookingUp(true);
    try {
      const res = await fetch(
        `/api/integrations/orcid?orcidId=${encodeURIComponent(trimmed)}`
      );
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Could not find ORCID profile.');
        return;
      }

      setPreviewProfile(json.data.profile);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // ---- Link ORCID ----
  const handleLink = async () => {
    setError(null);
    setIsLinking(true);
    try {
      const res = await fetch('/api/integrations/orcid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orcidId: orcidInput.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to link ORCID.');
        return;
      }

      setLinkStatus({
        linked: true,
        orcidId: json.data.orcid.orcidId,
        profile: json.data.orcid.profile,
        linkedAt: json.data.orcid.linkedAt,
      });
      setOrcidInput('');
      setPreviewProfile(null);
      setSuccessMessage('ORCID linked successfully!');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLinking(false);
    }
  };

  // ---- Unlink ORCID ----
  const handleUnlink = async () => {
    setError(null);
    setIsUnlinking(true);
    try {
      const res = await fetch('/api/integrations/orcid', { method: 'DELETE' });
      if (res.ok) {
        setLinkStatus({ linked: false });
        setSuccessMessage('ORCID unlinked.');
      } else {
        setError('Failed to unlink ORCID.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setIsUnlinking(false);
    }
  };

  // ---- Copy ORCID ID ----
  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${ORCID_GREEN}15` }}>
          <OrcidIcon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">
            ORCID Integration
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
            Link your ORCID iD to display your research identity.
          </p>
        </div>
      </div>

      {/* Connection status */}
      {isLoadingStatus ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--surface-2)]">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-muted)]">Checking ORCID link...</span>
        </div>
      ) : linkStatus?.linked && linkStatus.profile ? (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5">
          {/* Linked header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-green-500/10">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                ORCID Linked
              </span>
              {linkStatus.linkedAt && (
                <span className="text-xs text-[var(--text-muted)]">
                  since {new Date(linkStatus.linkedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <button
              onClick={handleUnlink}
              disabled={isUnlinking}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {isUnlinking ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              Unlink
            </button>
          </div>

          {/* Linked profile summary */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <OrcidIcon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium text-[var(--foreground)]">
                {linkStatus.profile.name}
              </span>
              <button
                onClick={() => handleCopyId(linkStatus.orcidId!)}
                className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                title="Copy ORCID iD"
              >
                <span className="font-mono">{linkStatus.orcidId}</span>
                {copiedId ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>

            {linkStatus.profile.affiliations.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <Building2 className="w-3 h-3" />
                {linkStatus.profile.affiliations[0].organization}
                {linkStatus.profile.affiliations[0].department && (
                  <span>, {linkStatus.profile.affiliations[0].department}</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {linkStatus.profile.works.length} publication{linkStatus.profile.works.length !== 1 ? 's' : ''}
              </span>
              <a
                href={`https://orcid.org/${linkStatus.orcidId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
                style={{ color: ORCID_GREEN }}
              >
                View on ORCID
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
          <XCircle className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-muted)]">No ORCID linked</span>
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

      {/* Link form (only show when not linked) */}
      {!linkStatus?.linked && (
        <div className="space-y-4">
          {/* Instructions */}
          <div className="px-4 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Enter your ORCID iD to link your research identity. Don&apos;t have one?{' '}
              <a
                href="https://orcid.org/register"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-medium hover:underline"
                style={{ color: ORCID_GREEN }}
              >
                Register at orcid.org
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          {/* ORCID ID input */}
          <div className="space-y-1.5">
            <label
              htmlFor="orcid-id-input"
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]"
            >
              <Link className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              ORCID iD
            </label>
            <div className="flex gap-2">
              <input
                id="orcid-id-input"
                type="text"
                value={orcidInput}
                onChange={handleOrcidInputChange}
                placeholder="0000-0002-1825-0097"
                maxLength={19}
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 font-mono"
              />
              <button
                type="button"
                onClick={handleLookup}
                disabled={isLookingUp || orcidInput.length < 19}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLookingUp ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Look up
              </button>
            </div>
          </div>

          {/* Profile preview */}
          {previewProfile && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <OrcidIcon className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {previewProfile.name}
                    </p>
                    <p className="text-xs font-mono text-[var(--text-muted)]">
                      {previewProfile.orcidId}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 space-y-2">
                {previewProfile.affiliations.length > 0 && (
                  <div className="flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
                    <Building2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>
                      {previewProfile.affiliations[0].organization}
                      {previewProfile.affiliations[0].role && (
                        <> &mdash; {previewProfile.affiliations[0].role}</>
                      )}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <BookOpen className="w-3 h-3" />
                  <span>
                    {previewProfile.works.length} publication{previewProfile.works.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-[var(--border)]">
                <button
                  onClick={handleLink}
                  disabled={isLinking}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: ORCID_GREEN }}
                >
                  {isLinking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Link this ORCID
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
