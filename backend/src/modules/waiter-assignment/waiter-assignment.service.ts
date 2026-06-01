import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WaiterWorkload {
  waiter_id: string;
  waiter_name: string;
  active_tables: number;
  active_orders: number;
  pending_serves: number; // order_items with status='ready' not yet served
  score: number;          // (active_tables × 3) + (active_orders × 1) + (pending_serves × 0.5)
}

// ---------------------------------------------------------------------------
// Cache key helpers
// ---------------------------------------------------------------------------

const workloadCacheKey = (branchId: string) => `waiter_workloads:${branchId}`;
const WORKLOAD_CACHE_TTL = 10; // 10 seconds — workloads change constantly

// ---------------------------------------------------------------------------
// Internal: get io instance lazily (avoids circular import at module load time)
// ---------------------------------------------------------------------------

async function getIo() {
  try {
    const { io } = await import('../../server');
    return io;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal: HTTP error factory matching the codebase pattern
// ---------------------------------------------------------------------------

function httpError(status: number, code: string, message: string): Error {
  return Object.assign(new Error(message), { status, code });
}

// ---------------------------------------------------------------------------
// getWaiterWorkloads
// Fetches all active waiters for a branch with their computed workload score.
// Uses a single efficient LEFT JOIN query.
// Results are cached for 10 seconds (very short TTL — workloads change often).
// ---------------------------------------------------------------------------

export async function getWaiterWorkloads(branchId: string): Promise<WaiterWorkload[]> {
  // 1. Try Redis cache
  try {
    const cached = await redis.get(workloadCacheKey(branchId));
    if (cached) return JSON.parse(cached) as WaiterWorkload[];
  } catch {
    // Cache miss — fall through to DB
  }

  // 2. Single aggregated query via Supabase's PostgREST
  //    NOTE: tables.assigned_waiter_id does not exist in the schema.
  //    active_tables is derived from orders with the waiter's ID that are
  //    linked to a currently occupied table (status = 'occupied').
  const { data: waiters, error: waitersErr } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .eq('role', 'waiter')
    .eq('branch_id', branchId)
    .eq('is_active', true);

  if (waitersErr) throw waitersErr;
  if (!waiters || waiters.length === 0) return [];

  const waiterIds = waiters.map((w: { id: string }) => w.id);

  // Active orders per waiter (confirmed / preparing / ready)
  const { data: activeOrders, error: ordersErr } = await supabaseAdmin
    .from('orders')
    .select('id, waiter_id, table_id, status')
    .eq('branch_id', branchId)
    .in('waiter_id', waiterIds)
    .in('status', ['confirmed', 'preparing', 'ready']);

  if (ordersErr) throw ordersErr;

  // Pending serves: order_items with status='ready' in those active orders
  const activeOrderIds = (activeOrders ?? []).map((o: { id: string }) => o.id);

  let pendingServesMap: Record<string, number> = {};

  if (activeOrderIds.length > 0) {
    const { data: readyItems, error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .select('order_id')
      .in('order_id', activeOrderIds)
      .eq('status', 'ready');

    if (itemsErr) throw itemsErr;

    // Map order_id → waiter_id from activeOrders
    const orderToWaiter: Record<string, string> = {};
    for (const o of activeOrders ?? []) {
      if (o.waiter_id) orderToWaiter[o.id] = o.waiter_id;
    }

    for (const item of readyItems ?? []) {
      const wid = orderToWaiter[item.order_id];
      if (wid) pendingServesMap[wid] = (pendingServesMap[wid] ?? 0) + 1;
    }
  }

  // active_tables: distinct occupied table_ids per waiter
  const activeTablesMap: Record<string, Set<string>> = {};
  for (const o of activeOrders ?? []) {
    if (!o.waiter_id || !o.table_id) continue;
    if (!activeTablesMap[o.waiter_id]) activeTablesMap[o.waiter_id] = new Set();
    activeTablesMap[o.waiter_id].add(o.table_id);
  }

  // active_orders count per waiter
  const activeOrdersCountMap: Record<string, number> = {};
  for (const o of activeOrders ?? []) {
    if (!o.waiter_id) continue;
    activeOrdersCountMap[o.waiter_id] = (activeOrdersCountMap[o.waiter_id] ?? 0) + 1;
  }

  // 3. Compute score for each waiter
  const workloads: WaiterWorkload[] = waiters.map((w: { id: string; name: string }) => {
    const active_tables = activeTablesMap[w.id]?.size ?? 0;
    const active_orders = activeOrdersCountMap[w.id] ?? 0;
    const pending_serves = pendingServesMap[w.id] ?? 0;

    // Score formula: (active_tables × 3) + (active_orders × 1) + (pending_serves × 0.5)
    const score = active_tables * 3 + active_orders * 1 + pending_serves * 0.5;

    return {
      waiter_id: w.id,
      waiter_name: w.name,
      active_tables,
      active_orders,
      pending_serves,
      score,
    };
  });

  // Sort by score ASC (lowest = least busy = best candidate)
  workloads.sort((a, b) => a.score - b.score);

  // 4. Cache with 10s TTL
  try {
    await redis.setex(workloadCacheKey(branchId), WORKLOAD_CACHE_TTL, JSON.stringify(workloads));
  } catch {
    // Cache write failure is non-fatal
  }

  return workloads;
}

// ---------------------------------------------------------------------------
// assignWaiterToTable
// Core auto-assignment function. Finds the lowest-score waiter and updates
// orders for the given table. Emits WebSocket events to the waiter and branch.
//
// NOTE: The tables schema has no assigned_waiter_id column.
//       Assignment is stored on orders.waiter_id. This function updates all
//       active (non-waiter-assigned) orders for the table.
// ---------------------------------------------------------------------------

export async function assignWaiterToTable(
  tableId: string,
  branchId: string,
  restaurantId: string,
): Promise<{ waiter_id: string; waiter_name: string } | null> {
  // 1. Get workloads (from 10s cache or fresh)
  const workloads = await getWaiterWorkloads(branchId);

  if (workloads.length === 0) {
    // No active waiters in this branch — table proceeds without assignment
    return null;
  }

  // 2. Pick the waiter with the lowest score (already sorted ASC)
  const chosen = workloads[0]!;

  // 3. Get table label for the WebSocket event payload
  const { data: table } = await supabaseAdmin
    .from('tables')
    .select('id, label, branch_id')
    .eq('id', tableId)
    .single();

  // 4. Update all unassigned active orders for this table
  const { error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({ waiter_id: chosen.waiter_id, updated_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .eq('branch_id', branchId)
    .is('waiter_id', null)
    .in('status', ['created', 'confirmed', 'preparing', 'ready']);

  if (updateErr) throw updateErr;

  // 5. Invalidate workload cache — scores are stale after assignment
  try {
    await redis.del(workloadCacheKey(branchId));
  } catch {
    // Cache bust failure is non-fatal
  }

  // 6. Emit WebSocket events
  try {
    const io = await getIo();
    if (io) {
      // 6a. Notify the specific waiter via their personal socket room
      //     The waiter client joins room 'waiter:{waiterId}' on login
      io.to(`waiter:${chosen.waiter_id}`).emit('table_assigned', {
        table_id: tableId,
        table_label: table?.label ?? null,
        branch_id: branchId,
        assigned_at: new Date().toISOString(),
      });

      // 6b. Broadcast table status update to the whole branch floor view
      io.to(`branch:${branchId}`).emit('table_status_changed', {
        table_id: tableId,
        branch_id: branchId,
        assigned_waiter_id: chosen.waiter_id,
        assigned_waiter_name: chosen.waiter_name,
      });
    }
  } catch {
    // WebSocket emission failure is non-fatal
  }

  return {
    waiter_id: chosen.waiter_id,
    waiter_name: chosen.waiter_name,
  };
}

// ---------------------------------------------------------------------------
// getWorkloadSummary
// Public-facing wrapper for manager dashboard. Returns the scored array.
// ---------------------------------------------------------------------------

export async function getWorkloadSummary(branchId: string): Promise<WaiterWorkload[]> {
  return getWaiterWorkloads(branchId);
}

// ---------------------------------------------------------------------------
// manuallyAssignWaiter
// Manager override — directly assigns a specific waiter to a table's orders.
// Verifies the waiter belongs to the branch before assigning.
// ---------------------------------------------------------------------------

export async function manuallyAssignWaiter(
  tableId: string,
  waiterId: string,
  branchId: string,
  restaurantId: string,
): Promise<void> {
  // 1. Verify waiterId is an active waiter in this branch
  const { data: waiter, error: waiterErr } = await supabaseAdmin
    .from('users')
    .select('id, name, role, is_active')
    .eq('id', waiterId)
    .eq('branch_id', branchId)
    .single();

  if (waiterErr?.code === 'PGRST116' || !waiter) {
    throw httpError(404, 'WAITER_NOT_FOUND', 'Waiter not found in this branch.');
  }
  if (waiterErr) throw waiterErr;

  if ((waiter as any).role !== 'waiter') {
    throw httpError(422, 'NOT_A_WAITER', `User ${waiterId} is not a waiter.`);
  }

  if (!(waiter as any).is_active) {
    throw httpError(422, 'WAITER_INACTIVE', 'Cannot assign an inactive waiter.');
  }

  // 2. Get table label for the event payload
  const { data: table } = await supabaseAdmin
    .from('tables')
    .select('id, label, branch_id')
    .eq('id', tableId)
    .eq('branch_id', branchId)
    .single();

  if (!table) {
    throw httpError(404, 'TABLE_NOT_FOUND', 'Table not found in this branch.');
  }

  // 3. Update all active orders for the table to this waiter
  const { error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({ waiter_id: waiterId, updated_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .eq('branch_id', branchId)
    .in('status', ['created', 'confirmed', 'preparing', 'ready']);

  if (updateErr) throw updateErr;

  // 4. Invalidate workload cache
  try {
    await redis.del(workloadCacheKey(branchId));
  } catch {
    // Non-fatal
  }

  // 5. Notify waiter via WebSocket
  try {
    const io = await getIo();
    if (io) {
      io.to(`waiter:${waiterId}`).emit('table_assigned', {
        table_id: tableId,
        table_label: (table as any).label ?? null,
        branch_id: branchId,
        assigned_by: 'manager',
        assigned_at: new Date().toISOString(),
      });

      io.to(`branch:${branchId}`).emit('table_status_changed', {
        table_id: tableId,
        branch_id: branchId,
        assigned_waiter_id: waiterId,
        assigned_waiter_name: (waiter as any).name,
      });
    }
  } catch {
    // Non-fatal
  }
}