/**
 * SP Metadata API Route
 *
 * GET /api/auth/sso/metadata
 *
 * Returns the Service Provider SAML metadata XML document.
 * University IT departments need this URL to configure the
 * trust relationship with their Identity Provider (IdP).
 *
 * Share this URL with the IdP administrator:
 *   https://your-app.vercel.app/api/auth/sso/metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildServiceProviderMetadata } from '@/lib/samlHelpers';
import { logger } from '@/lib/logger';

/**
 * GET /api/auth/sso/metadata
 *
 * Returns SP metadata as XML with the correct content type.
 */
export async function GET(request: NextRequest) {
  try {
    const origin = new URL(request.url).origin;
    const metadataXml = buildServiceProviderMetadata(origin);

    logger.info('SP metadata requested', {
      origin,
      action: 'sp_metadata_served',
    });

    return new NextResponse(metadataXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (err) {
    logger.error('Failed to generate SP metadata', {
      error: err instanceof Error ? err.message : 'Unknown error',
      action: 'sp_metadata_error',
    });

    return NextResponse.json(
      { error: 'Failed to generate SP metadata' },
      { status: 500 }
    );
  }
}
