/**
 * Web Push Send API
 *
 * Sends push notifications to web clients using the Web Push protocol.
 * Uses the web-push npm package for proper VAPID authentication and payload encryption.
 */

import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

// Initialize web-push if keys are available
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Create Supabase client with service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface WebPushPayload {
  title: string;
  body: string;
  taskId?: string;
  type?: string;
  url?: string;
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface RequestBody {
  type: 'task_assigned' | 'task_due_soon' | 'task_overdue' | 'task_completed' | 'generic';
  payload: {
    taskId?: string;
    taskText?: string;
    assignedBy?: string;
    completedBy?: string;
    timeUntil?: string;
    message?: string;
  };
  userIds?: string[];
}

// Build notification payload based on type
function buildNotificationPayload(
  type: string,
  payload: RequestBody['payload']
): WebPushPayload {
  let title = '';
  let body = '';

  switch (type) {
    case 'task_assigned':
      title = 'New Task Assigned';
      body = `${payload.assignedBy} assigned you: ${payload.taskText}`;
      break;

    case 'task_due_soon':
      title = 'Task Due Soon';
      body = `"${payload.taskText}" is due ${payload.timeUntil}`;
      break;

    case 'task_overdue':
      title = 'Overdue Task';
      body = `"${payload.taskText}" is overdue`;
      break;

    case 'task_completed':
      title = 'Task Completed';
      body = `${payload.completedBy} completed: ${payload.taskText}`;
      break;

    case 'generic':
    default:
      title = 'Notification';
      body = payload.message || 'You have a new notification';
  }

  return {
    title,
    body,
    taskId: payload.taskId,
    type,
    url: payload.taskId ? `/?task=${payload.taskId}` : '/',
  };
}

// Send notification to a single subscription
async function sendToSubscription(
  subscriptionJson: string,
  payload: WebPushPayload
): Promise<{ success: boolean; token: string; error?: string }> {
  try {
    const subscription: PushSubscription = JSON.parse(subscriptionJson);

    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 86400, // 24 hours
      urgency: 'normal',
    });

    return { success: true, token: subscriptionJson };
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    console.error('Web push error:', err);

    // Handle specific errors
    if (err.statusCode === 404 || err.statusCode === 410) {
      // Subscription is no longer valid
      return { success: false, token: subscriptionJson, error: 'UNREGISTERED' };
    }

    return { success: false, token: subscriptionJson, error: err.message || 'Unknown error' };
  }
}

/**
 * POST /api/push-send
 *
 * Send web push notifications to specified users.
 */
export async function POST(request: NextRequest) {
  // Validate VAPID configuration
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { success: false, error: 'VAPID keys not configured' },
      { status: 500 }
    );
  }

  try {
    const body: RequestBody = await request.json();
    const { type, payload, userIds } = body;

    // Validate request
    if (!type || !payload) {
      return NextResponse.json(
        { success: false, error: 'Missing type or payload' },
        { status: 400 }
      );
    }

    if (!userIds || userIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users to notify',
        sent: 0,
      });
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get web push subscriptions for users
    const { data: tokens, error: fetchError } = await supabase
      .from('device_tokens')
      .select('token, user_id')
      .in('user_id', userIds)
      .eq('platform', 'web');

    if (fetchError) {
      console.error('Error fetching device tokens:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch subscriptions' },
        { status: 500 }
      );
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No web push subscriptions found',
        sent: 0,
      });
    }

    // Build notification payload
    const notificationPayload = buildNotificationPayload(type, payload);

    // Send to all subscriptions
    const results = await Promise.all(
      tokens.map((t) => sendToSubscription(t.token, notificationPayload))
    );

    // Track results
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const unregistered = failed
      .filter((r) => r.error === 'UNREGISTERED')
      .map((r) => r.token);

    // Remove invalid subscriptions
    if (unregistered.length > 0) {
      const { error: deleteError } = await supabase
        .from('device_tokens')
        .delete()
        .in('token', unregistered);

      if (deleteError) {
        console.error('Error removing invalid tokens:', deleteError);
      }
    }

    return NextResponse.json({
      success: true,
      sent: successful.length,
      failed: failed.length,
      unregistered: unregistered.length,
    });
  } catch (error) {
    console.error('Error in push-send:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
