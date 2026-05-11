# Frontend Backend Production Connection

Use one of these production patterns. Do not leave production traffic pointing at localhost.

## Recommended direct API mode

Frontend environment:

```env
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Backend environment:

```env
FRONTEND_URL=https://app.example.com
FRONTEND_URLS=https://app.example.com,https://www.example.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
REDIS_URL=redis://...
RESEND_API_KEY=re_...
EMAIL_FROM=DineLuxe <noreply@example.com>
```

In this mode the browser calls the backend directly. CORS must allow every deployed frontend origin through `FRONTEND_URLS`.

## Proxy mode

Frontend environment:

```env
NEXT_PUBLIC_API_URL=
BACKEND_ORIGIN=https://api.example.com
```

In this mode the browser calls `/api/v1/*` on the frontend domain and Next.js proxies those requests to `BACKEND_ORIGIN`.

## Local verification

```powershell
pnpm --filter restaurant-os-backend dev
pnpm --filter dineluxe-frontend dev
```

Then verify:

```powershell
Invoke-WebRequest http://localhost:3000/api/v1/health -UseBasicParsing
```

The response should be the backend health payload.

## Release checks

Run these before deploying:

```powershell
pnpm typecheck
pnpm --filter dineluxe-frontend build
pnpm --filter restaurant-os-backend build
```
