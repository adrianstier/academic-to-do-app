import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client lazily to avoid build-time initialization
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Helper to extract user name from request
function extractUserName(request: NextRequest): string | null {
  return request.headers.get('X-User-Name');
}

// Validate user name is present
function validateUserName(userName: string | null): NextResponse | null {
  if (!userName) {
    return NextResponse.json(
      { success: false, error: 'X-User-Name header required' },
      { status: 401 }
    );
  }
  return null;
}

/**
 * POST /api/push-subscribe
 * Store a web push subscription for a user
 */
export async function POST(request: NextRequest) {
  const userName = extractUserName(request);
  const authError = validateUserName(userName);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { subscription, userId } = body;

    if (!subscription || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing subscription or userId' },
        { status: 400 }
      );
    }

    // Validate subscription has required fields
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription format' },
        { status: 400 }
      );
    }

    // Store the full subscription as JSON string in the token field
    const subscriptionToken = JSON.stringify(subscription);

    // Upsert the device token (update if endpoint already exists for this user)
    const { error } = await getSupabase()
      .from('device_tokens')
      .upsert(
        {
          user_id: userId,
          token: subscriptionToken,
          platform: 'web',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,platform',
          ignoreDuplicates: false,
        }
      );

    if (error) {
      console.error('Error storing push subscription:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to store subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/push-subscribe:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/push-subscribe
 * Remove a web push subscription for a user
 */
export async function DELETE(request: NextRequest) {
  const userName = extractUserName(request);
  const authError = validateUserName(userName);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { subscription, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }

    // If subscription provided, delete that specific one
    // Otherwise, delete all web subscriptions for user
    if (subscription) {
      const subscriptionToken = JSON.stringify(subscription);

      const { error } = await getSupabase()
        .from('device_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', subscriptionToken)
        .eq('platform', 'web');

      if (error) {
        console.error('Error removing push subscription:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to remove subscription' },
          { status: 500 }
        );
      }
    } else {
      // Remove all web subscriptions for user
      const { error } = await getSupabase()
        .from('device_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('platform', 'web');

      if (error) {
        console.error('Error removing push subscriptions:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to remove subscriptions' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/push-subscribe:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/push-subscribe
 * Check if user has an active web push subscription
 */
export async function GET(request: NextRequest) {
  const userName = extractUserName(request);
  const authError = validateUserName(userName);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Missing userId parameter' },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await getSupabase()
      .from('device_tokens')
      .select('id, platform, updated_at')
      .eq('user_id', userId)
      .eq('platform', 'web')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error('Error checking subscription:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to check subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscribed: !!data,
      lastUpdated: data?.updated_at || null,
    });
  } catch (error) {
    console.error('Error in GET /api/push-subscribe:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
