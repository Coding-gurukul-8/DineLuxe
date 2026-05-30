/**
 * frontend/public/sw.js
 *
 * DineLuxe Service Worker — handles Web Push notifications.
 *
 * ─── Registration (do this once in your app shell, e.g. app/layout.tsx) ──────
 *
 *   if ('serviceWorker' in navigator && 'PushManager' in window) {
 *     navigator.serviceWorker
 *       .register('/sw.js')
 *       .then((reg) => console.log('[SW] Registered:', reg.scope))
 *       .catch((err) => console.error('[SW] Registration failed:', err));
 *   }
 *
 * ─── Subscribing to push (call after user logs in) ───────────────────────────
 *
 *   import { apiClient } from '@/lib/api-client';
 *
 *   async function subscribeToPush() {
 *     // 1. Make sure the SW is ready
 *     const registration = await navigator.serviceWorker.ready;
 *
 *     // 2. Check existing subscription (avoid duplicate subscribes)
 *     let subscription = await registration.pushManager.getSubscription();
 *
 *     if (!subscription) {
 *       // 3. Fetch the VAPID public key from the backend
 *       const { data } = await apiClient.get('/notifications/push/vapid-key');
 *       const vapidPublicKey = data.vapidPublicKey;
 *
 *       // 4. Convert base64url → Uint8Array (required by the browser API)
 *       const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
 *
 *       // 5. Ask the browser to create a push subscription
 *       subscription = await registration.pushManager.subscribe({
 *         userVisibleOnly: true,   // required: must always show a notification
 *         applicationServerKey,
 *       });
 *     }
 *
 *     // 6. Send the subscription object to our backend
 *     await apiClient.post('/notifications/push/subscribe', {
 *       subscription: subscription.toJSON(),
 *       deviceType: 'web',
 *     });
 *   }
 *
 *   // Helper: converts the base64url VAPID key to the Uint8Array the
 *   // browser PushManager.subscribe() expects.
 *   function urlBase64ToUint8Array(base64String) {
 *     const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
 *     const base64 = (base64String + padding)
 *       .replace(/-/g, '+')
 *       .replace(/_/g, '/');
 *     const rawData = atob(base64);
 *     return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
 *   }
 *
 * ─── Unsubscribing (call when user opts out) ─────────────────────────────────
 *
 *   async function unsubscribeFromPush() {
 *     const registration = await navigator.serviceWorker.ready;
 *     const subscription = await registration.pushManager.getSubscription();
 *     if (!subscription) return;
 *
 *     // Tell the backend first so it can clean up its push_subscriptions row
 *     await apiClient.delete('/notifications/push/subscribe', {
 *       endpoint: subscription.endpoint,
 *     });
 *
 *     // Then unsubscribe from the browser push service
 *     await subscription.unsubscribe();
 *   }
 *
 * ─── Testing push locally ─────────────────────────────────────────────────────
 *
 *   Use the web-push CLI to send a test push directly to an endpoint:
 *
 *   npx web-push send-notification \
 *     --endpoint="<endpoint from subscription>" \
 *     --key="<p256dh>" \
 *     --auth="<auth>" \
 *     --vapid-subject="mailto:push@yourdomain.com" \
 *     --vapid-pubkey="$VAPID_PUBLIC_KEY" \
 *     --vapid-pvtkey="$VAPID_PRIVATE_KEY" \
 *     --payload='{"title":"Test","body":"Hello from DineLuxe!"}'
 */

'use strict';

// ─── Install ──────────────────────────────────────────────────────────────────
// Skip waiting so the new SW activates immediately rather than waiting for all
// existing tabs to close.
self.addEventListener('install', (event) => {
  console.log('[SW] Installing…');
  event.waitUntil(self.skipWaiting());
});

// ─── Activate ─────────────────────────────────────────────────────────────────
// Claim all existing clients so the new SW controls open pages right away.
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating…');
  event.waitUntil(self.clients.claim());
});

// ─── Push event ───────────────────────────────────────────────────────────────
// Fired when the push service delivers a message from the server.
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[SW] Push event received with no data — ignoring.');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Fallback: treat raw text as the notification body
    payload = { title: 'DineLuxe', body: event.data.text() };
  }

  const {
    title = 'DineLuxe',
    body = '',
    icon = '/icon-192.png',
    badge = '/badge-72.png',
    tag,
    data = {},
    actions = [],
  } = payload;

  const options = {
    body,
    icon,
    badge,
    tag,            // notifications with the same tag replace each other
    data,           // available in notificationclick handler
    actions,        // action buttons (limited browser support)
    requireInteraction: false,  // auto-dismiss after a few seconds on desktop
    silent: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, options),
  );
});

// ─── Notification click ───────────────────────────────────────────────────────
// Fired when the user taps the notification or one of its action buttons.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data ?? {};
  const action = event.action; // which action button was tapped, if any

  // Build the URL to open:
  //   - If the notification carries a `url` in its data payload, use that.
  //   - For specific action buttons, route accordingly.
  //   - Fall back to the app root.
  let targetUrl = '/';

  if (action === 'view_order' && notifData.orderId) {
    targetUrl = `/customer/order/${notifData.orderId}`;
  } else if (action === 'view_booking' && notifData.bookingId) {
    targetUrl = `/customer/booking/${notifData.bookingId}`;
  } else if (notifData.url) {
    targetUrl = notifData.url;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If there's already a tab open at the target URL, focus it
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});

// ─── Notification close ───────────────────────────────────────────────────────
// Fired when the user dismisses the notification (useful for analytics).
self.addEventListener('notificationclose', (event) => {
  const notifData = event.notification.data ?? {};
  console.info('[SW] Notification dismissed:', event.notification.title, notifData);
  // You could POST an analytics event here if needed
});

// ─── Push subscription change ─────────────────────────────────────────────────
// Fired by the browser when the push service rotates the subscription
// (rare, but required by the Push API spec to handle). We re-register
// the new subscription with the backend automatically.
self.addEventListener('pushsubscriptionchange', (event) => {
  console.info('[SW] Push subscription changed — re-subscribing…');

  const resubscribe = self.registration.pushManager
    .subscribe({
      userVisibleOnly: true,
      // applicationServerKey is passed in by the browser from the old subscription
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
    })
    .then(async (newSubscription) => {
      // POST the new subscription to the backend
      await fetch('/api/v1/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Note: no Authorization header here — the SW doesn't have access to
        // the auth token. The backend must accept this without auth, or you
        // must pass the token via the notification data payload at push time.
        // For a simpler approach, prompt the user to re-subscribe on next login.
        body: JSON.stringify({
          subscription: newSubscription.toJSON(),
          deviceType: 'web',
        }),
      });
    })
    .catch((err) => {
      console.error('[SW] Failed to re-subscribe after pushsubscriptionchange:', err);
    });

  event.waitUntil(resubscribe);
});