'use strict';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        title: 'DineLuxe',
        body: event.data.text(),
      };
    }
  }

  const title = payload.title || 'DineLuxe';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/badge-72.png',
    tag: payload.tag,
    data: payload.data || {},
    actions: payload.actions || [],
    requireInteraction: payload.requireInteraction || false,
    silent: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  let targetUrl = data.url || '/';

  if (action === 'view_order' && data.orderId) {
    targetUrl = `/customer/order/${data.orderId}`;
  }

  if (action === 'view_booking' && data.bookingId) {
    targetUrl = `/customer/booking/${data.bookingId}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url === targetUrl) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};

  event.waitUntil(
    fetch('/api/v1/notifications/dismissed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: event.notification.title,
        data,
        closedAt: new Date().toISOString(),
      }),
    }).catch(() => undefined),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  const resubscribe = self.registration.pushManager
    .subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
    })
    .then(async (newSubscription) => {
      await fetch('/api/v1/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: newSubscription.toJSON(),
          deviceType: 'web',
        }),
      });
    })
    .catch(() => undefined);

  event.waitUntil(resubscribe);
});