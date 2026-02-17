/**
 * SSO Callback API Route
 *
 * POST /api/auth/sso/callback
 *
 * Receives the SAML Response from the Identity Provider after
 * the user authenticates. Parses the response, extracts user
 * attributes, creates or updates the user account, establishes
 * a session, and redirects to the app.
 *
 * PRODUCTION NOTE: SAML signature validation is NOT performed
 * in this implementation. For production use, integrate a proper
 * SAML library (e.g., `@node-saml/node-saml`) to verify the
 * response signature against the IdP's X.509 certificate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { parseSAMLResponse } from '@/lib/samlHelpers';
import { ssoProviderStore } from '../route';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * POST /api/auth/sso/callback
 *
 * Receives SAML Response via HTTP-POST binding.
 * Form fields:
 *   - SAMLResponse: base64-encoded SAML Response XML
 *   - RelayState: original callback URL (optional)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the form-encoded SAML Response
    const formData = await request.formData();
    const samlResponse = formData.get('SAMLResponse') as string | null;
    const relayState = formData.get('RelayState') as string | null;

    if (!samlResponse) {
      logger.warn('SSO callback missing SAMLResponse', {
        action: 'sso_callback_missing_response',
      });
      return NextResponse.json(
        { error: 'Missing SAMLResponse in callback' },
        { status: 400 }
      );
    }

    // Find the SSO provider — try each configured provider
    // In production, the InResponseTo field would identify the original request
    let parsedUser = null;
    let matchedProviderId: string | null = null;

    for (const [providerId, provider] of ssoProviderStore.entries()) {
      if (!provider.enabled) continue;

      const result = parseSAMLResponse(samlResponse, provider);
      if (result && result.email) {
        parsedUser = result;
        matchedProviderId = providerId;
        break;
      }
    }

    if (!parsedUser || !matchedProviderId) {
      logger.warn('SSO callback: could not parse SAML response', {
        action: 'sso_callback_parse_failed',
      });
      return redirectWithError(
        request,
        'Failed to authenticate with your institution. Please try again.'
      );
    }

    logger.info('SSO callback: user authenticated', {
      email: parsedUser.email,
      providerId: matchedProviderId,
      action: 'sso_user_authenticated',
    });

    // Look up or create user in the database
    const user = await findOrCreateUser(parsedUser, matchedProviderId);

    if (!user) {
      return redirectWithError(
        request,
        'Failed to create or find your account. Please contact support.'
      );
    }

    // Build the redirect URL with session info
    // Use URL fragment (hash) instead of query params to avoid leaking
    // user credentials in server logs, referrer headers, and browser history.
    // Fragments are NOT sent to the server, providing a layer of security.
    const origin = new URL(request.url).origin;
    const ssoData = Buffer.from(JSON.stringify({
      sso_user_id: user.id,
      sso_user_name: user.name,
      sso_provider: matchedProviderId,
    })).toString('base64url');
    const redirectUrl = new URL(`/?sso_login=true#sso_data=${ssoData}`, origin);

    logger.info('SSO login complete', {
      userId: user.id,
      email: parsedUser.email,
      providerId: matchedProviderId,
      action: 'sso_login_complete',
    });

    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    logger.error('SSO callback error', {
      error: err instanceof Error ? err.message : 'Unknown error',
      action: 'sso_callback_error',
    });

    return redirectWithError(
      request,
      'An unexpected error occurred during SSO login.'
    );
  }
}

// ============================================
// Internal Helpers
// ============================================

/**
 * Find an existing user by email or create a new one
 * from the SAML assertion attributes.
 */
async function findOrCreateUser(
  parsedUser: {
    email: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    department?: string;
    orcid?: string;
  },
  providerId: string
): Promise<{ id: string; name: string } | null> {
  try {
    // Try to find existing user by email
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, name')
      .eq('email', parsedUser.email)
      .single();

    if (existingUser) {
      // Update the user's name if it changed at the IdP
      const displayName =
        parsedUser.displayName ||
        `${parsedUser.firstName} ${parsedUser.lastName}`.trim();

      if (displayName && displayName !== existingUser.name) {
        await supabase
          .from('users')
          .update({ name: displayName })
          .eq('id', existingUser.id);
      }

      return existingUser;
    }

    // Auto-provision: create a new user from SSO attributes
    const provider = ssoProviderStore.get(providerId);
    if (!provider) {
      return null;
    }

    const userName =
      parsedUser.displayName ||
      `${parsedUser.firstName} ${parsedUser.lastName}`.trim() ||
      parsedUser.email.split('@')[0];

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        name: userName,
        email: parsedUser.email,
        color: '#1e3a5f', // Default academic blue
        global_role: 'user',
        // No pin_hash — SSO users don't use PIN auth
      })
      .select('id, name')
      .single();

    if (createError) {
      logger.error('Failed to create SSO user', {
        email: parsedUser.email,
        error: createError.message,
        action: 'sso_user_create_failed',
      });
      return null;
    }

    logger.info('SSO user auto-provisioned', {
      userId: newUser.id,
      email: parsedUser.email,
      providerId,
      action: 'sso_user_provisioned',
    });

    return newUser;
  } catch (err) {
    logger.error('Error in findOrCreateUser', {
      error: err instanceof Error ? err.message : 'Unknown error',
      action: 'sso_find_create_user_error',
    });
    return null;
  }
}

/**
 * Redirect back to the app with an error message.
 */
function redirectWithError(request: NextRequest, message: string): NextResponse {
  const origin = new URL(request.url).origin;
  const errorUrl = new URL('/', origin);
  errorUrl.searchParams.set('sso_error', message);
  return NextResponse.redirect(errorUrl.toString());
}
