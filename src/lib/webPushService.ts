'use client';

/**
 * Web Push Service
 *
 * Handles browser push notification subscription and management.
 * Uses VAPID protocol for authentication with push services.
 */

// Get VAPID public key from environment
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    return 'denied';
  }
  return Notification.requestPermission();
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) {
    console.log('Push notifications not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    console.log('Service worker registered successfully');
    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

/**
 * Get existing service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.error('Failed to get service worker registration:', error);
    return null;
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.error('VAPID public key not configured');
    return null;
  }

  try {
    // Check for existing subscription
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('Returning existing push subscription');
      return existingSubscription;
    }

    // Create new subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    console.log('Push subscription created successfully');
    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('Unsubscribed from push notifications');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return false;
  }
}

/**
 * Get current push subscription if exists
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;

  try {
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Failed to get current subscription:', error);
    return null;
  }
}

/**
 * Save subscription to backend
 */
export async function saveSubscriptionToServer(
  subscription: PushSubscription,
  userId: string,
  userName: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Name': userName,
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userId,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Failed to save subscription to server:', error);
    return false;
  }
}

/**
 * Remove subscription from backend
 */
export async function removeSubscriptionFromServer(
  subscription: PushSubscription,
  userId: string,
  userName: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/push-subscribe', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Name': userName,
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userId,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Failed to remove subscription from server:', error);
    return false;
  }
}

/**
 * Full flow: Request permission, register SW, subscribe, and save to server
 */
export async function enablePushNotifications(
  userId: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  // Check support
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications are not supported in this browser' };
  }

  // Request permission
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return { success: false, error: 'Notification permission was denied' };
  }

  // Register service worker
  const registration = await registerServiceWorker();
  if (!registration) {
    return { success: false, error: 'Failed to register service worker' };
  }

  // Subscribe to push
  const subscription = await subscribeToPush(registration);
  if (!subscription) {
    return { success: false, error: 'Failed to subscribe to push notifications' };
  }

  // Save to server
  const saved = await saveSubscriptionToServer(subscription, userId, userName);
  if (!saved) {
    return { success: false, error: 'Failed to save subscription to server' };
  }

  return { success: true };
}

/**
 * Full flow: Unsubscribe and remove from server
 */
export async function disablePushNotifications(
  userId: string,
  userName: string
): Promise<boolean> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true; // Already unsubscribed

  // Remove from server first
  await removeSubscriptionFromServer(subscription, userId, userName);

  // Then unsubscribe locally
  await unsubscribeFromPush(registration);

  return true;
}

/**
 * Convert VAPID public key from base64 to Uint8Array
 * Required for applicationServerKey in subscribe()
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
