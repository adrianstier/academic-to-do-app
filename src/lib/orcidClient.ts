/**
 * ORCID Public API Client
 *
 * Fetches researcher profiles, publications, and affiliations from the
 * ORCID public API (v3.0). No OAuth needed for reading public data.
 *
 * Base URL: https://pub.orcid.org/v3.0
 * Docs: https://info.orcid.org/documentation/api-tutorials/
 */

import type {
  OrcidProfile,
  OrcidAffiliation,
  OrcidWork,
} from '@/types/orcid';

// ============================================
// Constants
// ============================================

const ORCID_API_BASE = 'https://pub.orcid.org/v3.0';

const DEFAULT_HEADERS: HeadersInit = {
  Accept: 'application/json',
};

/** Maximum retries on rate-limit (429) responses */
const MAX_RETRIES = 2;

/** Default backoff if no Retry-After header is provided (in ms) */
const DEFAULT_RETRY_DELAY = 2000;

// ============================================
// Validation
// ============================================

/**
 * Validate an ORCID iD format (XXXX-XXXX-XXXX-XXXX).
 *
 * The last character may be a digit or 'X' (checksum).
 * Uses the ISO 7064 Mod 11,2 checksum algorithm.
 */
export function validateOrcidId(id: string): boolean {
  // Basic format check
  const pattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
  if (!pattern.test(id)) {
    return false;
  }

  // ISO 7064 Mod 11,2 checksum validation
  const digits = id.replace(/-/g, '');
  let total = 0;

  for (let i = 0; i < digits.length - 1; i++) {
    const digit = parseInt(digits[i], 10);
    total = (total + digit) * 2;
  }

  const remainder = total % 11;
  const checkDigit = (12 - remainder) % 11;
  const expectedCheck = checkDigit === 10 ? 'X' : checkDigit.toString();

  return digits[digits.length - 1] === expectedCheck;
}

// ============================================
// Internal Fetch Helper
// ============================================

/**
 * Fetch from the ORCID API with rate-limit retry support.
 */
async function orcidFetch(path: string, retries = 0): Promise<Response> {
  const url = `${ORCID_API_BASE}${path}`;

  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
    next: { revalidate: 300 }, // Cache for 5 minutes in Next.js
  });

  // Handle rate limiting
  if (response.status === 429 && retries < MAX_RETRIES) {
    const retryAfter = response.headers.get('Retry-After');
    const delay = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : DEFAULT_RETRY_DELAY;

    await new Promise((resolve) => setTimeout(resolve, delay));
    return orcidFetch(path, retries + 1);
  }

  return response;
}

// ============================================
// Transform Helpers
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Build a date string from ORCID's year/month/day object.
 */
function formatOrcidDate(dateObj: any): string | undefined {
  if (!dateObj) return undefined;

  const year = dateObj.year?.value;
  const month = dateObj.month?.value;
  const day = dateObj.day?.value;

  if (!year) return undefined;

  const parts = [year];
  if (month) parts.push(month.padStart(2, '0'));
  if (day) parts.push(day.padStart(2, '0'));

  return parts.join('-');
}

/**
 * Extract affiliations from an ORCID activities summary.
 */
function transformAffiliations(
  activitiesSummary: any,
  type: OrcidAffiliation['type']
): OrcidAffiliation[] {
  const sectionKey = `${type}s`;
  const groupKey = `affiliation-group`;

  const section = activitiesSummary?.[sectionKey];
  if (!section) return [];

  const groups: any[] = section[groupKey] || [];

  return groups
    .map((group: any) => {
      const summaries = group.summaries || [];
      const summary = summaries[0]?.[`${type}-summary`];
      if (!summary) return null;

      return {
        organization: summary.organization?.name || 'Unknown',
        department: summary['department-name'] || undefined,
        role: summary['role-title'] || undefined,
        startDate: formatOrcidDate(summary['start-date']),
        endDate: formatOrcidDate(summary['end-date']),
        type,
      } as OrcidAffiliation;
    })
    .filter((a): a is OrcidAffiliation => a !== null);
}

/**
 * Extract works from an ORCID activities summary.
 */
