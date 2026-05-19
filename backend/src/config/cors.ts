import cors from 'cors';
import { config } from './env';

// ── Allowed origins ───────────────────────────────────────────────────────────
// Build from FRONTEND_URLS (comma-separated list) with FRONTEND_URL as the
// fallback when FRONTEND_URLS is not set.  Both values come from env.ts, which
// validates them at boot, so we can trust they are non-empty strings here.
const allowedOrigins: string[] = [
  ...(config.FRONTEND_URLS ?? config.FRONTEND_URL)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Deduplicate: FRONTEND_URL may already be the sole entry in FRONTEND_URLS.
  ...(config.FRONTEND_URLS ? [config.FRONTEND_URL] : []),
].filter((origin, index, self) => origin && self.indexOf(origin) === index);

// ── CORS options ──────────────────────────────────────────────────────────────
export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no Origin header (mobile apps, server-to-server,
    // curl in development, and same-origin requests in some browsers).
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin "${origin}" is not allowed`));
    }
  },

  // Required for cookies and Authorization headers to be sent cross-origin.
  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Authorization',     // Bearer token / JWT
    'Content-Type',      // application/json, multipart/form-data, etc.
    'X-Requested-With',  // XMLHttpRequest header sent by some HTTP clients
  ],
};

export const corsMiddleware = cors(corsOptions);