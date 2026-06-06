/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// ─── FCM Background Message Handler ──────────────────────────────────────────
//
// Firebase messaging requires these scripts to be imported in the service worker
// so it can receive push messages when the app is in the background or closed.
//
// The Firebase config (apiKey, messagingSenderId, etc.) is passed from the app
// to the service worker via `self.FIREBASE_CONFIG`. If it hasn't been set yet
// (e.g. first install before the app has run), we skip FCM setup gracefully.
//
// Note: importScripts() is synchronous and must be called at the top level of
// the service worker, BEFORE any other code runs.

try {
  importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

  // self.FIREBASE_CONFIG is injected by the app when it registers the SW.
  // See hooks/useFCMToken.ts — the app calls:
  //   navigator.serviceWorker.ready.then(reg => {
  //     reg.active.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
  //   });
  if (self.FIREBASE_CONFIG && self.FIREBASE_CONFIG.apiKey) {
    firebase.initializeApp(self.FIREBASE_CONFIG);
    const messaging = firebase.messaging();

    /**
     * Handle FCM push messages received while the app is in the background
     * or the browser tab is closed.
     *
     * Foreground messages are handled in the app via onMessage() in useFCMToken.ts.
     * This handler is only triggered for background messages.
     */
    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      const notificationTitle = title || 'DineLuxe';
      const notificationOptions = {
        body: body || '',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data: payload.data || {},
        // Tag prevents duplicate notifications for the same event
        tag: payload.data?.tag || `dineluxe-${Date.now()}`,
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (err) {
  // Graceful degradation: if Firebase scripts fail to load (e.g. offline,
  // content blocker), the rest of the service worker continues to function.
  console.warn('[SW] FCM setup failed — push via VAPID still active:', err);
}

// ─── Message handler: receive Firebase config from the app ────────────────────
//
// The app sends FIREBASE_CONFIG via postMessage so this SW has the config
// values without us needing to hard-code them here.

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    self.FIREBASE_CONFIG = event.data.config;
  }
});

// ─── Workbox / PWA caching (original content below) ──────────────────────────

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn't register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-aef005c8'], (function (workbox) { 'use strict';

  importScripts("worker-development.js");
  self.skipWaiting();
  workbox.clientsClaim();
  workbox.registerRoute("/", new workbox.NetworkFirst({
    "cacheName": "start-url",
    plugins: [{
      cacheWillUpdate: async ({
        request,
        response,
        event,
        state
      }) => {
        if (response && response.type === 'opaqueredirect') {
          return new Response(response.body, {
            status: 200,
            statusText: 'OK',
            headers: response.headers
          });
        }
        return response;
      }
    }]
  }), 'GET');
  workbox.registerRoute(/.*/i, new workbox.NetworkOnly({
    "cacheName": "dev",
    plugins: []
  }), 'GET');

}));
