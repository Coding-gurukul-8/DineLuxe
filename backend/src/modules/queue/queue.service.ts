import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import { parsePagination } from '../../utils/pagination';

// ─── Types ───────────────────────────────────────────────────────────────────

interface JoinQueueInput {
  branch_id: string;
  people_count: number;
  customer_name?: string;
  customer_phone?: string;
  user_id?: string;
}

// ─── Cache constants ──────────────────────────────────────────────────────────
const QUEUE_POSITION_TTL = 30;   // 30 s — queue state changes frequently
const AVG_TURN_TIME_TTL  = 300;  // 5 min — historical average is stable

const queuePositionCacheKey = (queueId: string)  => `queue_position:${queueId}`;
const avgTurnTimeCacheKey   = (branchId: string) => `avg_turn_time:${branchId}`;

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function bustQueuePositionCache(queueId: string): Promise<void> {
  try {
    await redis.del(queuePositionCacheKey(queueId));
  } catch {
    // Cache invalidation failure is non-fatal
  }
}

async function bustAvgTurnTimeCache(branchId: string): Promise<void> {
  try {
    await redis.del(avgTurnTimeCacheKey(branchId));
  } catch {
    // Cache invalidation failure is non-fatal
  }
}

// ─── Internal: get (or compute + cache) avg table turn time ──────────────────
// ✅ PATCH: Extracted into a cached helper — was recomputed inline on every call
async function getAvgTurnTime(branchId: string): Promise<number> {
  // 1. Try cache
  try {
    const cached = await redis.get(avgTurnTimeCacheKey(branchId));
    if (cached) return Number(cached);
  } catch {
    // Fall through to DB
  }

  // 2. Compute from DB
  const { data: recentBookings } = await supabaseAdmin
    .from('bookings')
    .select('seated_at, completed_at')
    .eq('branch_id', branchId)
    .eq('status', 'completed')
    .not('seated_at', 'is', null)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(10);

  let avgTurnTimeMinutes = 45; // sensible default
  if (recentBookings && recentBookings.length > 0) {
    const totalMs = recentBookings.reduce((acc, b) => {
      const diff =
        new Date(b.completed_at).getTime() - new Date(b.seated_at).getTime();
      return acc + (diff > 0 ? diff : 0);
    }, 0);
    const computed = Math.round(totalMs / recentBookings.length / 60000);
    if (computed > 0) avgTurnTimeMinutes = computed;
  }

  // 3. Cache the result
  try {
    await redis.setex(avgTurnTimeCacheKey(branchId), AVG_TURN_TIME_TTL, String(avgTurnTimeMinutes));
  } catch {
    // Cache write failure is non-fatal
  }

  return avgTurnTimeMinutes;
}

// ─── Broadcast helper (REST-based, works without a persistent WS connection) ──

async function broadcastToChannel(channel: string, event: string, payload: object) {
  await supabaseAdmin
    .channel(channel)
    .send({ type: 'broadcast', event, payload })
    .catch((err: Error) => {
      console.warn(`[queue] broadcast failed on ${channel}:`, err.message);
    });
}

// ─── Join queue ───────────────────────────────────────────────────────────────

