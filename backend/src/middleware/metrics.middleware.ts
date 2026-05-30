import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';

/**
 * Lightweight request metrics middleware.
 *
 * Tracks per-request duration and error counts in Redis so that
 * admin.service.ts getDetailedHealth() can surface real API performance data.
 *
 * Keys used:
 *   metric:query_times        — LPUSH/LTRIM list of last 100 response durations (ms)
 *   metric:requests:{minute}  — INCR counter, expires in 2 min
 *   metric:errors:{minute}    — INCR counter (5xx only), expires in 2 min
 *
 * Register this BEFORE all route handlers in app.ts:
 *   import { metricsMiddleware } from './middleware/metrics.middleware';
 *   app.use(metricsMiddleware);
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const minute = Math.floor(Date.now() / 60_000);

    // Fire-and-forget — never block the response
    Promise.all([
      // Track last 100 request durations for avg_query_ms calculation
      redis
        .call('LPUSH', 'metric:query_times', String(duration))
        .then(() => redis.call('LTRIM', 'metric:query_times', '0', '99')),

      // Count total requests in this minute window
      redis
        .call('INCR', `metric:requests:${minute}`)
        .then(() => redis.call('EXPIRE', `metric:requests:${minute}`, '120')),

      // Count 5xx errors in this minute window
      ...(res.statusCode >= 500
        ? [
            redis
              .call('INCR', `metric:errors:${minute}`)
              .then(() => redis.call('EXPIRE', `metric:errors:${minute}`, '120')),
          ]
        : []),
    ]).catch((err: unknown) => {
      // Never crash the app over metrics — log and move on
      console.warn('[metrics] Failed to record request metric:', (err as Error)?.message ?? err);
    });
  });

  next();
}