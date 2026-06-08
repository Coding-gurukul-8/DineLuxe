import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import { io } from '../../server';

// ─── callWaiter ───────────────────────────────────────────────────────────────
// Called when a customer taps "Call Waiter" on the dine-in app view.
// 1. Verifies an active order exists for this customer on the table.
// 2. Enforces a 2-minute spam cooldown via Redis.
// 3. Emits 'customer_call_waiter' via Socket.IO to the assigned waiter's
//    personal socket, the branch waiter room (as backup), and the manager room.

export async function callWaiter(
  tableId: string,
  branchId: string,
  customerId: string
): Promise<void> {
  // 1. Verify there is an active order on this table for this customer
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('id, waiter_id, tables(label)')
    .eq('table_id', tableId)
    .eq('customer_id', customerId)
    .not('status', 'in', '(paid,cancelled,closed)')
    .limit(1)
    .maybeSingle();

  if (orderErr) throw orderErr;

  if (!order) {
    throw Object.assign(
      new Error('No active order found for this table'),
      { statusCode: 400 }
    );
  }

  // 2. Spam / cooldown check — 2 min window per table+customer combo
  const spamKey = `call_waiter:${tableId}:${customerId}`;
  let existing: string | null = null;
  try {
    existing = await redis.get(spamKey);
  } catch {
    // Redis unavailable — skip spam check (fail open)
  }

  if (existing) {
    throw Object.assign(
      new Error('Please wait before calling again'),
      { statusCode: 429 }
    );
  }

  // 3. Set cooldown BEFORE emitting (avoids race conditions)
  try {
    await redis.set(spamKey, '1', 'EX', 120); // 2-minute cooldown
  } catch {
    // Non-fatal — continue even if Redis write fails
  }

  // 4. Resolve table label
  const tableLabel =
    (order as any).tables?.label ?? tableId;

  const eventData = {
    table_id: tableId,
    table_label: tableLabel,
    branch_id: branchId,
    order_id: order.id,
    called_at: new Date().toISOString(),
    message: `Table ${tableLabel} needs assistance`,
  };

  // 5. Emit via Socket.IO
  try {
    if (order.waiter_id) {
      // Emit directly to the assigned waiter's socket
      const waiterSocketId = await redis.get(`socket:${order.waiter_id}`).catch(() => null);
      if (waiterSocketId) {
        io.to(waiterSocketId).emit('customer_call_waiter', eventData);
      }
      // Also broadcast to the waiter room as a backup
      io.to(`branch:${branchId}:waiters`).emit('customer_call_waiter', eventData);
    } else {
      // No assigned waiter — broadcast to all waiters at this branch
      io.to(`branch:${branchId}:waiters`).emit('customer_call_waiter', eventData);
    }

    // Always alert the manager room
    io.to(`branch:${branchId}:manager`).emit('customer_call_waiter', eventData);
  } catch (emitErr: any) {
    console.warn('[waiter-call] Socket.IO emit failed (non-fatal):', emitErr?.message);
  }

  // 6. Also emit via Supabase Realtime as a secondary channel (existing
  //    useWaiterCall hook listens on this)
  try {
    await supabaseAdmin.channel(`branch:${branchId}`).send({
      type: 'broadcast',
      event: 'customer_call_waiter',
      payload: eventData,
    });
  } catch (broadcastErr: any) {
    console.warn('[waiter-call] Supabase broadcast failed (non-fatal):', broadcastErr?.message);
  }
}

// ─── acknowledgeWaiterCall ────────────────────────────────────────────────────
// Called when a waiter taps "On My Way" on the alert banner.
// Emits 'waiter_acknowledged' to the table's socket room so the customer app
// can show a confirmation toast.

export async function acknowledgeWaiterCall(
  tableId: string,
  waiterId: string
): Promise<void> {
  // Fetch waiter name for the customer-facing message
  const { data: waiter } = await supabaseAdmin
    .from('users')
    .select('first_name')
    .eq('id', waiterId)
    .maybeSingle();

  const waiterName = (waiter as any)?.first_name ?? 'Your waiter';

  try {
    io.to(`table:${tableId}`).emit('waiter_acknowledged', {
      waiter_name: waiterName,
      table_id: tableId,
      acknowledged_at: new Date().toISOString(),
    });
  } catch (emitErr: any) {
    console.warn('[waiter-call] acknowledge emit failed (non-fatal):', emitErr?.message);
  }

  // Log acknowledgment
  console.log(`[waiter-call] Waiter ${waiterId} acknowledged call for table ${tableId}`);
}