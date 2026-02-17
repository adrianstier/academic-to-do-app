'use client';

import { useState } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  BookOpen,
  Building2,
  GraduationCap,
  Tag,
  Calendar,
  FileText,
} from 'lucide-react';
import type { OrcidProfile, OrcidAffiliation, OrcidWork } from '@/types/orcid';

// ============================================
// Constants
// ============================================

const ORCID_GREEN = '#A6CE39';
const MAX_WORKS_SHOWN = 10;

// ============================================
// ORCID iD Icon (SVG)
// ============================================

function OrcidIcon({ size = 20 }: { size?: number }) {
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

interface OrcidProfileCardProps {
  profile: OrcidProfile;
}

// ============================================
// Sub-Components
// ============================================

function AffiliationItem({ affiliation }: { affiliation: OrcidAffiliation }) {
  const icon =
    affiliation.type === 'education' ? (
      <GraduationCap className="w-4 h-4 flex-shrink-0 text-[var(--text-muted)]" />
    ) : (
      <Building2 className="w-4 h-4 flex-shrink-0 text-[var(--text-muted)]" />
    );

  const dateRange = [affiliation.startDate, affiliation.endDate || 'Present']
    .filter(Boolean)
    .join(' - ');

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)]">
          {affiliation.organization}
        </p>
        {(affiliation.role || affiliation.department) && (
          <p className="text-xs text-[var(--text-muted)]">
            {[affiliation.role, affiliation.department].filter(Boolean).join(', ')}
          </p>
        )}
        {dateRange && (
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3" />
            {dateRange}
          </p>
        )}
      </div>
    </div>
  );
}

function WorkItem({ work }: { work: OrcidWork }) {
  const typeLabels: Record<string, string> = {
    'journal-article': 'Article',
    book: 'Book',
    'book-chapter': 'Chapter',
    'conference-paper': 'Conference',
    'edited-book': 'Edited Book',
    dissertation: 'Dissertation',
    preprint: 'Preprint',
    report: 'Report',
    other: 'Other',
  };

  const typeLabel = typeLabels[work.type] || work.type;

  return (
    <div className="flex items-start gap-3 py-2">
      <FileText className="w-4 h-4 flex-shrink-0 text-[var(--text-muted)] mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)] leading-snug">
          {work.url || work.doi ? (
            <a
              href={work.url || `https://doi.org/${work.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {work.title}
            </a>
          ) : (
            work.title
          )}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          {work.journal && (
            <span className="text-xs text-[var(--text-muted)] italic">
              {work.journal}
            </span>
          )}
          {work.year && (
            <span className="text-xs text-[var(--text-muted)]">
              ({work.year})
            </span>
          )}
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: `${ORCID_GREEN}15`,
              color: ORCID_GREEN,
            }}
          >
            {typeLabel}
          </span>
        </div>
        {work.doi && (
          <a
            href={`https://doi.org/${work.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-0.5 mt-0.5"
          >
            doi:{work.doi}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

/**
 * OrcidProfileCard
 *
 * Full profile display card showing:
 * - Header with name, ORCID iD, copy button, biography
 * - Affiliations section (employment + education)
 * - Recent works (publications) with DOI links
 * - Keywords as tag chips
 * - Link to full ORCID profile
 */
export default function OrcidProfileCard({ profile }: OrcidProfileCardProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [showAllWorks, setShowAllWorks] = useState(false);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(profile.orcidId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const displayedWorks = showAllWorks
    ? profile.works
    : profile.works.slice(0, MAX_WORKS_SHOWN);

  const employments = profile.affiliations.filter((a) => a.type === 'employment');
  const educations = profile.affiliations.filter((a) => a.type === 'education');

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4 border-b border-[var(--border)]"
        style={{ backgroundColor: `${ORCID_GREEN}08` }}
      >
        <div className="flex items-start gap-3">
          <OrcidIcon size={40} />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              {profile.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono text-[var(--text-muted)]">
                {profile.orcidId}
              </span>
              <button
                onClick={handleCopyId}
                className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                title="Copy ORCID iD"
              >
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
          <a
            href={`https://orcid.org/${profile.orcidId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 text-white flex-shrink-0"
            style={{ backgroundColor: ORCID_GREEN }}
          >
            View on ORCID
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Biography */}
        {profile.biography && (
          <p className="mt-3 text-sm text-[var(--text-muted)] leading-relaxed">
            {profile.biography}
          </p>
        )}
      </div>

      {/* Content sections */}
      <div className="divide-y divide-[var(--border)]">
        {/* Affiliations — Employment */}
        {employments.length > 0 && (
          <div className="px-5 py-4">
            <h4 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4" style={{ color: ORCID_GREEN }} />
              Employment
            </h4>
            <div className="divide-y divide-[var(--border)]/50">
              {employments.map((aff, i) => (
                <AffiliationItem key={`emp-${i}`} affiliation={aff} />
              ))}
            </div>
          </div>
        )}

        {/* Affiliations — Education */}
        {educations.length > 0 && (
          <div className="px-5 py-4">
            <h4 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2 mb-2">
              <GraduationCap className="w-4 h-4" style={{ color: ORCID_GREEN }} />
              Education
            </h4>
            <div className="divide-y divide-[var(--border)]/50">
              {educations.map((aff, i) => (
                <AffiliationItem key={`edu-${i}`} affiliation={aff} />
              ))}
            </div>
          </div>
        )}

        {/* Works / Publications */}
        {profile.works.length > 0 && (
          <div className="px-5 py-4">
            <h4 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4" style={{ color: ORCID_GREEN }} />
              Publications
              <span className="text-xs font-normal text-[var(--text-muted)]">
                ({profile.works.length})
              </span>
            </h4>
            <div className="divide-y divide-[var(--border)]/50">
              {displayedWorks.map((work, i) => (
                <WorkItem key={`work-${i}`} work={work} />
              ))}
            </div>
            {profile.works.length > MAX_WORKS_SHOWN && (
              <button
                onClick={() => setShowAllWorks(!showAllWorks)}
                className="mt-2 text-xs font-medium transition-colors hover:underline"
                style={{ color: ORCID_GREEN }}
              >
                {showAllWorks
                  ? 'Show fewer'
                  : `Show all ${profile.works.length} publications`}
              </button>
            )}
          </div>
        )}

        {/* Keywords */}
        {profile.keywords.length > 0 && (
          <div className="px-5 py-4">
            <h4 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4" style={{ color: ORCID_GREEN }} />
              Keywords
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {profile.keywords.map((keyword, i) => (
                <span
                  key={`kw-${i}`}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border"
                  style={{
                    borderColor: `${ORCID_GREEN}30`,
                    backgroundColor: `${ORCID_GREEN}10`,
                    color: ORCID_GREEN,
                  }}
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {profile.works.length === 0 &&
          profile.affiliations.length === 0 &&
          profile.keywords.length === 0 && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                No public information available for this ORCID profile.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
