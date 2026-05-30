import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Frontend
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  FRONTEND_URLS: z.string().optional(),

  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // ISSUE 5 — Why SUPABASE_JWT_SECRET and not JWT_SECRET:
  // This secret is used to sign and verify all JWTs in the system (access
  // tokens + refresh tokens). It is named SUPABASE_JWT_SECRET because it must
  // be the same value as the "JWT Secret" shown in the Supabase dashboard
  // (Project Settings → API → JWT Settings). If you ever connect a Supabase
  // client that also validates JWTs, they must share this secret.
  // The redundant JWT_SECRET key that used to exist in .env has been removed
  // to avoid confusion — only SUPABASE_JWT_SECRET is authoritative.
  SUPABASE_JWT_SECRET: z.string().min(1, 'SUPABASE_JWT_SECRET is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // Email
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email'),

  // Auth / Security
  BCRYPT_SALT_ROUNDS: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(10).max(14)),
  OTP_EXPIRY_SECONDS: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(60)),
  GEO_FENCE_RADIUS_METERS: z
    .string()
    .transform(Number)
    .pipe(z.number().positive()),

  // ─── Push Notifications (Web Push / VAPID) ──────────────────────────────
  // All three keys are optional — if any are absent, push notifications are
  // silently disabled and the rest of the system continues normally.
  //
  // Generate a key pair once with:
  //   npx web-push generate-vapid-keys
  //
  // VAPID_PUBLIC_KEY  — shared with the browser (safe to expose)
  // VAPID_PRIVATE_KEY — kept server-side only, never sent to the client
  // VAPID_CONTACT_EMAIL — shown to push services as a contact address;
  //                       must be a valid mailto: or https: URI
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_CONTACT_EMAIL: z.string().email('VAPID_CONTACT_EMAIL must be a valid email').optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`\n❌ Invalid environment variables:\n${issues}\n`);
}

export const config = parsed.data;
export type Config = typeof config;