export async function joinQueue(input: JoinQueueInput) {
  if (!Number.isInteger(input.people_count) || input.people_count < 1) {
    throw Object.assign(new Error('people_count must be a positive integer'), { statusCode: 400 });
  }

  const { data: lastEntry } = await supabaseAdmin
    .from('queue_entries')
    .select('position')
    .eq('branch_id', input.branch_id)
    .in('status', ['waiting', 'arrived'])
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (lastEntry?.position ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from('queue_entries')
    .insert({
      branch_id: input.branch_id,
      user_id: input.user_id ?? null,
      people_count: input.people_count,
      guest_name: input.customer_name ?? null,
      guest_phone: input.customer_phone ?? null,
      position: nextPosition,
      status: 'waiting',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  await broadcastToChannel(`branch:${input.branch_id}`, 'queue_updated', {
    action: 'joined',
    queue_id: data.id,
    position: nextPosition,
  });

  return data;
}

// ─── Get full queue for branch ────────────────────────────────────────────────

export async function getBranchQueue(branchId: string, query: Record<string, string>) {
  const { page, limit, offset } = parsePagination(query);

  const { data, error, count } = await supabaseAdmin
    .from('queue_entries')
    .select('*, users(name, phone)', { count: 'exact' })
    .eq('branch_id', branchId)
    .in('status', ['waiting', 'arrived'])
    .order('position', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { data, total: count ?? 0, page, limit };
}

// ─── Get position + ETA ───────────────────────────────────────────────────────
// ✅ PATCH: Full result cached + avg turn time moved to a separate cached helper
//           DB queries parallelised with Promise.all (was sequential)
export async function getQueuePosition(queueId: string) {
  // 1. Try position cache
  try {
    const cached = await redis.get(queuePositionCacheKey(queueId));
    if (cached) return JSON.parse(cached);
  } catch {
    // Fall through to DB
  }

  // 2. Fetch queue entry
  const { data: entry } = await supabaseAdmin
    .from('queue_entries')
    .select('*')
    .eq('id', queueId)
    .single();

  if (!entry) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });

  // 3. Run DB queries in parallel (was 3 sequential round-trips + avg_turn_time)
  const [{ count: entriesAhead }, { count: freeTables }, avgTurnTimeMinutes] = await Promise.all([
    supabaseAdmin
      .from('queue_entries')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', entry.branch_id)
      .in('status', ['waiting', 'arrived'])
      .lt('position', entry.position),
    supabaseAdmin
      .from('tables')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', entry.branch_id)
      .eq('status', 'free'),
    getAvgTurnTime(entry.branch_id),  // uses 5-min cache
  ]);

  const netAhead = Math.max(0, (entriesAhead ?? 0) - (freeTables ?? 0));
  const estimatedWaitMinutes = netAhead * avgTurnTimeMinutes;

  const result = {
    queue_id: queueId,
    position: entry.position,
    status: entry.status,
    people_count: entry.people_count,
    entries_ahead: entriesAhead ?? 0,
    free_tables: freeTables ?? 0,
    estimated_wait_minutes: estimatedWaitMinutes,
    avg_turn_time_minutes: avgTurnTimeMinutes,
  };

  // 4. Cache result (short TTL — queue changes frequently)
  try {
    await redis.setex(queuePositionCacheKey(queueId), QUEUE_POSITION_TTL, JSON.stringify(result));
  } catch {
    // Cache write failure is non-fatal
  }

  return result;
}

// ─── Mark arrived ─────────────────────────────────────────────────────────────

export async function markQueueArrived(queueId: string) {
  const { data: existing } = await supabaseAdmin
    .from('queue_entries')
    .select('id, status')
    .eq('id', queueId)
    .single();

  if (!existing) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });
  if (existing.status === 'arrived') {
    throw Object.assign(new Error('Customer already marked as arrived'), { statusCode: 409 });
  }
  if (!['waiting'].includes(existing.status)) {
    throw Object.assign(
      new Error(`Cannot mark arrived from status "${existing.status}"`),
      { statusCode: 422 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('queue_entries')
    .update({ status: 'arrived', arrived_at: new Date().toISOString() })
    .eq('id', queueId)
    .select()
    .single();

  if (error) throw error;

  // ✅ PATCH: Bust position cache so next poll reflects 'arrived' status
  await bustQueuePositionCache(queueId);

  return data;
}

// ─── Assign table ─────────────────────────────────────────────────────────────

export async function assignTable(queueId: string, tableId: string, hostId: string) {
  const { data: entry } = await supabaseAdmin
    .from('queue_entries')
    .select('*')
    .eq('id', queueId)
    .single();

  if (!entry) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });
  if (entry.status === 'seated') throw Object.assign(new Error('Customer already seated'), { statusCode: 409 });

  if (!['waiting', 'arrived'].includes(entry.status)) {
    throw Object.assign(
      new Error(`Cannot assign table to a queue entry with status "${entry.status}"`),
      { statusCode: 422 },
    );
  }

  const { data: table } = await supabaseAdmin
    .from('tables')
    .select('id, status, capacity')
    .eq('id', tableId)
    .single();

  if (!table) throw Object.assign(new Error('Table not found'), { statusCode: 404 });
  if (table.status !== 'free') throw Object.assign(new Error(`Table is currently ${table.status}`), { statusCode: 409 });
  if (table.capacity < entry.people_count) throw Object.assign(new Error('Table capacity too small'), { statusCode: 422 });

  // 1. Mark queue entry as seated
  const { data: updatedEntry, error: qErr } = await supabaseAdmin
    .from('queue_entries')
    .update({ status: 'seated', seated_at: new Date().toISOString() })
    .eq('id', queueId)
    .select()
    .single();

  if (qErr) throw qErr;

  // 2. Mark table as occupied
  const { error: tErr } = await supabaseAdmin
    .from('tables')
    .update({ status: 'occupied' })
    .eq('id', tableId);

  if (tErr) {
    await supabaseAdmin
      .from('queue_entries')
      .update({ status: 'arrived', seated_at: null })
      .eq('id', queueId);
    throw tErr;
  }

  // 3. Create a booking from the queue entry
  const now = new Date();
  const futureArrival = new Date(now.getTime() + 15 * 60000);
  const { data: booking, error: bErr } = await supabaseAdmin
    .from('bookings')
    .insert({
      user_id: entry.user_id ?? hostId,
      branch_id: entry.branch_id,
      table_id: tableId,
      people_count: entry.people_count,
      arrival_time: futureArrival.toISOString(),
      status: 'seated',
      source: 'walk_in',
      special_requests: `Queue entry: ${entry.guest_name || 'Walk-in'}`,
    })
    .select()
    .single();

  if (bErr) {
    await supabaseAdmin
      .from('queue_entries')
      .update({ status: 'arrived', seated_at: null })
      .eq('id', queueId);
    await supabaseAdmin
      .from('tables')
      .update({ status: 'free' })
      .eq('id', tableId);
    throw bErr;
  }

  await recalculatePositions(entry.branch_id);

  // ✅ PATCH: Bust position cache + avg turn time so next booking factors in
  await Promise.all([
    bustQueuePositionCache(queueId),
    bustAvgTurnTimeCache(entry.branch_id),
  ]);

  await broadcastToChannel(`branch:${entry.branch_id}`, 'queue_updated', {
    action: 'seated',
    queue_id: queueId,
    table_id: tableId,
    booking_id: booking.id,
  });

  return {
    queue_id: queueId,
    table_id: tableId,
    booking_id: booking.id,
    status: 'seated',
  };
}

// ─── Mark no-show ─────────────────────────────────────────────────────────────

export async function markQueueNoShow(queueId: string) {
  const { data: entry } = await supabaseAdmin
    .from('queue_entries')
    .select('*')
    .eq('id', queueId)
    .single();

  if (!entry) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });

  const { data, error } = await supabaseAdmin
    .from('queue_entries')
    .update({ status: 'no_show' })
    .eq('id', queueId)
    .select()
    .single();

  if (error) throw error;

  await recalculatePositions(entry.branch_id);

  // ✅ PATCH: Bust position cache for this entry
  await bustQueuePositionCache(queueId);

  await broadcastToChannel(`branch:${entry.branch_id}`, 'queue_updated', {
    action: 'no_show',
    queue_id: queueId,
  });

  return data;
}

