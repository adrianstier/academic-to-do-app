/**
 * Latest Digest API
 *
 * Fetches the most recent stored digest for a user.
 * Marks the digest as read when fetched.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * GET /api/digest/latest
 *
 * Fetch the latest digest for a user.
 * Requires X-User-Name header for authentication.
 *
 * Query params:
 * - markRead: 'true' to mark the digest as read (default: true)
 *
 * Returns:
 * - digest: The full DailyDigestResponse object
 * - digestType: 'morning' or 'afternoon'
 * - generatedAt: When the digest was generated
 * - isNew: Whether this is the first time the user is viewing it
 * - nextScheduled: When the next digest will be generated
 */
export async function GET(request: NextRequest) {
  try {
    // Get user name from header
    const userName = request.headers.get('X-User-Name');

    if (!userName) {
      return NextResponse.json(
        { success: false, error: 'X-User-Name header is required' },
        { status: 400 }
      );
    }

    // Sanitize user name
    const sanitizedUserName = userName.trim();
    if (sanitizedUserName.length === 0 || sanitizedUserName.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Invalid user name' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const markRead = searchParams.get('markRead') !== 'false';

    const supabase = getSupabaseClient();

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('name', sanitizedUserName)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 403 }
      );
    }

    // Get the most recent digest for this user (within last 12 hours)
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    const { data: digest, error: digestError } = await supabase
      .from('daily_digests')
      .select('*')
      .eq('user_id', user.id)
      .gte('generated_at', twelveHoursAgo)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (digestError && digestError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" - that's expected if no digest exists
      logger.error('Error fetching digest', digestError, { component: 'DigestLatest' });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch digest' },
        { status: 500 }
      );
    }

    // No digest found
    if (!digest) {
      // Calculate next scheduled time
      const now = new Date();
      const hour = now.getHours();

      let nextScheduled: Date;
      if (hour < 5) {
        // Before 5am - next is 5am today
        nextScheduled = new Date(now);
        nextScheduled.setHours(5, 0, 0, 0);
      } else if (hour < 16) {
        // Between 5am and 4pm - next is 4pm today
        nextScheduled = new Date(now);
        nextScheduled.setHours(16, 0, 0, 0);
      } else {
        // After 4pm - next is 5am tomorrow
        nextScheduled = new Date(now);
        nextScheduled.setDate(nextScheduled.getDate() + 1);
        nextScheduled.setHours(5, 0, 0, 0);
      }

      return NextResponse.json({
        success: true,
        hasDigest: false,
        message: 'No recent digest available',
        nextScheduled: nextScheduled.toISOString(),
      });
    }

    // Check if this is a new (unread) digest
    const isNew = !digest.read_at;

    // Mark as read if requested and not already read
    if (markRead && isNew) {
      const { error: updateError } = await supabase
        .from('daily_digests')
        .update({ read_at: new Date().toISOString() })
        .eq('id', digest.id);

      if (updateError) {
        logger.error('Error marking digest as read', updateError, { component: 'DigestLatest' });
        // Don't fail the request, just log the error
      }
    }

    // Calculate next scheduled time
    const now = new Date();
    const hour = now.getHours();

    let nextScheduled: Date;
    if (hour < 5) {
      nextScheduled = new Date(now);
      nextScheduled.setHours(5, 0, 0, 0);
    } else if (hour < 16) {
      nextScheduled = new Date(now);
      nextScheduled.setHours(16, 0, 0, 0);
    } else {
      nextScheduled = new Date(now);
      nextScheduled.setDate(nextScheduled.getDate() + 1);
      nextScheduled.setHours(5, 0, 0, 0);
    }

    return NextResponse.json({
      success: true,
      hasDigest: true,
      digest: digest.digest_data,
      digestType: digest.digest_type,
      generatedAt: digest.generated_at,
      isNew,
      nextScheduled: nextScheduled.toISOString(),
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in digest latest', error, { component: 'DigestLatest' });

    return NextResponse.json(
      { success: false, error: 'Failed to fetch digest' },
      { status: 500 }
    );
  }
}
