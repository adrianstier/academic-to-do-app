/**
 * Server-side Session Validation
 *
 * Validates session tokens for API endpoints.
 * Used to protect AI endpoints and other authenticated routes.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Use anon key for validation (not service role)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SessionValidationResult {
  valid: boolean;
  userId?: string;
  userName?: string;
  userRole?: string;
  error?: string;
}

/**
 * Hash a session token for storage/comparison
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Validate a session from request headers
 *
 * Checks for session token in:
 * 1. X-Session-Token header
 * 2. Authorization: Bearer <token> header
 * 3. Cookie: session=<token>
 */
export async function validateSession(
  request: NextRequest
): Promise<SessionValidationResult> {
  try {
    // Try to get session token from various sources
    let sessionToken: string | null = null;

    // Check X-Session-Token header
    sessionToken = request.headers.get('X-Session-Token');

    // Check Authorization header
    if (!sessionToken) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        sessionToken = authHeader.substring(7);
      }
    }

    // Check cookie
    if (!sessionToken) {
      const sessionCookie = request.cookies.get('session');
      sessionToken = sessionCookie?.value || null;
    }

    // Also check for legacy userName header (for backward compatibility during migration)
    const legacyUserName = request.headers.get('X-User-Name');

    if (!sessionToken && !legacyUserName) {
      return {
        valid: false,
        error: 'No session token provided',
      };
    }

    // If we have a legacy userName, validate it exists (temporary backward compatibility)
    if (!sessionToken && legacyUserName) {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('name', legacyUserName)
        .single();

      if (error || !user) {
        return {
          valid: false,
          error: 'Invalid user',
        };
      }

      // Accept legacy auth during migration period
      return {
        valid: true,
        userId: user.id,
        userName: user.name,
        userRole: user.role || 'member',
      };
    }

    // Validate session token against database
    const tokenHash = hashSessionToken(sessionToken!);

    interface SessionRpcResult {
      user_id: string;
      user_name: string;
      user_role: string;
      valid: boolean;
    }

    const { data, error } = await supabase
      .rpc('validate_session_token', { p_token_hash: tokenHash })
      .single<SessionRpcResult>();

    if (error) {
      // RPC might not exist yet - fall back to direct query
      // First get the session
      const { data: session, error: sessionError } = await supabase
        .from('user_sessions')
        .select('user_id, expires_at, is_valid')
        .eq('token_hash', tokenHash)
        .single();

      if (sessionError || !session) {
        return {
          valid: false,
          error: 'Invalid session token',
        };
      }

      const isExpired = new Date(session.expires_at) < new Date();
      if (!session.is_valid || isExpired) {
        return {
          valid: false,
          error: 'Session expired',
        };
      }

      // Then get the user details
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('name, role')
        .eq('id', session.user_id)
        .single();

      if (userError || !user) {
        return {
          valid: false,
          error: 'User not found',
        };
      }

      return {
        valid: true,
        userId: session.user_id,
        userName: user.name,
        userRole: user.role || 'member',
      };
    }

    if (!data || !data.valid) {
      return {
        valid: false,
        error: 'Session expired or invalid',
      };
    }

    return {
      valid: true,
      userId: data.user_id,
      userName: data.user_name,
      userRole: data.user_role || 'member',
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return {
      valid: false,
      error: 'Session validation failed',
    };
  }
}

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; expiresAt: Date } | null> {
  try {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);

    // Session expires in 8 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8);

    const { error } = await supabase.from('user_sessions').insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
      is_valid: true,
    });

    if (error) {
      console.error('Failed to create session:', error);
      return null;
    }

    return { token, expiresAt };
  } catch (error) {
    console.error('Session creation error:', error);
    return null;
  }
}

/**
 * Invalidate a session (logout)
 */
export async function invalidateSession(tokenHash: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({ is_valid: false })
      .eq('token_hash', tokenHash);

    return !error;
  } catch (error) {
    console.error('Session invalidation error:', error);
    return false;
  }
}

/**
 * Invalidate all sessions for a user (logout everywhere)
 */
export async function invalidateAllUserSessions(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({ is_valid: false })
      .eq('user_id', userId);

    return !error;
  } catch (error) {
    console.error('Session invalidation error:', error);
    return false;
  }
}

/**
 * Update session last activity timestamp
 */
export async function touchSession(tokenHash: string): Promise<void> {
  try {
    await supabase
      .from('user_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('token_hash', tokenHash);
  } catch (error) {
    // Non-critical, don't throw
    console.error('Failed to update session activity:', error);
  }
}
