/**
 * Web Push Server Utilities
 *
 * Server-side functions for sending web push notifications.
 * Uses the web-push npm package for proper VAPID authentication and payload encryption.
 */

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

// Initialize web-push if keys are available
let webPushInitialized = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    webPushInitialized = true;
  } catch (error) {
    console.error('Failed to initialize web-push:', error);
  }
}

// Create Supabase client with service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

interface NotificationRequest {
  type: 'task_assigned' | 'task_due_soon' | 'task_overdue' | 'task_completed' | 'generic';
  payload: {
    taskId?: string;
    taskText?: string;
    assignedBy?: string;
    completedBy?: string;
    timeUntil?: string;
    message?: string;
  };
  userIds: string[];
}

// Build notification payload based on type
function buildNotificationPayload(
  type: string,
  payload: NotificationRequest['payload']
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
 * Send web push notifications to specified users
 */
export async function sendWebPushNotifications(
  request: NotificationRequest
): Promise<{ success: boolean; sent?: number; failed?: number; error?: string }> {
  // Check if web push is configured
  if (!webPushInitialized) {
    return { success: false, error: 'Web push not configured (missing VAPID keys)' };
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return { success: false, error: 'Supabase not configured' };
  }

  const { type, payload, userIds } = request;

  if (!userIds || userIds.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  try {
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
      return { success: false, error: 'Failed to fetch subscriptions' };
    }

    if (!tokens || tokens.length === 0) {
      return { success: true, sent: 0, failed: 0 };
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

    return {
      success: true,
      sent: successful.length,
      failed: failed.length,
    };
  } catch (error) {
    console.error('Error in sendWebPushNotifications:', error);
    return { success: false, error: 'Internal error' };
  }
}
