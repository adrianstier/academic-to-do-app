// Service Worker for Web Push Notifications
// Bealer Agency Task Management

const CACHE_NAME = 'bealer-tasks-v1';

// Handle push notifications
self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('Push event but no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'Task Reminder',
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || 'You have a task reminder',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: data.taskId || 'task-notification-' + Date.now(),
    renotify: true,
    data: {
      url: data.url || '/',
      taskId: data.taskId,
      type: data.type, // 'task_due_soon', 'task_due_today', 'task_overdue'
    },
    // Keep notification visible for overdue tasks
    requireInteraction: data.type === 'task_overdue',
    actions: [
      { action: 'view', title: 'View Task' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    // Vibration pattern for mobile
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Task Reminder', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Handle dismiss action
  if (event.action === 'dismiss') {
    return;
  }

  // Get the target URL
  const url = event.notification.data?.url || '/';
  const taskId = event.notification.data?.taskId;

  // Build URL with task parameter for highlighting
  const targetUrl = taskId ? `/?task=${taskId}` : url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate existing window to the task
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window if none exists
      return clients.openWindow(targetUrl);
    })
  );
});

// Handle notification close (for analytics if needed)
self.addEventListener('notificationclose', function(event) {
  // Could track dismissals here if needed
  console.log('Notification closed:', event.notification.tag);
});

// Service worker activation
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName !== CACHE_NAME;
        }).map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Service worker install
self.addEventListener('install', function(event) {
  // Skip waiting to activate immediately
  self.skipWaiting();
});
