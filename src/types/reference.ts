/**
 * Zotero Reference Management Types
 *
 * Types for integrating Zotero reference libraries with tasks.
 * Supports linking academic references to tasks for research workflows.
 */

export interface ZoteroReference {
  key: string;              // Zotero item key
  title: string;
  authors: string[];
  year: number | null;
  journal?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  itemType: string;         // e.g., 'journalArticle', 'book', 'conferencePaper'
  tags: string[];
  dateAdded: string;
}

export interface ZoteroCollection {
  key: string;
  name: string;
  parentCollection: string | null;
  numItems: number;
}

export interface ZoteroConnection {
  userId: string;
  apiKey: string;
  libraryType: 'user' | 'group';
  libraryId: string;
  connected: boolean;
  lastSync?: string;
}

export interface TaskReference {
  todo_id: string;
  zotero_key: string;
  reference: ZoteroReference;
  linked_at: string;
  note?: string;           // User's note about why this reference is linked
}

/**
 * Zotero item type display configuration
 */
export const ZOTERO_ITEM_TYPE_CONFIG: Record<string, { label: string; icon: 'article' | 'book' | 'conference' | 'thesis' | 'report' | 'other' }> = {
  journalArticle: { label: 'Journal Article', icon: 'article' },
  book: { label: 'Book', icon: 'book' },
  bookSection: { label: 'Book Section', icon: 'book' },
  conferencePaper: { label: 'Conference Paper', icon: 'conference' },
  thesis: { label: 'Thesis', icon: 'thesis' },
  report: { label: 'Report', icon: 'report' },
  preprint: { label: 'Preprint', icon: 'article' },
  manuscript: { label: 'Manuscript', icon: 'article' },
  webpage: { label: 'Web Page', icon: 'other' },
  document: { label: 'Document', icon: 'other' },
  presentation: { label: 'Presentation', icon: 'conference' },
  patent: { label: 'Patent', icon: 'report' },
  dataset: { label: 'Dataset', icon: 'report' },
};
