// Supabase Edge Function for sending push notifications to iOS and Web devices
// Deploy with: supabase functions deploy send-push-notification

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";

// Configuration from environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// iOS APNs configuration
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID") || "";
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID") || "";
const APNS_PRIVATE_KEY = Deno.env.get("APNS_PRIVATE_KEY") || "";
const BUNDLE_ID = Deno.env.get("BUNDLE_ID") || "com.yourcompany.sharedtodolist";
const APNS_HOST =
  Deno.env.get("APNS_ENVIRONMENT") === "production"
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";

// Web Push VAPID configuration
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

// Notification types
type NotificationType =
  | "task_assigned"
  | "task_due_soon"
  | "task_overdue"
  | "task_completed"
  | "generic";

interface NotificationPayload {
  type: NotificationType;
  taskId?: string;
  taskText?: string;
  assignedBy?: string;
  completedBy?: string;
  timeUntil?: string;
  message?: string;
  badgeCount?: number;
}

interface RequestBody {
  type: NotificationType;
  payload: NotificationPayload;
  userIds?: string[]; // Send to specific users
  deviceTokens?: string[]; // Send to specific devices (iOS only)
  excludeUserId?: string; // Don't notify this user (e.g., the one who triggered the action)
}

interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface DeviceToken {
  token: string;
  platform: "ios" | "web";
  user_id: string;
}

// Generate APNs JWT token (iOS)
async function generateAPNsToken(): Promise<string> {
  if (!APNS_PRIVATE_KEY || !APNS_KEY_ID || !APNS_TEAM_ID) {
    throw new Error("APNs credentials not configured");
  }
  const privateKey = await importPKCS8(APNS_PRIVATE_KEY, "ES256");

  const jwt = await new SignJWT({})
    .setProtectedHeader({
      alg: "ES256",
      kid: APNS_KEY_ID,
    })
    .setIssuer(APNS_TEAM_ID)
    .setIssuedAt()
    .sign(privateKey);

  return jwt;
}

// Build notification content based on type for iOS
function buildAPNsNotification(
  type: NotificationType,
  payload: NotificationPayload
): object {
  const baseAps = {
    sound: "default",
    badge: payload.badgeCount ?? 1,
  };

  switch (type) {
    case "task_assigned":
      return {
        aps: {
          ...baseAps,
          alert: {
            title: "New Task Assigned",
            body: `${payload.assignedBy} assigned you: ${payload.taskText}`,
          },
          category: "TASK_ASSIGNED",
        },
        taskId: payload.taskId,
        type: "assigned",
      };

    case "task_due_soon":
      return {
        aps: {
          ...baseAps,
          alert: {
            title: "Task Due Soon",
            body: `"${payload.taskText}" is due ${payload.timeUntil}`,
          },
          category: "TASK_REMINDER",
        },
        taskId: payload.taskId,
        type: "due_reminder",
      };

    case "task_overdue":
      return {
        aps: {
          ...baseAps,
          alert: {
            title: "Overdue Task",
            body: `"${payload.taskText}" is overdue`,
          },
          category: "TASK_OVERDUE",
          "interruption-level": "time-sensitive",
        },
        taskId: payload.taskId,
        type: "overdue",
      };

    case "task_completed":
      return {
        aps: {
          ...baseAps,
          alert: {
            title: "Task Completed",
            body: `${payload.completedBy} completed: ${payload.taskText}`,
          },
        },
        taskId: payload.taskId,
        type: "completed",
      };

    case "generic":
    default:
      return {
        aps: {
          ...baseAps,
          alert: payload.message || "You have a new notification",
        },
      };
  }
}

