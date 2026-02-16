/**
 * Zotero API Client
 *
 * Provides typed access to the Zotero Web API v3 for reading
 * user/group libraries. Handles pagination, rate limiting, and
 * response transformation to our ZoteroReference type.
 *
 * Docs: https://www.zotero.org/support/dev/web_api/v3/start
 */

import type { ZoteroReference, ZoteroCollection, ZoteroConnection } from '@/types/reference';

const ZOTERO_API_BASE = 'https://api.zotero.org';
const ZOTERO_API_VERSION = '3';

/** Maximum number of items per API request (Zotero limit is 100) */
const DEFAULT_LIMIT = 25;

/** Delay in ms before retrying after a 429 rate limit response */
const RATE_LIMIT_INITIAL_DELAY = 1000;
const RATE_LIMIT_MAX_RETRIES = 3;

// ============================================
// Internal helpers
// ============================================

/**
 * Build the library prefix for API URLs.
 * User libraries: /users/{userId}
 * Group libraries: /groups/{libraryId}
 */
function getLibraryPrefix(connection: ZoteroConnection): string {
  if (connection.libraryType === 'group') {
    return `/groups/${connection.libraryId}`;
  }
  return `/users/${connection.userId}`;
}

/**
 * Build standard headers for Zotero API requests.
 */
function getHeaders(connection: ZoteroConnection): Record<string, string> {
  return {
    'Zotero-API-Key': connection.apiKey,
    'Zotero-API-Version': ZOTERO_API_VERSION,
    'Content-Type': 'application/json',
  };
}

/**
 * Fetch with automatic retry on 429 rate limit responses.
 * Uses exponential back-off with jitter.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = RATE_LIMIT_MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        // Rate limited — check Retry-After header or use exponential backoff
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : RATE_LIMIT_INITIAL_DELAY * Math.pow(2, attempt) + Math.random() * 500;

        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, RATE_LIMIT_INITIAL_DELAY * Math.pow(2, attempt))
        );
      }
    }
  }

  throw lastError || new Error('Zotero API request failed after retries');
}

// ============================================
// Response transformers
// ============================================

/**
 * Extract author names from the Zotero creator array.
 * Handles both single-field and two-field name formats.
 */
function extractAuthors(creators?: ZoteroCreator[]): string[] {
  if (!creators || !Array.isArray(creators)) return [];
  return creators
    .filter((c) => c.creatorType === 'author' || c.creatorType === 'editor')
    .map((c) => {
      if (c.name) return c.name;
      return [c.lastName, c.firstName].filter(Boolean).join(', ');
    });
}

