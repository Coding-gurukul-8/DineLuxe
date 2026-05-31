# DineLuxe Setup Guide

## Prerequisites

- Node.js 20 LTS or newer
- PostgreSQL database from Supabase
- Redis from Upstash or a local Redis instance
- Resend account for email delivery
- Web Push VAPID keys for browser notifications

## Quick Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd restaurant-os
pnpm install
pnpm --dir backend install
pnpm --dir frontend install
```

### 2. Backend environment

If `backend/.env` does not already exist, create it from the example file:

```bash
cp backend/.env.example backend/.env
```

Fill in the real values for Supabase, Redis, email, and push notifications.

### 3. Supabase setup

- Create a Supabase project.
- Copy `DATABASE_URL` and `DIRECT_URL` from the database settings.
- Copy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the API settings.
- Copy `SUPABASE_JWT_SECRET` from the JWT settings.
- Run backend migrations with `npx prisma migrate deploy` inside `backend/`.
- Apply any required SQL functions or seed SQL in the Supabase SQL editor.

### 4. Redis setup

- Create a Redis database in Upstash or use a local Redis instance.
- Copy the connection string into `REDIS_URL`.

### 5. Web Push setup

Generate VAPID keys and add them to the backend environment file:

```bash
node -e "const wp = require('web-push'); const keys = wp.generateVAPIDKeys(); console.log(keys);"
```

### 6. Run the app locally

```bash
pnpm --dir backend dev
pnpm --dir frontend dev
```

- Backend runs on port `4000` by default.
- Frontend runs on port `3000` by default.

### 7. First login

- Create the first super admin through `POST /api/v1/auth/signup/admin`.
- If a seed script exists in your branch, you can also run it from `backend/`.

## Environment Variables

### Backend (`backend/.env`)

- `PORT` - backend port, usually `4000`.
- `NODE_ENV` - runtime mode such as `development`, `test`, or `production`.
- `FRONTEND_URL` - primary frontend origin used for redirects and CORS.
- `FRONTEND_URLS` - comma-separated allowed frontend origins for CORS.
- `DATABASE_URL` - pooled Supabase Postgres URL used by Prisma.
- `DIRECT_URL` - direct Supabase Postgres URL used for migrations.
- `SUPABASE_URL` - Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service-role key for server-side access.
- `SUPABASE_JWT_SECRET` - Supabase JWT secret used to verify and sign auth tokens.
- `REDIS_URL` - Redis connection string.
- `RESEND_API_KEY` - Resend API key for outbound email.
- `EMAIL_FROM` - sender address used in transactional email.
- `VAPID_PUBLIC_KEY` - public VAPID key for browser push.
- `VAPID_PRIVATE_KEY` - private VAPID key for browser push.
- `VAPID_CONTACT_EMAIL` - contact email used in push metadata.
- `BCRYPT_SALT_ROUNDS` - bcrypt cost factor for password hashing.
- `OTP_EXPIRY_SECONDS` - OTP lifetime in seconds.
- `GEO_FENCE_RADIUS_METERS` - arrival/geofence radius in meters.
- `LOYALTY_POINTS_PER_RUPEE` - loyalty points earned per rupee spent.
- `LOYALTY_MIN_REDEEM_POINTS` - minimum balance required to redeem points.
- `LOYALTY_RUPEES_PER_POINT` - rupee value of a single loyalty point.
- `QUEUE_NO_SHOW_GRACE_MINUTES` - grace window before queue no-show cleanup.
- `KITCHEN_OVERDUE_THRESHOLD_MINUTES` - order age threshold for overdue alerts.
- `DEFAULT_UPI_ID` - fallback UPI handle for payment flows.
- `RAZORPAY_KEY_ID` - optional Razorpay payment gateway key.
- `RAZORPAY_KEY_SECRET` - optional Razorpay payment gateway secret.
- `RAZORPAY_WEBHOOK_SECRET` - optional Razorpay webhook signature secret.
- `STRIPE_SECRET_KEY` - optional Stripe payment gateway secret.
- `STRIPE_WEBHOOK_SECRET` - optional Stripe webhook signature secret.
- `ENABLE_PUSH_NOTIFICATIONS` - optional feature flag for push flows.
- `ENABLE_LOYALTY` - optional feature flag for loyalty flows.
- `ENABLE_REVIEW_NOTIFICATIONS` - optional feature flag for review alerts.
- `ENABLE_SUPPORT_NOTIFICATIONS` - optional feature flag for support alerts.

### Frontend (`frontend/.env.local`)

- `BACKEND_ORIGIN` - backend origin used by `frontend/next.config.ts` for rewrites in non-production builds.
- `NEXT_PUBLIC_API_URL` - backend API base URL exposed to the browser.
- `NEXT_PUBLIC_SUPABASE_URL` - public Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - public Supabase anonymous key.
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` - optional Google Maps key for map views.

## Production Deployment

### Backend

- Build command: `pnpm --dir backend build`
- Start command: `pnpm --dir backend start`
- Set the production versions of all backend environment variables.

### Frontend

- Deploy the frontend from your Git provider.
- Set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Add any optional public keys needed by the pages you use.

### Database and Redis

- Keep Supabase as the managed Postgres host.
- Keep Redis on Upstash or another managed Redis service.

## Troubleshooting

- CORS errors usually mean `FRONTEND_URLS` is missing a preview or production origin.
- JWT verification failures usually mean `SUPABASE_JWT_SECRET` does not match Supabase.
- Push notifications fail when VAPID keys are missing or mismatched.
- Prisma migration errors usually mean `DATABASE_URL` and `DIRECT_URL` are swapped or incomplete.
- Queue or overdue alerts may not fire if the relevant minute-based env values are set too high.
