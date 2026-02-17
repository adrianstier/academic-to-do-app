'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import type { OrcidProfile } from '@/types/orcid';

// ============================================
// Constants
// ============================================

const ORCID_GREEN = '#A6CE39';

// ============================================
// ORCID iD Icon (SVG)
// ============================================

function OrcidIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
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

interface OrcidBadgeProps {
  orcidId: string;
  compact?: boolean;
}

// ============================================
// Main Component
// ============================================

/**
 * OrcidBadge
 *
 * Small badge for displaying an ORCID iD on team member cards.
 * Shows the ORCID icon + truncated ID. Hover tooltip shows full name
 * and affiliation. Clicks open the ORCID profile in a new tab.
 */
export default function OrcidBadge({ orcidId, compact = false }: OrcidBadgeProps) {
  const [profile, setProfile] = useState<OrcidProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Fetch profile for tooltip content
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/integrations/orcid?orcidId=${encodeURIComponent(orcidId)}`
        );
        if (res.ok && !cancelled) {
          const json = await res.json();
          setProfile(json.data?.profile || null);
        } else if (!cancelled) {
          setHasError(true);
        }
      } catch {
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [orcidId]);

  // Truncate ORCID for compact display
  const displayId = compact
    ? `${orcidId.slice(0, 9)}...`
    : orcidId;

  // Build tooltip content
  const tooltipContent = isLoading ? (
    <div className="flex items-center gap-2 py-1">
      <Loader2 className="w-3 h-3 animate-spin" />
      <span className="text-xs">Loading profile...</span>
    </div>
  ) : profile ? (
    <div className="space-y-1 py-0.5">
      <p className="text-xs font-semibold">{profile.name}</p>
      {profile.affiliations.length > 0 && (
        <p className="text-xs opacity-80">
          {profile.affiliations[0].organization}
        </p>
      )}
      <p className="text-xs opacity-60 font-mono">{orcidId}</p>
    </div>
  ) : (
    <div className="py-0.5">
      <p className="text-xs font-mono">{orcidId}</p>
      {hasError && (
        <p className="text-xs opacity-60">Could not load profile</p>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position="top" maxWidth={280}>
      <a
        href={`https://orcid.org/${orcidId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="
          inline-flex items-center gap-1.5
          px-2 py-1 rounded-full
          text-xs font-medium
          border transition-colors
          hover:opacity-80
          cursor-pointer
        "
        style={{
          borderColor: `${ORCID_GREEN}40`,
          backgroundColor: `${ORCID_GREEN}10`,
          color: ORCID_GREEN,
        }}
        title={`View ORCID profile: ${orcidId}`}
      >
        <OrcidIcon size={14} />
        <span className="font-mono">{displayId}</span>
        {!compact && <ExternalLink className="w-3 h-3 opacity-60" />}
      </a>
    </Tooltip>
  );
}
