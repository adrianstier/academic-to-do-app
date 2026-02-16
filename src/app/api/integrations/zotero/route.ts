/**
 * Zotero Integration API - Connection Management
 *
 * GET    /api/integrations/zotero - Fetch connection status + recent items
 * POST   /api/integrations/zotero - Save/update connection settings
 * DELETE /api/integrations/zotero - Remove connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';
import { testConnection, getRecentItems } from '@/lib/zoteroClient';
import type { ZoteroConnection } from '@/types/reference';

/**
 * In-memory connection store (keyed by `userId` or `teamId:userId`).
 *
 * Production note: This should be replaced with Supabase storage
 * once a `zotero_connections` table is added. Using in-memory storage
 * here to avoid requiring a migration as part of this feature.
 */
const connectionStore = new Map<string, ZoteroConnection>();

function storeKey(context: TeamAuthContext): string {
  return context.teamId
    ? `${context.teamId}:${context.userId}`
    : context.userId;
}

/**
 * GET /api/integrations/zotero
 * Returns connection status and recent items if connected.
 */
export const GET = withTeamAuth(async (_request: NextRequest, context: TeamAuthContext) => {
  try {
    const key = storeKey(context);
    const connection = connectionStore.get(key);

    if (!connection) {
      return NextResponse.json({
        success: true,
        data: { connected: false, connection: null, recentItems: [] },
      });
    }

    // Fetch recent items to confirm connection is still valid
    let recentItems: Awaited<ReturnType<typeof getRecentItems>> = [];
    let connected = false;
    try {
      recentItems = await getRecentItems(connection, 10);
      connected = true;
    } catch {
      connected = false;
    }

    return NextResponse.json({
      success: true,
      data: {
        connected,
        connection: {
          userId: connection.userId,
          libraryType: connection.libraryType,
          libraryId: connection.libraryId,
          connected,
          lastSync: connection.lastSync,
          // Never return the API key to the client
        },
        recentItems,
      },
    });
  } catch (error) {
    logger.error('Error fetching Zotero connection', error as Error, {
      component: 'api/integrations/zotero',
      action: 'GET',
    });
    return NextResponse.json(
      { error: 'Failed to fetch Zotero connection' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/integrations/zotero
 * Save or update Zotero connection settings.
 */
export const POST = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const { userId, apiKey, libraryType = 'user', libraryId } = body;

    if (!userId || !userId.trim()) {
      return NextResponse.json(
        { error: 'Zotero User ID is required' },
        { status: 400 }
      );
    }

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        { error: 'Zotero API Key is required' },
        { status: 400 }
      );
    }

    const connection: ZoteroConnection = {
      userId: userId.trim(),
      apiKey: apiKey.trim(),
      libraryType,
      libraryId: libraryId?.trim() || userId.trim(),
      connected: false,
    };

    // Test the connection
    const isValid = await testConnection(connection);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Could not connect to Zotero. Please check your User ID and API Key.' },
        { status: 400 }
      );
    }

    connection.connected = true;
    connection.lastSync = new Date().toISOString();

    const key = storeKey(context);
    connectionStore.set(key, connection);

    logger.info('Zotero connection saved', {
      component: 'api/integrations/zotero',
      action: 'POST',
      userId: context.userId,
      zoteroUserId: userId,
      libraryType,
    });

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        connection: {
          userId: connection.userId,
          libraryType: connection.libraryType,
          libraryId: connection.libraryId,
          connected: true,
          lastSync: connection.lastSync,
        },
      },
    });
  } catch (error) {
    logger.error('Error saving Zotero connection', error as Error, {
      component: 'api/integrations/zotero',
      action: 'POST',
    });
    return NextResponse.json(
      { error: 'Failed to save Zotero connection' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/integrations/zotero
 * Remove the Zotero connection.
 */
export const DELETE = withTeamAuth(async (_request: NextRequest, context: TeamAuthContext) => {
  try {
    const key = storeKey(context);
    connectionStore.delete(key);

    logger.info('Zotero connection removed', {
      component: 'api/integrations/zotero',
      action: 'DELETE',
      userId: context.userId,
    });

    return NextResponse.json({
      success: true,
      data: { connected: false },
    });
  } catch (error) {
    logger.error('Error removing Zotero connection', error as Error, {
      component: 'api/integrations/zotero',
      action: 'DELETE',
    });
    return NextResponse.json(
      { error: 'Failed to remove Zotero connection' },
      { status: 500 }
    );
  }
});
