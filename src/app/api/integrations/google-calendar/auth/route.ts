/**
 * Google Calendar OAuth 2.0 Initiation Endpoint
 *
 * GET /api/integrations/google-calendar/auth
 *
 * Generates a Google OAuth authorization URL with the calendar scope,
 * stores a state parameter for CSRF protection, and redirects the user
 * to the Google consent screen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';
import { buildAuthUrl, isGoogleCalendarConfigured } from '@/lib/googleCalendar';
import crypto from 'crypto';

export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    // Check if Google Calendar is configured
    if (!isGoogleCalendarConfigured()) {
      return NextResponse.json(
        {
          error: 'Google Calendar integration is not configured',
          message:
            'Google Calendar sync requires API credentials. ' +
            'Ask your admin to configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.',
        },
        { status: 503 }
      );
    }

    // Generate a random state parameter for CSRF protection
    // Encode the user ID and a random nonce in the state
    const nonce = crypto.randomBytes(16).toString('hex');
    const statePayload = {
      userId: context.userId,
      teamId: context.teamId,
      nonce,
      timestamp: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

    // Build the authorization URL
    const authUrl = buildAuthUrl(state);

    logger.info('Google Calendar OAuth initiated', {
      component: 'api/integrations/google-calendar/auth',
      action: 'GET',
      userId: context.userId,
    });

    // Return the auth URL for the client to redirect to
    return NextResponse.json({
      success: true,
      authUrl,
      state,
    });
  } catch (error) {
    logger.error('Error initiating Google Calendar OAuth', error as Error, {
      component: 'api/integrations/google-calendar/auth',
      action: 'GET',
    });
    return NextResponse.json(
      { error: 'Failed to initiate Google Calendar authentication' },
      { status: 500 }
    );
  }
});
