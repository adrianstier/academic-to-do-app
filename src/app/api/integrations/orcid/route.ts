/**
 * ORCID Integration API - Profile Lookup & Link Management
 *
 * GET    /api/integrations/orcid?orcidId=XXXX-XXXX-XXXX-XXXX  - Fetch profile
 * GET    /api/integrations/orcid?search=name                    - Search by name
 * POST   /api/integrations/orcid                                - Link ORCID to user
 * DELETE /api/integrations/orcid                                - Unlink ORCID
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';
import {
  fetchProfile,
  searchByName,
  validateOrcidId,
} from '@/lib/orcidClient';
import type { TeamMemberOrcid } from '@/types/orcid';

/**
 * In-memory store for ORCID links (keyed by `userId` or `teamId:userId`).
 *
 * Production note: This should be replaced with Supabase storage
 * once an `orcid_links` table is added. Using in-memory storage
 * here to avoid requiring a migration as part of this feature.
 */
const orcidLinkStore = new Map<string, TeamMemberOrcid>();

function storeKey(context: TeamAuthContext): string {
  return context.teamId
    ? `${context.teamId}:${context.userId}`
    : context.userId;
}

/**
 * GET /api/integrations/orcid
 *
 * Query params:
 *  - orcidId: Fetch a specific ORCID profile
 *  - search:  Search ORCID registry by name
 *  - (none):  Return the current user's linked ORCID, if any
 */
export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const orcidId = searchParams.get('orcidId');
    const search = searchParams.get('search');

    // Fetch a specific ORCID profile
    if (orcidId) {
      if (!validateOrcidId(orcidId)) {
        return NextResponse.json(
          { error: 'Invalid ORCID iD format. Expected XXXX-XXXX-XXXX-XXXX.' },
          { status: 400 }
        );
      }

      try {
        const profile = await fetchProfile(orcidId);
        return NextResponse.json({ success: true, data: { profile } });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const status = message.includes('not found') ? 404 : 502;
        return NextResponse.json({ error: message }, { status });
      }
    }

    // Search ORCID registry by name
    if (search) {
      if (search.trim().length < 2) {
        return NextResponse.json(
          { error: 'Search query must be at least 2 characters.' },
          { status: 400 }
        );
      }

      try {
        const results = await searchByName(search);
        return NextResponse.json({ success: true, data: { results } });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Search failed';
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    // Default: return the current user's linked ORCID
    const key = storeKey(context);
    const link = orcidLinkStore.get(key);

    return NextResponse.json({
      success: true,
      data: {
        linked: !!link,
        orcid: link || null,
      },
    });
  } catch (error) {
    logger.error('Error in ORCID GET', error as Error, {
      component: 'api/integrations/orcid',
      action: 'GET',
    });
    return NextResponse.json(
      { error: 'Failed to process ORCID request' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/integrations/orcid
 *
 * Link an ORCID iD to the current user. Fetches the profile to verify
 * the ORCID exists before saving the link.
 *
 * Body: { orcidId: string }
 */
export const POST = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const { orcidId } = body;

    if (!orcidId || typeof orcidId !== 'string') {
      return NextResponse.json(
        { error: 'ORCID iD is required.' },
        { status: 400 }
      );
    }

    const trimmedId = orcidId.trim();

    if (!validateOrcidId(trimmedId)) {
      return NextResponse.json(
        { error: 'Invalid ORCID iD format. Expected XXXX-XXXX-XXXX-XXXX.' },
        { status: 400 }
      );
    }

    // Fetch profile to verify it exists
    let profile;
    try {
      profile = await fetchProfile(trimmedId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not verify ORCID';
      return NextResponse.json(
        { error: `Could not verify ORCID: ${message}` },
        { status: 400 }
      );
    }

    // Save the link
    const key = storeKey(context);
    const link: TeamMemberOrcid = {
      userId: context.userId,
      orcidId: trimmedId,
      profile,
      linkedAt: new Date().toISOString(),
    };

    orcidLinkStore.set(key, link);

    logger.info('ORCID linked', {
      component: 'api/integrations/orcid',
      action: 'POST',
      userId: context.userId,
      orcidId: trimmedId,
    });

    return NextResponse.json({
      success: true,
      data: { linked: true, orcid: link },
    });
  } catch (error) {
    logger.error('Error linking ORCID', error as Error, {
      component: 'api/integrations/orcid',
      action: 'POST',
    });
    return NextResponse.json(
      { error: 'Failed to link ORCID' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/integrations/orcid
 *
 * Unlink the current user's ORCID.
 */
export const DELETE = withTeamAuth(async (_request: NextRequest, context: TeamAuthContext) => {
  try {
    const key = storeKey(context);
    orcidLinkStore.delete(key);

    logger.info('ORCID unlinked', {
      component: 'api/integrations/orcid',
      action: 'DELETE',
      userId: context.userId,
    });

    return NextResponse.json({
      success: true,
      data: { linked: false },
    });
  } catch (error) {
    logger.error('Error unlinking ORCID', error as Error, {
      component: 'api/integrations/orcid',
      action: 'DELETE',
    });
    return NextResponse.json(
      { error: 'Failed to unlink ORCID' },
      { status: 500 }
    );
  }
});
