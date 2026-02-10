/**
 * Enhanced Supabase Client with RLS Support
 *
 * Creates Supabase clients with proper user context for Row-Level Security
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isFeatureEnabled } from './featureFlags';
import { logger } from './logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

/**
 * Create a Supabase client with RLS context
 *
 * @param userId - User ID to set in RLS context
 * @param enableRLS - Whether to enable RLS (uses feature flag if not specified)
 */
export function createSupabaseClient(
  userId?: string,
  enableRLS?: boolean
): SupabaseClient {
  if (!isSupabaseConfigured()) {
    // Return dummy client for build time
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);

  // Check if RLS should be enabled
  const shouldEnableRLS = enableRLS ?? isFeatureEnabled('normalized_schema');

  if (shouldEnableRLS && userId) {
    // Set user context for RLS (fire-and-forget for sync callers)
    // For proper isolation, use createSupabaseClientWithRLS() instead
    client.rpc('set_config', {
      name: 'app.user_id',
      value: userId,
    }).then(({ error }) => {
      if (error) {
        logger.warn('Failed to set user context for RLS', {
          userId,
          error: error.message,
        });
      }
    });

    client.rpc('set_config', {
      name: 'app.enable_rls',
      value: 'true',
    }).then(({ error }) => {
      if (error) {
        logger.warn('Failed to enable RLS flag', {
          error: error.message,
        });
      }
    });
  }

  return client;
}

/**
 * Default Supabase client (backward compatible)
 */
export const supabase = createSupabaseClient();

/**
 * Create a Supabase client with RLS context (async - awaits RLS setup)
 * Use this instead of createSupabaseClient when userId is provided
 * to ensure RLS context is set before any queries execute.
 */
export async function createSupabaseClientWithRLS(
  userId: string,
  enableRLS?: boolean
): Promise<SupabaseClient> {
  if (!isSupabaseConfigured()) {
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const shouldEnableRLS = enableRLS ?? isFeatureEnabled('normalized_schema');

  if (shouldEnableRLS) {
    const { error: userError } = await client.rpc('set_config', {
      name: 'app.user_id',
      value: userId,
    });
    if (userError) {
      logger.warn('Failed to set user context for RLS', { userId, error: userError.message });
    }

    const { error: rlsError } = await client.rpc('set_config', {
      name: 'app.enable_rls',
      value: 'true',
    });
    if (rlsError) {
      logger.warn('Failed to enable RLS flag', { error: rlsError.message });
    }
  }

  return client;
}

/**
 * Create a server-side Supabase client with service role
 * USE CAREFULLY - bypasses RLS!
 */
export function createServiceRoleClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
