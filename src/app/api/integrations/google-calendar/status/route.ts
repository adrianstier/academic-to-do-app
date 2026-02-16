/**
 * Google Calendar Connection Status Endpoint
 *
 * GET /api/integrations/google-calendar/status
 *
 * Returns the current connection status with Google Calendar.
 * Uses the access token from the client to verify connectivity
 * and list available calendars.
 *
 * Query params:
 *   accessToken - The stored Google access token
 *   refreshToken - The stored Google refresh token
 *
 * Response:
 * {
 *   connected: boolean,
 *   email: string | null,
 *   lastSync: string | null,
 *   calendars: Calendar[]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';
import {
  getValidAccessToken,
  getUserInfo,
  listCalendars,
  isGoogleCalendarConfigured,
  type GoogleTokens,
  type CalendarConnectionStatus,
} from '@/lib/googleCalendar';

export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    // Check if Google Calendar is configured at all
    if (!isGoogleCalendarConfigured()) {
      return NextResponse.json({
        connected: false,
        configured: false,
        email: null,
        lastSync: null,
        calendars: [],
        message:
          'Google Calendar sync requires API credentials. ' +
          'Ask your admin to configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      });
    }

    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    // If no tokens provided, user is not connected
    if (!accessToken || !refreshToken) {
      return NextResponse.json({
        connected: false,
        configured: true,
        email: null,
        lastSync: null,
        calendars: [],
      });
    }

    // Try to validate the token
    const tokens: GoogleTokens = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: 0, // Force refresh check
      token_type: 'Bearer',
      scope: '',
    };

    let validTokens: GoogleTokens;
    try {
      validTokens = await getValidAccessToken(tokens);
    } catch {
      // Token is invalid or expired and can't be refreshed
      return NextResponse.json({
        connected: false,
        configured: true,
        email: null,
        lastSync: null,
        calendars: [],
        tokenExpired: true,
      });
    }

    // Fetch user info and calendars
    const [userInfo, calendars] = await Promise.all([
      getUserInfo(validTokens.access_token),
      listCalendars(validTokens.access_token),
    ]);

    const status: CalendarConnectionStatus & {
      configured: boolean;
      updatedTokens?: { access_token: string; expires_at: number };
    } = {
      connected: true,
      configured: true,
      email: userInfo.email,
      lastSync: null, // Client manages this in localStorage
      calendars,
    };

    // Return refreshed tokens if they changed
    if (validTokens.access_token !== accessToken) {
      status.updatedTokens = {
        access_token: validTokens.access_token,
        expires_at: validTokens.expires_at,
      };
    }

    return NextResponse.json(status);
  } catch (error) {
    logger.error('Error checking Google Calendar status', error as Error, {
      component: 'api/integrations/google-calendar/status',
      action: 'GET',
    });

    return NextResponse.json(
      {
        connected: false,
        configured: true,
        email: null,
        lastSync: null,
        calendars: [],
        error: 'Failed to check connection status',
      },
      { status: 500 }
    );
  }
});
