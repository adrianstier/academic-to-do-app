/**
 * Zotero Search API
 *
 * GET /api/integrations/zotero/search?q=search+term&collection=key
 * Proxies search to Zotero API and returns ZoteroReference[].
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';
import { searchItems, getItems, getCollections } from '@/lib/zoteroClient';
import type { ZoteroConnection } from '@/types/reference';

/**
 * Shared connection store reference.
 *
 * In production, this should read from Supabase. For now, we replicate
 * the in-memory store pattern used in the parent route.
 */
const connectionStore = new Map<string, ZoteroConnection>();

/** Re-export so the parent route's POST can also populate this store */
export { connectionStore as zoteroSearchConnectionStore };

function storeKey(context: TeamAuthContext): string {
  return context.teamId
    ? `${context.teamId}:${context.userId}`
    : context.userId;
}

/**
 * GET /api/integrations/zotero/search
 *
 * Query params:
 *  - q: Search query string (searches title, author, year, tags)
 *  - collection: Optional Zotero collection key to scope the search
 *  - mode: 'search' (default) | 'collections' | 'items'
 *  - start: Pagination offset (default 0)
 *  - limit: Number of results (default 25, max 100)
 */
export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const key = storeKey(context);
    const connection = connectionStore.get(key);

    if (!connection) {
      return NextResponse.json(
        { error: 'Zotero is not connected. Please configure your connection in settings.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const collectionKey = searchParams.get('collection') || undefined;
    const mode = searchParams.get('mode') || 'search';
    const start = parseInt(searchParams.get('start') || '0', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);

    // Collections mode — return the collection tree
    if (mode === 'collections') {
      const collections = await getCollections(connection);
      return NextResponse.json({
        success: true,
        data: collections,
      });
    }

    // Items mode — browse items in a collection (or top-level)
    if (mode === 'items') {
      const items = await getItems(connection, {
        collectionKey,
        start,
        limit,
        sort: 'dateAdded',
        direction: 'desc',
      });
      return NextResponse.json({
        success: true,
        data: items,
      });
    }

    // Search mode (default) — search by query
    if (!query.trim()) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const results = await searchItems(connection, query, collectionKey);

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('Error searching Zotero', error as Error, {
      component: 'api/integrations/zotero/search',
      action: 'GET',
    });
    return NextResponse.json(
      { error: 'Failed to search Zotero library' },
      { status: 500 }
    );
  }
});
