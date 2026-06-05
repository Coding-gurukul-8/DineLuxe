import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { error } from '../utils/response';
import { redis } from '../config/redis';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  restaurant_id?: string;
  branch_id?: string;
  exp?: number;
  [key: string]: unknown;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(error('UNAUTHORIZED', 'Missing or malformed Authorization header'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.SUPABASE_JWT_SECRET) as JwtPayload;

    req.user = {
      ...decoded,
      id: decoded.sub,
      email: decoded.email ?? '',
      role: decoded.role ?? 'customer',
      restaurant_id: decoded.restaurant_id,
      branch_id: decoded.branch_id,
    };

    // ── GDPR M23: Revocation check (all roles) ───────────────────────────────
    // anonymizeUserAccount() writes revoked_user:{userId} with a 7-day TTL.
    // Without this check a deleted account's 15-minute access token would
    // remain valid until natural expiry — this gate closes that window.
    // Runs before the suspension check and before next() so no downstream
    // handler ever sees a request from a deleted account.
    // Redis failures fall through (ResilientRedis has in-memory fallback)
    // rather than taking the API down for a cache miss.
    try {
      const isRevoked = await redis.exists(`revoked_user:${req.user.id}`);
      if (isRevoked === 1) {
        res.status(401).json(
          error('ACCOUNT_DELETED', 'This account has been permanently deleted'),
        );
        return;
      }
    } catch (redisErr) {
      console.error('[auth] Revocation check failed:', redisErr);
    }

    // ── Suspension check (customers only) ─────────────────────────────────────
    // suspendCustomer() sets `suspended:{id}` in Redis with no TTL.
    // This gate runs on every request so banned customers are rejected
    // immediately even if their JWT has not technically expired yet.
    if (req.user.role === 'customer') {
      const suspended = await redis.get(`suspended:${req.user.id}`);
      if (suspended) {
        res.status(403).json(
          error(
            'ACCOUNT_SUSPENDED',
            'Your account has been suspended. Contact support@dineluxe.app',
          ),
        );
        return;
      }
    }

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      // 401 = needs re-authentication. Using 403 here was wrong because it
      // short-circuits before RBAC runs, making role-check tests return 403
      // TOKEN_EXPIRED instead of 403 FORBIDDEN (two different 403 meanings
      // that confuse clients). Clients must re-login on 401.
      res.status(401).json(error('TOKEN_EXPIRED', 'Access token has expired'));
      return;
    }
    res.status(401).json(error('INVALID_TOKEN', 'Invalid access token'));
  }
}