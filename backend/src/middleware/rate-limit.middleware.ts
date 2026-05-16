import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../config/redis';
import { config } from '../config/env';
import { error } from '../utils/response';

function makeStore(prefix: string) {
  return new RedisStore({
    // @ts-expect-error – ioredis and rate-limit-redis type mismatch on sendCommand
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix,
  });
}

import type { Request, Response, NextFunction } from 'express';

/**
 * express-rate-limit `handler` — called when a client exceeds the limit.
 * Uses the `handler` option (not `message`) so we can send a structured JSON
 * response with the correct status code and our API error envelope.
 */
function makeRateLimitHandler(msg: string) {
  return (_req: Request, res: Response, _next: NextFunction, options: { statusCode: number }) => {
    res.status(options.statusCode).json(error('RATE_LIMIT_EXCEEDED', msg));
  };
}

/** Shared safe-store factory: if Redis is unavailable the limiter degrades gracefully */
function makeLimiter(options: Parameters<typeof rateLimit>[0], prefix: string) {
  if (redis.status !== 'ready') {
    return rateLimit({
      skipFailedRequests: false,
      ...options,
    });
  }

  return rateLimit({
    skipFailedRequests: false,
    store: makeStore(prefix),
    ...options,
  });
}

/** 100 requests per 15 minutes – general API routes */
export const generalLimiter: import('express-rate-limit').RateLimitRequestHandler = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeRateLimitHandler('Too many requests. Please try again in 15 minutes.'),
}, 'rl:general:');

/** 10 requests per 15 minutes – auth routes */
const authMax = config.NODE_ENV === 'development' ? 1000 : 10;

export const authLimiter: import('express-rate-limit').RateLimitRequestHandler = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeRateLimitHandler('Too many authentication attempts. Please try again in 15 minutes.'),
}, 'rl:auth:');

/** 20 requests per hour – upload routes */
export const uploadLimiter: import('express-rate-limit').RateLimitRequestHandler = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeRateLimitHandler('Upload limit reached. Please try again in an hour.'),
}, 'rl:upload:');