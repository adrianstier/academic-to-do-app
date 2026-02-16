/**
 * Google Calendar OAuth Callback Handler
 *
 * GET /api/integrations/google-calendar/callback
 *
 * Handles the redirect from Google's consent screen:
 * 1. Validates the state parameter for CSRF protection
 * 2. Exchanges the authorization code for access + refresh tokens
 * 3. Fetches the user's email for display
 * 4. Returns tokens to the client (stored in localStorage for MVP)
 * 5. Redirects back to app settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  exchangeCodeForTokens,
  getUserInfo,
  isGoogleCalendarConfigured,
} from '@/lib/googleCalendar';

export async function GET(request: NextRequest) {
  try {
    // Check configuration
    if (!isGoogleCalendarConfigured()) {
      return NextResponse.redirect(
        new URL('/settings?error=google_calendar_not_configured', request.url)
      );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle user denying consent
    if (error) {
      logger.info('Google Calendar OAuth denied by user', {
        component: 'api/integrations/google-calendar/callback',
        action: 'GET',
        metadata: { error },
      });

      return NextResponse.redirect(
        new URL(`/?gcal_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      logger.warn('Google Calendar OAuth callback missing parameters', {
        component: 'api/integrations/google-calendar/callback',
        action: 'GET',
        metadata: { hasCode: !!code, hasState: !!state },
      });

      return NextResponse.redirect(
        new URL('/?gcal_error=missing_params', request.url)
      );
    }

    // Decode and validate state parameter
    let statePayload: { userId: string; teamId: string; nonce: string; timestamp: number };
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf-8');
      statePayload = JSON.parse(decoded);

      // Verify the state is not too old (10-minute window)
      const stateAge = Date.now() - statePayload.timestamp;
      if (stateAge > 10 * 60 * 1000) {
        throw new Error('State parameter expired');
      }

      if (!statePayload.userId || !statePayload.nonce) {
        throw new Error('Invalid state payload');
      }
    } catch (stateError) {
      logger.security('Google Calendar OAuth invalid state parameter', {
        component: 'api/integrations/google-calendar/callback',
        action: 'GET',
      });

      return NextResponse.redirect(
        new URL('/?gcal_error=invalid_state', request.url)
      );
    }

    // Exchange the authorization code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Fetch user info for display
    const userInfo = await getUserInfo(tokens.access_token);

    logger.info('Google Calendar OAuth completed successfully', {
      component: 'api/integrations/google-calendar/callback',
      action: 'GET',
      userId: statePayload.userId,
    });

    // For MVP: redirect back to the app with token data in a fragment (not query params
    // for security). The client-side code will read the fragment and store in localStorage.
    // In production, you would store tokens server-side in an encrypted table.
    const connectionData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
      email: userInfo.email,
      connected_at: new Date().toISOString(),
    };

    const encodedData = Buffer.from(JSON.stringify(connectionData)).toString('base64url');

    // Redirect to the main app with connection data in the URL fragment
    // Fragments are not sent to the server, providing a layer of security
    return NextResponse.redirect(
      new URL(`/?gcal_connected=true#gcal_data=${encodedData}`, request.url)
    );
  } catch (error) {
    logger.error('Error in Google Calendar OAuth callback', error as Error, {
      component: 'api/integrations/google-calendar/callback',
      action: 'GET',
    });

    return NextResponse.redirect(
      new URL('/?gcal_error=token_exchange_failed', request.url)
    );
  }
}
