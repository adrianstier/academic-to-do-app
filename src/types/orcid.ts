/**
 * ORCID (Open Researcher and Contributor ID) Types
 *
 * Types for integrating with the ORCID public API (v3.0).
 * ORCID provides persistent digital identifiers for researchers.
 */

export interface OrcidProfile {
  orcidId: string;           // e.g., "0000-0002-1825-0097"
  name: string;
  givenNames: string;
  familyName: string;
  biography?: string;
  affiliations: OrcidAffiliation[];
  works: OrcidWork[];
  emails: string[];
  keywords: string[];
  lastUpdated: string;
}

export interface OrcidAffiliation {
  organization: string;
  department?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  type: 'employment' | 'education' | 'qualification' | 'distinction';
}

export interface OrcidWork {
  title: string;
  type: string;              // journal-article, book, conference-paper, etc.
  journal?: string;
  year?: number;
  doi?: string;
  url?: string;
  contributors: string[];
}

export interface TeamMemberOrcid {
  userId: string;
  orcidId: string;
  profile: OrcidProfile;
  linkedAt: string;
}
