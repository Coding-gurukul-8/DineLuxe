import { z } from 'zod';

// ─── Existing: FCM device token registration ───────────────────────────────────

/** Flat shape — validates `req.body` directly */
export const registerDeviceSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});

// ─── Web Push: browser PushSubscription registration ─────────────────────────

/**
 * Shape of the object returned by `PushSubscription.toJSON()` in the browser.
 *
 * Reference: https://www.w3.org/TR/push-api/#dom-pushsubscription-tojson
 *
 * The `expirationTime` field is included by some browsers but is often null,
 * so we accept it as an optional nullable number.
 */
const pushSubscriptionJsonSchema = z.object({
  endpoint: z
    .string()
    .url('subscription.endpoint must be a valid HTTPS URL')
    .refine((url) => url.startsWith('https://'), {
      message: 'Push endpoint must use HTTPS',
    }),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(10, 'p256dh key is required'),
    auth: z.string().min(10, 'auth key is required'),
  }),
});

/**
 * Body schema for POST /notifications/push/subscribe
 *
 * The client sends:
 *   {
 *     "subscription": { endpoint, keys: { p256dh, auth } },
 *     "deviceType": "web"   // optional, defaults to "web"
 *   }
 */
export const registerPushSubscriptionSchema = z.object({
  subscription: pushSubscriptionJsonSchema,
  deviceType: z.enum(['web', 'android', 'ios']).default('web'),
});

export type RegisterPushSubscriptionInput = z.infer<typeof registerPushSubscriptionSchema>;

// ─── FCM: Firebase Cloud Messaging token registration ────────────────────────

/**
 * Body schema for POST /notifications/push/fcm-token
 *
 * The client sends:
 *   { "fcm_token": "<firebase-registration-token>" }
 *
 * FCM tokens are long strings (152+ characters) returned by the Firebase SDK
 * after the user grants notification permission.
 */
export const storeFCMTokenSchema = z.object({
  fcm_token: z
    .string()
    .min(20, 'fcm_token must be a valid Firebase registration token'),
});

export type StoreFCMTokenInput = z.infer<typeof storeFCMTokenSchema>;
