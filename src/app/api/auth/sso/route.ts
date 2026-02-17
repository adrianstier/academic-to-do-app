/**
 * SSO Initiation API Route
 *
 * GET /api/auth/sso?provider=<providerId>
 *
 * Initiates the SAML SSO flow by building a SAML AuthnRequest
 * and redirecting the user to the Identity Provider's SSO endpoint.
 *
 * PRODUCTION NOTE: SAML signature validation requires a proper SAML
 * library (e.g., `@node-saml/node-saml`). This implementation provides
 * the structural flow without cryptographic verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { generateSAMLRequest } from '@/lib/samlHelpers';
import type { SSOProvider } from '@/types/sso';

/**
 * In-memory SSO provider store.
 *
 * Production note: Replace with Supabase table (e.g., `sso_providers`)
 * to persist across deployments. Using in-memory storage here to avoid
 * requiring a migration as part of the initial SSO feature.
 */
const ssoProviderStore = new Map<string, SSOProvider>();

/** Export for use by the callback route and settings API */
export { ssoProviderStore };

/**
 * GET /api/auth/sso
 *
 * Initiates SSO login by redirecting to the IdP.
 * Query params:
 *   - provider: SSO provider ID (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('provider');

    if (!providerId) {
      return NextResponse.json(
        { error: 'Missing required parameter: provider' },
        { status: 400 }
      );
    }

    // Look up the configured SSO provider
    const provider = ssoProviderStore.get(providerId);

    if (!provider) {
      logger.warn('SSO provider not found', {
        providerId,
        action: 'sso_provider_not_found',
      });
      return NextResponse.json(
        { error: 'SSO provider not found or not configured' },
        { status: 404 }
      );
    }

    if (!provider.enabled) {
      return NextResponse.json(
        { error: 'SSO provider is disabled' },
        { status: 403 }
      );
    }

    // Build the callback URL for this app
    const origin = new URL(request.url).origin;
    const callbackUrl = `${origin}/api/auth/sso/callback`;

    // Generate SAML AuthnRequest and redirect URL
    const { redirectUrl, requestId } = generateSAMLRequest(provider, callbackUrl);

    logger.info('SSO login initiated', {
      providerId,
      providerName: provider.name,
      requestId,
      action: 'sso_login_initiated',
    });

    // Redirect the user to the IdP
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    logger.error('SSO initiation failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
      action: 'sso_initiation_error',
    });

    return NextResponse.json(
      { error: 'Failed to initiate SSO login' },
      { status: 500 }
    );
  }
}