// ─── Remove from queue ────────────────────────────────────────────────────────

export async function removeFromQueue(queueId: string) {
  const { data: entry } = await supabaseAdmin
    .from('queue_entries')
    .select('branch_id, status')
    .eq('id', queueId)
    .single();

  if (!entry) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });

  if (['seated', 'no_show', 'cancelled'].includes(entry.status)) {
    throw Object.assign(
      new Error(`Queue entry is already "${entry.status}" — cannot remove again`),
      { statusCode: 409 },
    );
  }

  const { error } = await supabaseAdmin
    .from('queue_entries')
    .update({ status: 'cancelled' })
    .eq('id', queueId);

  if (error) throw error;

  await recalculatePositions(entry.branch_id);

  // ✅ PATCH: Bust position cache for this entry
  await bustQueuePositionCache(queueId);

  await broadcastToChannel(`branch:${entry.branch_id}`, 'queue_updated', {
    action: 'removed',
    queue_id: queueId,
  });

  return { removed: true };
}

// ─── Recalculate queue positions (no gaps) ────────────────────────────────────

async function recalculatePositions(branchId: string) {
  const { data: activeQueue } = await supabaseAdmin
    .from('queue_entries')
    .select('id')
    .eq('branch_id', branchId)
    .in('status', ['waiting', 'arrived'])
    .order('position', { ascending: true });

  if (!activeQueue || activeQueue.length === 0) return;

  const upsertPayload = activeQueue.map((entry, idx) => ({
    id: entry.id,
    position: idx + 1,
  }));

  const { error } = await supabaseAdmin
    .from('queue_entries')
    .upsert(upsertPayload, { onConflict: 'id' });

  if (error) {
    console.warn('[queue] recalculatePositions upsert failed:', error.message);
  }

  // ✅ PATCH: Bust all affected entries' position caches after reorder
  await Promise.all(
    activeQueue.map((entry) => bustQueuePositionCache(entry.id))
  );
}