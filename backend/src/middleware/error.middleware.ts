// ─────────────────────────────────────────────────────────────────────────────
// error.middleware.ts  —  Global error handler for RestaurantOS / DineLuxe
//
// MUST be the LAST app.use() call in app.ts:
//   app.use(notFoundHandler);
//   app.use(errorMiddleware);
//
// Handles:
//   • Zod validation errors         → 400  VALIDATION_ERROR  (with field list)
//   • Supabase unique constraint     → 409  CONFLICT
//   • JWT expiry                     → 401  TOKEN_EXPIRED
//   • JWT invalid signature / malform→ 401  TOKEN_INVALID
//   • Known app errors (statusCode)  → forwarded as-is
//   • All other errors               → 500  INTERNAL_ERROR
//
// Stack traces:
//   • development: included in the response body
//   • production : never exposed (logged to stderr only)
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import winston from 'winston';
import { error, validationError } from '../utils/response';
import { config } from '../config/env';

// ── Logger ────────────────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.NODE_ENV === 'development'
      ? winston.format.prettyPrint()
      : winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

// ── Supabase / PostgreSQL error detection ─────────────────────────────────────

/**
 * Returns true if the error originated from a PostgreSQL unique-constraint
 * violation (code 23505) forwarded by Supabase/PostgREST.
 */
function isUniqueConstraintError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as Record<string, unknown>;

  // Supabase wraps PG errors under e.code
  if (e.code === '23505') return true;

  // PostgREST sometimes embeds the PG code inside the message
  if (
    typeof e.message === 'string' &&
    (e.message.includes('duplicate key') ||
      e.message.includes('unique constraint') ||
      e.message.includes('23505'))
  ) {
    return true;
  }

  // Nested detail from @supabase/supabase-js
  if (
    typeof e.details === 'string' &&
    e.details.includes('already exists')
  ) {
    return true;
  }

  return false;
}

// ── JWT error detection ───────────────────────────────────────────────────────

function isJwtExpiredError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as Record<string, unknown>;
  return (
    e.name === 'TokenExpiredError' ||
    (typeof e.message === 'string' && e.message.includes('jwt expired'))
  );
}

function isJwtInvalidError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as Record<string, unknown>;
  return (
    e.name === 'JsonWebTokenError' ||
    e.name === 'NotBeforeError' ||
    (typeof e.message === 'string' &&
      (e.message.includes('invalid token') ||
        e.message.includes('jwt malformed') ||
        e.message.includes('invalid signature')))
  );
}

// ── Type helpers ──────────────────────────────────────────────────────────────

type AppError = Error & {
  status?: number;
  statusCode?: number;
  code?: string;
};

// ── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isDevelopment = config.NODE_ENV !== 'production';

  // ── Log every error ──────────────────────────────────────────────────────
  logger.error({
    message: err.message,
    code: err.code,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });

  // ── 1. Zod validation errors ─────────────────────────────────────────────
  if (err instanceof ZodError) {
    const fieldErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json(validationError(fieldErrors));
    return;
  }

  // ── 2. Supabase unique constraint ────────────────────────────────────────
  if (isUniqueConstraintError(err)) {
    res.status(409).json(
      error('CONFLICT', err.message || 'A record with these details already exists'),
    );
    return;
  }

  // ── 3. JWT expired ───────────────────────────────────────────────────────
  if (isJwtExpiredError(err)) {
    res.status(401).json(error('TOKEN_EXPIRED', 'Your session has expired. Please log in again.'));
    return;
  }

  // ── 4. JWT invalid ───────────────────────────────────────────────────────
  if (isJwtInvalidError(err)) {
    res.status(401).json(error('TOKEN_INVALID', 'Invalid authentication token.'));
    return;
  }

  // ── 5. Known application errors (thrown with statusCode / status) ────────
  const appStatus = err.statusCode ?? err.status;
  if (appStatus && appStatus >= 400 && appStatus < 500) {
    // Map common HTTP status codes to canonical error codes
    const code = err.code ?? httpStatusToErrorCode(appStatus);
    res.status(appStatus).json(error(code, err.message));
    return;
  }

  // ── 6. Unhandled / 5xx ───────────────────────────────────────────────────
  const body = error(
    'INTERNAL_ERROR',
    isDevelopment ? err.message : 'Something went wrong. Please try again later.',
  );

  if (isDevelopment && err.stack) {
    // Attach stack only in development — never in production
    (body.error as Record<string, unknown>).stack = err.stack;
  }

  res.status(500).json(body);
}

// ── 404 handler ───────────────────────────────────────────────────────────────

/**
 * Catches requests to unregistered routes.
 * Register BEFORE errorMiddleware in app.ts.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res
    .status(404)
    .json(error('NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
}

// ── Utility ───────────────────────────────────────────────────────────────────

function httpStatusToErrorCode(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMIT_EXCEEDED',
  };
  return map[status] ?? 'CLIENT_ERROR';
}