interface ZoteroCreator {
  creatorType: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

interface ZoteroItemData {
  key: string;
  title?: string;
  creators?: ZoteroCreator[];
  date?: string;
  publicationTitle?: string;
  DOI?: string;
  url?: string;
  abstractNote?: string;
  itemType: string;
  tags?: Array<{ tag: string; type?: number }>;
  dateAdded?: string;
}

interface ZoteroItemResponse {
  key: string;
  data: ZoteroItemData;
}

/**
 * Parse year from Zotero's free-form date field.
 * Zotero stores dates like "2024", "2024-01-15", "January 2024", etc.
 */
function parseYear(dateStr?: string): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Transform a Zotero API item response to our ZoteroReference type.
 */
function transformItem(item: ZoteroItemResponse): ZoteroReference {
  const data = item.data;
  return {
    key: item.key,
    title: data.title || 'Untitled',
    authors: extractAuthors(data.creators),
    year: parseYear(data.date),
    journal: data.publicationTitle || undefined,
    doi: data.DOI || undefined,
    url: data.url || undefined,
    abstract: data.abstractNote || undefined,
    itemType: data.itemType,
    tags: (data.tags || []).map((t) => t.tag),
    dateAdded: data.dateAdded || new Date().toISOString(),
  };
}

interface ZoteroCollectionData {
  key: string;
  name: string;
  parentCollection: string | false;
  numItems?: number;
}

interface ZoteroCollectionResponse {
  key: string;
  data: ZoteroCollectionData;
  meta?: { numItems?: number };
}

/**
 * Transform a Zotero API collection response to our ZoteroCollection type.
 */
function transformCollection(col: ZoteroCollectionResponse): ZoteroCollection {
  return {
    key: col.key,
    name: col.data.name,
    parentCollection: col.data.parentCollection === false ? null : col.data.parentCollection,
    numItems: col.meta?.numItems ?? col.data.numItems ?? 0,
  };
}

// ============================================
// Public API
// ============================================

export interface GetItemsParams {
  collectionKey?: string;
  start?: number;
  limit?: number;
  sort?: 'dateAdded' | 'dateModified' | 'title' | 'creator' | 'date';
  direction?: 'asc' | 'desc';
}

/**
 * Get collections from the user's Zotero library.
 */
export async function getCollections(connection: ZoteroConnection): Promise<ZoteroCollection[]> {
  const prefix = getLibraryPrefix(connection);
  const url = `${ZOTERO_API_BASE}${prefix}/collections?format=json`;

  const response = await fetchWithRetry(url, {
    headers: getHeaders(connection),
  });

  if (!response.ok) {
    throw new Error(`Zotero API error: ${response.status} ${response.statusText}`);
  }

  const data: ZoteroCollectionResponse[] = await response.json();
  return data.map(transformCollection);
}

/**
 * Get items from the user's Zotero library with optional filtering.
 * Supports pagination via `start` and `limit` params.
 */
export async function getItems(
  connection: ZoteroConnection,
  params: GetItemsParams = {}
): Promise<ZoteroReference[]> {
  const prefix = getLibraryPrefix(connection);
  const {
    collectionKey,
    start = 0,
    limit = DEFAULT_LIMIT,
    sort = 'dateAdded',
    direction = 'desc',
  } = params;

  const basePath = collectionKey
    ? `${prefix}/collections/${collectionKey}/items`
    : `${prefix}/items`;

  const searchParams = new URLSearchParams({
    format: 'json',
    start: String(start),
    limit: String(limit),
    sort,
    direction,
    itemType: '-attachment || note', // Exclude attachments and notes
  });

  const url = `${ZOTERO_API_BASE}${basePath}?${searchParams.toString()}`;

  const response = await fetchWithRetry(url, {
    headers: getHeaders(connection),
  });

  if (!response.ok) {
    throw new Error(`Zotero API error: ${response.status} ${response.statusText}`);
  }

  const data: ZoteroItemResponse[] = await response.json();
  return data.map(transformItem);
}

/**
 * Search items in the user's Zotero library.
 * Uses Zotero's built-in quick search across title, creator, year, and tags.
 */
export async function searchItems(
  connection: ZoteroConnection,
  query: string,
  collectionKey?: string
): Promise<ZoteroReference[]> {
  const prefix = getLibraryPrefix(connection);

  const basePath = collectionKey
    ? `${prefix}/collections/${collectionKey}/items`
    : `${prefix}/items`;

  const searchParams = new URLSearchParams({
    format: 'json',
    q: query,
    qmode: 'everything',
    limit: String(DEFAULT_LIMIT),
    sort: 'relevance',
    itemType: '-attachment || note',
  });

  const url = `${ZOTERO_API_BASE}${basePath}?${searchParams.toString()}`;

  const response = await fetchWithRetry(url, {
    headers: getHeaders(connection),
  });

  if (!response.ok) {
    throw new Error(`Zotero API error: ${response.status} ${response.statusText}`);
  }

  const data: ZoteroItemResponse[] = await response.json();
  return data.map(transformItem);
}

/**
 * Get a single item by its key.
 */
export async function getItem(
  connection: ZoteroConnection,
  key: string
): Promise<ZoteroReference> {
  const prefix = getLibraryPrefix(connection);
  const url = `${ZOTERO_API_BASE}${prefix}/items/${key}?format=json`;

  const response = await fetchWithRetry(url, {
    headers: getHeaders(connection),
  });

  if (!response.ok) {
    throw new Error(`Zotero API error: ${response.status} ${response.statusText}`);
  }

  const data: ZoteroItemResponse = await response.json();
  return transformItem(data);
}

/**
 * Get the most recently added items from the library.
 */
export async function getRecentItems(
  connection: ZoteroConnection,
  limit = 10
): Promise<ZoteroReference[]> {
  return getItems(connection, {
    limit,
    sort: 'dateAdded',
    direction: 'desc',
  });
}

/**
 * Test a Zotero connection by fetching the first item.
 * Returns true if the connection is valid and working.
 */
export async function testConnection(connection: ZoteroConnection): Promise<boolean> {
  try {
    const prefix = getLibraryPrefix(connection);
    const url = `${ZOTERO_API_BASE}${prefix}/items?format=json&limit=1`;

    const response = await fetchWithRetry(url, {
      headers: getHeaders(connection),
    });

    return response.ok;
  } catch {
    return false;
  }
}