function transformWorks(activitiesSummary: any): OrcidWork[] {
  const worksSection = activitiesSummary?.works;
  if (!worksSection) return [];

  const groups: any[] = worksSection.group || [];

  return groups
    .map((group: any) => {
      const summaries = group['work-summary'] || [];
      const summary = summaries[0];
      if (!summary) return null;

      // Extract DOI from external IDs
      const externalIds: any[] =
        summary['external-ids']?.['external-id'] || [];
      const doiEntry = externalIds.find(
        (eid: any) => eid['external-id-type'] === 'doi'
      );
      const doi = doiEntry?.['external-id-value'] || undefined;

      // Extract URL
      const url = summary.url?.value || (doi ? `https://doi.org/${doi}` : undefined);

      return {
        title: summary.title?.title?.value || 'Untitled',
        type: summary.type || 'other',
        journal: summary['journal-title']?.value || undefined,
        year: summary['publication-date']?.year?.value
          ? parseInt(summary['publication-date'].year.value, 10)
          : undefined,
        doi,
        url,
        contributors: [], // Contributors not in summary; would need full work fetch
      } as OrcidWork;
    })
    .filter((w): w is OrcidWork => w !== null)
    .sort((a, b) => (b.year || 0) - (a.year || 0));
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ============================================
// Public API Methods
// ============================================

/**
 * Fetch and transform the full ORCID profile record.
 *
 * Combines personal info with activities (works + affiliations).
 *
 * @throws Error if ORCID ID is invalid or profile not found
 */
export async function fetchProfile(orcidId: string): Promise<OrcidProfile> {
  if (!validateOrcidId(orcidId)) {
    throw new Error(`Invalid ORCID iD format: ${orcidId}`);
  }

  const response = await orcidFetch(`/${orcidId}/record`);

  if (response.status === 404) {
    throw new Error(`ORCID profile not found: ${orcidId}`);
  }

  if (!response.ok) {
    throw new Error(
      `ORCID API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  // Extract personal info
  const person = data.person || {};
  const name = person.name || {};
  const givenNames = name['given-names']?.value || '';
  const familyName = name['family-name']?.value || '';
  const displayName = [givenNames, familyName].filter(Boolean).join(' ') || orcidId;

  // Biography
  const biography = person.biography?.content || undefined;

  // Emails (only public ones)
  const emailEntries = person.emails?.email || [];
  const emails = emailEntries
    .filter((e: { visibility: string }) => e.visibility === 'PUBLIC')
    .map((e: { email: string }) => e.email);

  // Keywords
  const keywordEntries = person.keywords?.keyword || [];
  const keywords = keywordEntries.map(
    (k: { content: string }) => k.content
  );

  // Activities
  const activities = data['activities-summary'] || {};

  // Affiliations — combine employment and education
  const employments = transformAffiliations(activities, 'employment');
  const educations = transformAffiliations(activities, 'education');
  const affiliations = [...employments, ...educations];

  // Works
  const works = transformWorks(activities);

  // Last modified
  const lastUpdated =
    data.history?.['last-modified-date']?.value
      ? new Date(data.history['last-modified-date'].value).toISOString()
      : new Date().toISOString();

  return {
    orcidId,
    name: displayName,
    givenNames,
    familyName,
    biography,
    affiliations,
    works,
    emails,
    keywords,
    lastUpdated,
  };
}

/**
 * Fetch only the works (publications) for an ORCID iD.
 */
export async function fetchWorks(orcidId: string): Promise<OrcidWork[]> {
  if (!validateOrcidId(orcidId)) {
    throw new Error(`Invalid ORCID iD format: ${orcidId}`);
  }

  const response = await orcidFetch(`/${orcidId}/works`);

  if (response.status === 404) {
    throw new Error(`ORCID profile not found: ${orcidId}`);
  }

  if (!response.ok) {
    throw new Error(
      `ORCID API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const groups = data.group || [];

  return groups
    .map((group: Record<string, unknown>) => {
      const summaries = (group['work-summary'] as Record<string, unknown>[]) || [];
      const summary = summaries[0] as Record<string, unknown> | undefined;
      if (!summary) return null;

      const externalIds = (
        (summary['external-ids'] as Record<string, unknown>)?.['external-id'] as Record<string, unknown>[]
      ) || [];
      const doiEntry = externalIds.find(
        (eid) => eid['external-id-type'] === 'doi'
      );
      const doi = (doiEntry?.['external-id-value'] as string) || undefined;
      const url =
        (summary.url as Record<string, unknown>)?.value as string ||
        (doi ? `https://doi.org/${doi}` : undefined);

      return {
        title:
          ((summary.title as Record<string, unknown>)?.title as Record<string, unknown>)?.value as string ||
          'Untitled',
        type: (summary.type as string) || 'other',
        journal:
          (summary['journal-title'] as Record<string, unknown>)?.value as string ||
          undefined,
        year: (summary['publication-date'] as Record<string, unknown>)?.year
          ? parseInt(
              ((summary['publication-date'] as Record<string, unknown>).year as Record<string, unknown>)
                ?.value as string,
              10
            )
          : undefined,
        doi,
        url,
        contributors: [],
      } as OrcidWork;
    })
    .filter((w: OrcidWork | null): w is OrcidWork => w !== null)
    .sort((a: OrcidWork, b: OrcidWork) => (b.year || 0) - (a.year || 0));
}

/**
 * Fetch only affiliations (employment + education) for an ORCID iD.
 */
export async function fetchAffiliations(
  orcidId: string
): Promise<OrcidAffiliation[]> {
  if (!validateOrcidId(orcidId)) {
    throw new Error(`Invalid ORCID iD format: ${orcidId}`);
  }

  const response = await orcidFetch(`/${orcidId}/record`);

  if (response.status === 404) {
    throw new Error(`ORCID profile not found: ${orcidId}`);
  }

  if (!response.ok) {
    throw new Error(
      `ORCID API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const activities = data['activities-summary'] || {};

  const employments = transformAffiliations(activities, 'employment');
  const educations = transformAffiliations(activities, 'education');

  return [...employments, ...educations];
}

/**
 * Search the ORCID registry by name.
 *
 * Uses the ORCID search API with Lucene-style queries.
 * Returns basic profile info for matching records.
 */
export async function searchByName(
  query: string
): Promise<
  Array<{
    orcidId: string;
    givenNames: string;
    familyName: string;
    institution?: string;
  }>
> {
  if (!query.trim()) {
    return [];
  }

  // Escape special Lucene characters
  const escaped = query.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, '\\$&');

  const response = await orcidFetch(
    `/search/?q=${encodeURIComponent(escaped)}&rows=10`
  );

  if (!response.ok) {
    throw new Error(
      `ORCID search error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const results = data.result || [];

  return results
    .map(
      (entry: {
        'orcid-identifier': { path: string };
      }) => {
        const orcidId = entry['orcid-identifier']?.path;
        if (!orcidId) return null;

        return {
          orcidId,
          givenNames: '',
          familyName: '',
          institution: undefined,
        };
      }
    )
    .filter(
      (
        r: { orcidId: string; givenNames: string; familyName: string; institution?: string } | null
      ): r is { orcidId: string; givenNames: string; familyName: string; institution?: string } =>
        r !== null
    );
}
