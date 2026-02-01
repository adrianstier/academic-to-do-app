/**
 * Latest Digest API
 *
 * Fetches the most recent stored digest for a user.
 * Marks the digest as read when fetched.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';

/**
 * Get today's date in Pacific Time (YYYY-MM-DD format).
 */
function getTodayInPacific(): string {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/**
 * Calculate the next scheduled digest time in Pacific Time.
 * Digests are generated at 5 AM and 4 PM Pacific daily.
 */
function getNextScheduledTime(): Date {
  // Get current time in Pacific Time
  const now = new Date();
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hour = pacificTime.getHours();

  // Calculate next scheduled time in Pacific
  let nextPacific: Date;
  if (hour < 5) {
    // Before 5am PT - next is 5am today
    nextPacific = new Date(pacificTime);
    nextPacific.setHours(5, 0, 0, 0);
  } else if (hour < 16) {
    // Between 5am and 4pm PT - next is 4pm today
    nextPacific = new Date(pacificTime);
    nextPacific.setHours(16, 0, 0, 0);
  } else {
    // After 4pm PT - next is 5am tomorrow
    nextPacific = new Date(pacificTime);
    nextPacific.setDate(nextPacific.getDate() + 1);
    nextPacific.setHours(5, 0, 0, 0);
  }

  // Convert back to UTC for consistent API response
  // Calculate the offset between Pacific and UTC
  const pacificOffset = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'short' });
  const isPDT = pacificOffset.includes('PDT');
  const offsetHours = isPDT ? 7 : 8; // PDT is UTC-7, PST is UTC-8

  // Create UTC date from Pacific time
  const utcDate = new Date(nextPacific);
  utcDate.setHours(utcDate.getHours() + offsetHours);

  return utcDate;
}

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
 * Authentication handled by withTeamAuth wrapper.
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
export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const userName = context.userName;

    const { searchParams } = new URL(request.url);
    const markRead = searchParams.get('markRead') !== 'false';

    const supabase = getSupabaseClient();

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('name', userName)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 403 }
      );
    }

    // Get the most recent digest for this user from today (Pacific Time)
    const todayPT = getTodayInPacific();

    const { data: digest, error: digestError } = await supabase
      .from('daily_digests')
      .select('*')
      .eq('user_id', user.id)
      .eq('digest_date', todayPT)
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
      return NextResponse.json({
        success: true,
        hasDigest: false,
        message: 'No recent digest available',
        nextScheduled: getNextScheduledTime().toISOString(),
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

    return NextResponse.json({
      success: true,
      hasDigest: true,
      digest: digest.digest_data,
      digestType: digest.digest_type,
      generatedAt: digest.generated_at,
      isNew,
      nextScheduled: getNextScheduledTime().toISOString(),
    });

  } catch (error) {
    logger.error('Error in digest latest', error, { component: 'DigestLatest' });

    return NextResponse.json(
      { success: false, error: 'Failed to fetch digest' },
      { status: 500 }
    );
  }
});
