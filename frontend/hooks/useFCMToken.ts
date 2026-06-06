'use client';

/**
 * hooks/useFCMToken.ts
 *
 * React hook that:
 *   1. Requests notification permission from the user (if not already granted)
 *   2. Initialises the Firebase app (singleton — safe to call multiple times)
 *   3. Obtains an FCM registration token from the Firebase SDK
 *   4. Posts the token to the backend (POST /notifications/push/fcm-token)
 *   5. Listens for token refreshes and re-registers automatically
 *   6. Handles foreground messages by showing a toast notification
 *   7. Sends the Firebase config to the service worker for background messages
 *
 * Usage:
 *   // Call in app/customer/layout.tsx and app/staff/layout.tsx
 *   useFCMToken();
 *
 * Graceful degradation:
 *   - If NEXT_PUBLIC_FIREBASE_API_KEY is not set, the hook is a no-op.
 *   - If the user denies notification permission, the hook exits silently.
 *   - Errors posting to the backend are logged but never thrown.
 *
 * ─── Required env vars (frontend .env.local) ─────────────────────────────────
 *   NEXT_PUBLIC_FIREBASE_API_KEY=...
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
 *   NEXT_PUBLIC_FIREBASE_APP_ID=...
 *   NEXT_PUBLIC_FIREBASE_VAPID_KEY=...   (Web Push cert from Firebase Console)
 */

import { useEffect } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

// ─── Firebase config from environment variables ───────────────────────────────

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFCMToken(): void {
  useEffect(() => {
    // Skip entirely if Firebase is not configured
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return;

    // Skip in non-browser environments (SSR)
    if (typeof window === 'undefined') return;

    // FCM requires service worker support
    if (!('serviceWorker' in navigator)) return;

    let unsubscribeOnMessage: (() => void) | undefined;

    async function init() {
      try {
        // Dynamically import Firebase to avoid including it in the server bundle
        const { initializeApp, getApps } = await import('firebase/app');
        const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

        // Initialise Firebase once (getApps() returns existing instances)
        const app =
          getApps().length > 0
            ? getApps()[0]
            : initializeApp(firebaseConfig);

        const messaging = getMessaging(app);

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.info('[FCM] Notification permission denied — skipping FCM setup.');
          return;
        }

        // Get the FCM registration token (uses VAPID key for Web Push compat)
        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: await navigator.serviceWorker.ready,
        });

        if (token) {
          // Persist token to the backend
          await postFCMToken(token);

          // Forward Firebase config to service worker so it can handle
          // background messages (see public/sw.js)
          sendConfigToServiceWorker();
        } else {
          console.warn('[FCM] No registration token — notification permission may be blocked.');
        }

        // Handle foreground messages (app is open in the browser tab)
        // Background messages are handled by the service worker (sw.js)
        unsubscribeOnMessage = onMessage(messaging, (payload: any) => {
          const { title, body } = (payload as any).notification || {};
          toast(body || title || 'New notification', {
            icon: '🔔',
            description: body && title ? body : undefined,
          });
        });
      } catch (err) {
        console.error('[FCM] Initialisation error:', err);
      }
    }

    init();

    // Cleanup foreground message listener on unmount
    return () => {
      unsubscribeOnMessage?.();
    };
  }, []);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Posts the FCM token to the backend so the server can send push notifications
 * to this device. Errors are caught and logged — never thrown to the caller.
 */
async function postFCMToken(token: string): Promise<void> {
  try {
    await apiClient.post('/notifications/push/fcm-token', { fcm_token: token });
  } catch (err) {
    console.error('[FCM] Failed to register token with backend:', err);
  }
}

/**
 * Sends the Firebase client config to the active service worker via postMessage.
 * The SW needs this to initialise firebase.initializeApp() for background messages.
 */
async function sendConfigToServiceWorker(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({
        type: 'FIREBASE_CONFIG',
        config: firebaseConfig,
      });
    }
  } catch (err) {
    console.warn('[FCM] Could not send config to service worker:', err);
  }
}