// Build notification content for Web Push
function buildWebPushNotification(
  type: NotificationType,
  payload: NotificationPayload
): object {
  let title = "";
  let body = "";

  switch (type) {
    case "task_assigned":
      title = "New Task Assigned";
      body = `${payload.assignedBy} assigned you: ${payload.taskText}`;
      break;

    case "task_due_soon":
      title = "Task Due Soon";
      body = `"${payload.taskText}" is due ${payload.timeUntil}`;
      break;

    case "task_overdue":
      title = "Overdue Task";
      body = `"${payload.taskText}" is overdue`;
      break;

    case "task_completed":
      title = "Task Completed";
      body = `${payload.completedBy} completed: ${payload.taskText}`;
      break;

    case "generic":
    default:
      title = "Notification";
      body = payload.message || "You have a new notification";
  }

  return {
    title,
    body,
    taskId: payload.taskId,
    type,
    url: payload.taskId ? `/?task=${payload.taskId}` : "/",
  };
}

// Send notification to iOS device via APNs
async function sendToIOS(
  token: string,
  notification: object,
  apnsToken: string
): Promise<{ success: boolean; token: string; error?: string }> {
  try {
    const response = await fetch(`https://${APNS_HOST}/3/device/${token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${apnsToken}`,
        "apns-topic": BUNDLE_ID,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
      },
      body: JSON.stringify(notification),
    });

    if (response.ok) {
      return { success: true, token };
    }

    const error = await response.text();
    console.error(`APNs error for token ${token}:`, error);

    // Handle specific APNs errors
    if (response.status === 410) {
      // Device token is no longer active - should be removed
      return { success: false, token, error: "UNREGISTERED" };
    }

    return { success: false, token, error };
  } catch (error) {
    console.error(`Failed to send to iOS ${token}:`, error);
    return { success: false, token, error: error.message };
  }
}

// Base64url encode
function base64urlEncode(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Base64url decode
function base64urlDecode(str: string): Uint8Array {
  // Add padding
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Generate VAPID JWT for web push authentication
async function generateVAPIDToken(audience: string): Promise<string> {
  // Convert VAPID private key from base64url to raw format
  const privateKeyBytes = base64urlDecode(VAPID_PRIVATE_KEY);

  // Import as JWK for ES256
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: base64urlEncode(privateKeyBytes),
    x: VAPID_PUBLIC_KEY.slice(0, 43), // First 32 bytes of public key
    y: VAPID_PUBLIC_KEY.slice(43), // Last 32 bytes of public key
  };

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Create JWT header and payload
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
    sub: VAPID_SUBJECT,
  };

  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64urlEncode(signature);
  return `${unsignedToken}.${signatureB64}`;
}

// Send notification to Web Push endpoint
async function sendToWeb(
  subscriptionJson: string,
  notification: object
): Promise<{ success: boolean; token: string; error?: string }> {
  try {
    const subscription: WebPushSubscription = JSON.parse(subscriptionJson);

    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return { success: false, token: subscriptionJson, error: "Invalid subscription format" };
    }

    // Get the origin from the endpoint for VAPID audience
    const endpointUrl = new URL(subscription.endpoint);
    const audience = endpointUrl.origin;

    // Generate VAPID JWT
    const vapidToken = await generateVAPIDToken(audience);

    // Create the push message payload
    const payloadJson = JSON.stringify(notification);

    // For now, send unencrypted payload (some push services support this)
    // Full encryption requires ECDH key exchange which is complex
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `vapid t=${vapidToken}, k=${VAPID_PUBLIC_KEY}`,
        "Content-Type": "application/json",
        "TTL": "86400", // 24 hours
        "Urgency": "normal",
      },
      body: payloadJson,
    });

    if (response.ok || response.status === 201) {
      return { success: true, token: subscriptionJson };
    }

    const error = await response.text();
    console.error(`Web Push error for endpoint ${subscription.endpoint}:`, error, response.status);

    // Handle specific errors
    if (response.status === 404 || response.status === 410) {
      // Subscription is no longer valid
      return { success: false, token: subscriptionJson, error: "UNREGISTERED" };
    }

    return { success: false, token: subscriptionJson, error: `${response.status}: ${error}` };
  } catch (error) {
    console.error(`Failed to send web push:`, error);
    return { success: false, token: subscriptionJson, error: error.message };
  }
}

