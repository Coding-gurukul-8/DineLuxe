/**
 * Delivery Acceptance Timeout Job
 *
 * Checks for delivery assignments that were assigned to a partner but not
 * accepted within the 30-second window, then auto-reassigns them.
 *
 * Designed to be run on a short polling interval (e.g. every 10 seconds via
 * cron or setInterval in the server bootstrap). Acts as a reliable fallback
 * to the in-process setTimeout that is set up in assignDelivery() — useful
 * when the Node.js process restarts mid-assignment.
 *
 * Pattern: identical to inventory-alert.ts / booking-reminder.ts in this repo
 * (plain exported async function, compatible with Supabase Edge Functions).
 *
 * Redis keys used:
 *   delivery_acceptance_timeouts        — sorted set, member = deliveryId,
 *                                         score = acceptance deadline (Unix s)
 *   delivery_acceptance:{id}:{partner}  — per-assignment key with TTL=30s;
 *                                         absence means already accepted
 */

import { supabaseAdmin } from '../config/supabase';
import { redis } from '../config/redis';
import { runAcceptanceTimeoutForDelivery } from '../modules/delivery/delivery.service';

const ACCEPTANCE_TIMEOUT_SECONDS = 30;
const SORTED_SET_KEY = 'delivery_acceptance_timeouts';

// ─── Run acceptance timeout sweep ─────────────────────────────────────────────

export async function runDeliveryAcceptanceTimeouts(): Promise<void> {
  const nowSeconds = Math.floor(Date.now() / 1000);

  // The sorted set stores deliveryId → deadline score.
  // We need all entries whose deadline has passed (score ≤ now).
  // ResilientRedis wraps ioredis but doesn't expose zrangebyscore directly,
  // so we do a scan-and-filter over the in-memory map for the offline fallback.
  // For the connected case we call ioredis via the raw client.

  let expiredDeliveryIds: string[] = [];

  try {
    // Try ioredis zrangebyscore (connected path)
    const raw = (redis as any).client;
    if (raw && typeof raw.zrangebyscore === 'function') {
      expiredDeliveryIds = await raw.zrangebyscore(SORTED_SET_KEY, '-inf', String(nowSeconds));
    } else {
      // Offline/memory fallback: inspect memoryZSets
      const zset: Map<string, number> | undefined = (redis as any).memoryZSets?.get(SORTED_SET_KEY);
      if (zset) {
        for (const [member, score] of zset.entries()) {
          if (score <= nowSeconds) expiredDeliveryIds.push(member);
        }
      }
    }
  } catch (err: any) {
    console.error('[delivery-timeout] Failed to read acceptance timeouts from Redis:', err.message);
    return;
  }

  if (expiredDeliveryIds.length === 0) {
    return;
  }

  console.log(
    `[delivery-timeout] ${expiredDeliveryIds.length} delivery assignment(s) may have timed out`,
  );

  for (const deliveryId of expiredDeliveryIds) {
    try {
      // Look up the current DB state to get the partner ID
      const { data: delivery, error } = await supabaseAdmin
        .from('delivery_assignments')
        .select('id, status, partner_id')
        .eq('id', deliveryId)
        .maybeSingle();

      if (error) {
        console.error(`[delivery-timeout] DB lookup failed for ${deliveryId}:`, error.message);
        // Remove from sorted set to prevent re-processing
        await redis.zrem(SORTED_SET_KEY, deliveryId);
        continue;
      }

      if (!delivery) {
        // Delivery no longer exists — clean up sorted set entry
        await redis.zrem(SORTED_SET_KEY, deliveryId);
        continue;
      }

      if (delivery.status !== 'assigned') {
        // Already progressed past 'assigned' — remove stale entry and skip
        await redis.zrem(SORTED_SET_KEY, deliveryId);
        continue;
      }

      // Delegate to the shared helper in delivery.service.ts
      await runAcceptanceTimeoutForDelivery(deliveryId, delivery.partner_id);

      console.log(
        `[delivery-timeout] Processed timeout for delivery ${deliveryId} / partner ${delivery.partner_id}`,
      );
    } catch (err: any) {
      console.error(`[delivery-timeout] Failed to process delivery ${deliveryId}:`, err.message);
      // Don't remove from sorted set on unexpected error — retry on next sweep
    }
  }
}

// ─── Register as a recurring in-process interval ─────────────────────────────
/**
 * Call this once from server.ts (or app startup) to enable the periodic sweep.
 * A 10-second interval gives a ≤10s lag on top of the 30s acceptance window,
 * which is acceptable.
 *
 * Usage in server.ts:
 *   import { startDeliveryAcceptanceTimeoutJob } from './jobs/delivery-acceptance-timeout';
 *   startDeliveryAcceptanceTimeoutJob();
 */
export function startDeliveryAcceptanceTimeoutJob(
  intervalSeconds = 10,
): NodeJS.Timeout {
  console.log(
    `[delivery-timeout] Starting acceptance timeout sweep every ${intervalSeconds}s`,
  );
  return setInterval(async () => {
    try {
      await runDeliveryAcceptanceTimeouts();
    } catch (err: any) {
      console.error('[delivery-timeout] Sweep error:', err.message);
    }
  }, intervalSeconds * 1000);
}

// ─── Supabase Edge Function handler (Deno-compatible) ─────────────────────────
export default async function handler(_req: Request): Promise<Response> {
  try {
    await runDeliveryAcceptanceTimeouts();
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[delivery-timeout] Fatal error:', err.message);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}