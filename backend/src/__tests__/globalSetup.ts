/**
 * globalSetup.ts
 *
 * Runs once before any test module is loaded.
 * Sets the minimum env vars required by src/config/env.ts (Zod schema)
 * so the app can be imported without crashing.
 *
 * All network-touching services (Supabase, Redis, Resend) are mocked in the
 * test files themselves, so these values are never used to make real calls.
 */
export default async function globalSetup() {
  process.env.NODE_ENV                  = 'test';
  process.env.PORT                      = '3001';
  process.env.FRONTEND_URL              = 'http://localhost:3000';
  process.env.SUPABASE_URL              = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.SUPABASE_JWT_SECRET       = 'test-jwt-secret-minimum-32-chars!!';
  process.env.REDIS_URL                 = 'redis://localhost:6379';
  process.env.RESEND_API_KEY            = 're_test_key';
  process.env.EMAIL_FROM                = 'test@restaurantos.dev';
  process.env.BCRYPT_SALT_ROUNDS        = '10';
  process.env.OTP_EXPIRY_SECONDS        = '300';
  process.env.GEO_FENCE_RADIUS_METERS   = '500';
}