// Get device tokens for users (both iOS and Web)
async function getDeviceTokens(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userIds: string[]
): Promise<DeviceToken[]> {
  const { data, error } = await supabase
    .from("device_tokens")
    .select("token, platform, user_id")
    .in("user_id", userIds);

  if (error) {
    console.error("Error fetching device tokens:", error);
    return [];
  }

  return data || [];
}

// Remove invalid device tokens
async function removeInvalidTokens(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tokens: string[]
): Promise<void> {
  if (tokens.length === 0) return;

  const { error } = await supabase
    .from("device_tokens")
    .delete()
    .in("token", tokens);

  if (error) {
    console.error("Error removing invalid tokens:", error);
  }
}

// Main handler
serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { type, payload, userIds, deviceTokens, excludeUserId } = body;

    // Validate request
    if (!type || !payload) {
      return new Response(
        JSON.stringify({ error: "Missing type or payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Results tracking
    let iosResults: { success: boolean; token: string; error?: string }[] = [];
    let webResults: { success: boolean; token: string; error?: string }[] = [];

    // Handle explicit iOS device tokens (legacy support)
    if (deviceTokens && deviceTokens.length > 0) {
      // Assume these are iOS tokens for backward compatibility
      if (APNS_PRIVATE_KEY && APNS_KEY_ID && APNS_TEAM_ID) {
        const apnsToken = await generateAPNsToken();
        const iosNotification = buildAPNsNotification(type, payload);
        iosResults = await Promise.all(
          deviceTokens.map((token) => sendToIOS(token, iosNotification, apnsToken))
        );
      }
    } else if (userIds && userIds.length > 0) {
      // Filter out excluded user
      const targetUserIds = excludeUserId
        ? userIds.filter((id) => id !== excludeUserId)
        : userIds;

      // Get all device tokens for users
      const allTokens = await getDeviceTokens(supabase, targetUserIds);

      // Separate by platform
      const iosTokens = allTokens.filter((t) => t.platform === "ios");
      const webTokens = allTokens.filter((t) => t.platform === "web");

      // Send to iOS devices
      if (iosTokens.length > 0 && APNS_PRIVATE_KEY && APNS_KEY_ID && APNS_TEAM_ID) {
        try {
          const apnsToken = await generateAPNsToken();
          const iosNotification = buildAPNsNotification(type, payload);
          iosResults = await Promise.all(
            iosTokens.map((t) => sendToIOS(t.token, iosNotification, apnsToken))
          );
        } catch (error) {
          console.error("iOS push failed:", error);
        }
      }

      // Send to Web devices
      if (webTokens.length > 0 && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        try {
          const webNotification = buildWebPushNotification(type, payload);
          webResults = await Promise.all(
            webTokens.map((t) => sendToWeb(t.token, webNotification))
          );
        } catch (error) {
          console.error("Web push failed:", error);
        }
      }
    }

    // Combine results
    const allResults = [...iosResults, ...webResults];

    if (allResults.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No device tokens to send to",
          sent: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Track results
    const successful = allResults.filter((r) => r.success);
    const failed = allResults.filter((r) => !r.success);
    const unregistered = failed
      .filter((r) => r.error === "UNREGISTERED")
      .map((r) => r.token);

    // Remove unregistered tokens
    if (unregistered.length > 0) {
      await removeInvalidTokens(supabase, unregistered);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful.length,
        failed: failed.length,
        unregistered: unregistered.length,
        ios: { sent: iosResults.filter((r) => r.success).length, failed: iosResults.filter((r) => !r.success).length },
        web: { sent: webResults.filter((r) => r.success).length, failed: webResults.filter((r) => !r.success).length },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
