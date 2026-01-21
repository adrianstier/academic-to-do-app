import { NextResponse } from 'next/server';

/**
 * Environment variable check endpoint
 * Returns which required environment variables are configured (without exposing values)
 * This helps diagnose deployment issues
 */
export async function GET() {
  const envStatus = {
    // Required for AI features
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,

    // Required for database
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY_LENGTH: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    SUPABASE_SERVICE_ROLE_KEY_PREFIX: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) || 'NOT_SET',

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
