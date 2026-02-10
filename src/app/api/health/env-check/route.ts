import { NextRequest, NextResponse } from 'next/server';

/**
 * Environment variable check endpoint
 * Returns which required environment variables are configured (without exposing values)
 * This helps diagnose deployment issues.
 * Protected by API key to prevent information disclosure.
 */
const API_KEY = process.env.OUTLOOK_ADDON_API_KEY;

export async function GET(request: NextRequest) {
  // Require API key authentication to prevent information disclosure
  const apiKey = request.headers.get('X-API-Key');
  if (!API_KEY || apiKey !== API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  const envStatus = {
    // Required for AI features
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,

    // Required for database
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,

    // Optional
    OUTLOOK_ADDON_API_KEY: !!process.env.OUTLOOK_ADDON_API_KEY,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    NEXT_PUBLIC_SENTRY_DSN: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Node environment
    NODE_ENV: process.env.NODE_ENV || 'unknown',

  };

  // Check if critical vars for daily digest are present
  const dailyDigestReady =
    envStatus.ANTHROPIC_API_KEY &&
    envStatus.NEXT_PUBLIC_SUPABASE_URL &&
    envStatus.SUPABASE_SERVICE_ROLE_KEY;

  return NextResponse.json({
    status: dailyDigestReady ? 'ok' : 'missing_config',
    dailyDigestReady,
    environment: envStatus,
    missingCritical: [
      !envStatus.ANTHROPIC_API_KEY && 'ANTHROPIC_API_KEY',
      !envStatus.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
      !envStatus.NEXT_PUBLIC_SUPABASE_URL && 'NEXT_PUBLIC_SUPABASE_URL',
    ].filter(Boolean),
  });
}
