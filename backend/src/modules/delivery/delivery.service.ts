import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import { io } from '../../server';
import { calculateDistance } from '../../utils/haversine';
import { buildPaginationMeta } from '../../utils/pagination';

const ACCEPTANCE_TIMEOUT_SECONDS = 30;
const LOCATION_THROTTLE_SECONDS = 5;

// Earnings formula: base ₹30 + ₹5 per km
const EARNINGS_BASE_INR = Number(process.env['DELIVERY_EARNINGS_BASE'] ?? 30);
const EARNINGS_PER_KM_INR = Number(process.env['DELIVERY_EARNINGS_PER_KM'] ?? 5);

// ─── Auto-Reassign on Decline / Rejection ────────────────────────────────────
/**
 * Finds the nearest available delivery partner (excluding the one who
 * failed/rejected), creates a new assignment record, and notifies the
 * new partner via Socket.io.
 *
 * If no partners are available a 'delivery_no_partner' alert is emitted to
 * the manager room instead.
 */
async function autoReassignDelivery(
  deliveryId: string,
  failedPartnerId: string,
  orderId: string,
): Promise<void> {
  try {
    // 1. Get the order's branch so we can scope partner search by branch
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, branch_id, branches(lat, lon)')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      console.error('[delivery] autoReassign: failed to fetch order', orderErr?.message);
      return;
    }

    const branchId = order.branch_id as string;
    const branch = order.branches as { lat: number | null; lon: number | null } | null;
    const restaurantLat = branch?.lat ?? null;
    const restaurantLon = branch?.lon ?? null;

    // 2. Find available partners scoped to this branch via users.branch_id join.
    //    delivery_partners has no branch_id of its own — branch is on the user record.
    const { data: partners, error: partnersErr } = await supabaseAdmin
      .from('delivery_partners')
      .select('id, current_lat, current_lon, users!inner(branch_id)')
      .eq('is_online', true)
      .is('active_delivery_id', null)
      .neq('id', failedPartnerId)
      .eq('users.branch_id', branchId);

    if (partnersErr) {
      console.error('[delivery] autoReassign: partner query failed', partnersErr.message);
      return;
    }

    if (!partners || partners.length === 0) {
      // No available partners — alert the manager room via Socket.io
      io.to(`branch:${branchId}:manager`).emit('delivery_no_partner', {
        delivery_id: deliveryId,
        order_id: orderId,
        message: 'No available delivery partners for reassignment',
      });
      console.warn(`[delivery] autoReassign: no partners available for delivery ${deliveryId}`);
      return;
    }

    // 3. Sort by distance to the restaurant/branch using haversine.
    //    If the branch coordinates are unknown, fall back to rating/availability order.
    let nextPartner: (typeof partners)[0];

    if (restaurantLat !== null && restaurantLon !== null) {
      const withDistance = partners.map((p) => ({
        ...p,
        distMetres:
          p.current_lat !== null && p.current_lon !== null
            ? calculateDistance(
                restaurantLat,
                restaurantLon,
                Number(p.current_lat),
                Number(p.current_lon),
              )
            : Infinity,
      }));
      withDistance.sort((a, b) => a.distMetres - b.distMetres);
      nextPartner = withDistance[0];
    } else {
      nextPartner = partners[0];
    }

    // 4. Update the existing delivery_assignment to point to the new partner
    //    and reset its status back to 'assigned'.
    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from('delivery_assignments')
      .update({
        partner_id: nextPartner.id,
        status: 'assigned',
        accepted_at: null,
        picked_up_at: null,
      })
      .eq('id', deliveryId);

    if (updateErr) {
      console.error('[delivery] autoReassign: failed to update assignment', updateErr.message);
      return;
    }

    // 5. Mark new partner as busy
    await supabaseAdmin
      .from('delivery_partners')
      .update({ active_delivery_id: deliveryId })
      .eq('id', nextPartner.id);

    // 6. Arm a fresh 30-second acceptance timeout for the new partner
    const deadline = Math.floor(Date.now() / 1000) + ACCEPTANCE_TIMEOUT_SECONDS;
    await redis.zadd('delivery_acceptance_timeouts', deadline, deliveryId);
    const acceptanceKey = `delivery_acceptance:${deliveryId}:${nextPartner.id}`;
    await redis.setex(acceptanceKey, ACCEPTANCE_TIMEOUT_SECONDS, '1');

    // 7. Notify the new partner via Socket.io
    io.to(`partner:${nextPartner.id}`).emit('new_delivery_request', {
      delivery_id: deliveryId,
      order_id: orderId,
      assigned_at: now,
    });

    console.log(
      `[delivery] autoReassign: delivery ${deliveryId} reassigned to partner ${nextPartner.id}`,
    );
  } catch (err: any) {
    // Auto-reassignment must never crash the main update flow
    console.error('[delivery] autoReassign: unexpected error', err.message);
  }
}

// ─── Assign Delivery Partner ──────────────────────────────────────────────────

export async function assignDelivery(
  orderId: string,
  branchId: string,
  restaurantId: string,
  partnerId: string,
) {
  // Verify order exists and needs delivery
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('id, status, order_type, branch_id')
    .eq('id', orderId)
    .eq('branch_id', branchId)
    .single();

  if (orderErr || !order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.order_type !== 'delivery') {
    throw Object.assign(new Error('Order is not a delivery order'), { status: 422 });
  }

  // Validate provided partner is available for this branch and online
  const { data: partner, error: partnerErr } = await supabaseAdmin
    .from('delivery_partners')
    .select('id, is_online, active_delivery_id, users!inner(branch_id)')
    .eq('id', partnerId)
    .single();

  if (partnerErr || !partner) throw Object.assign(new Error('Delivery partner not found'), { status: 400 });

  const partnerBranchId = (partner.users as any)?.branch_id;
  if (partnerBranchId !== branchId) {
    throw Object.assign(new Error('Delivery partner does not belong to this branch'), { status: 400 });
  }
  if (partner.is_online !== true) {
    throw Object.assign(new Error('Delivery partner is not online'), { status: 400 });
  }
  if (partner.active_delivery_id !== null) {
    throw Object.assign(new Error('Delivery partner already has an active delivery'), { status: 400 });
  }

  // Create delivery assignment record
  const { data: delivery, error: deliveryErr } = await supabaseAdmin
    .from('delivery_assignments')
    .insert({
      order_id: orderId,
      partner_id: partner.id,
      status: 'assigned',
      pickup_address: '',   // caller should pass address; kept empty as placeholder
      delivery_address: '', // same
    })
    .select()
    .single();

  if (deliveryErr || !delivery) throw deliveryErr ?? new Error('Failed to create delivery assignment');

  // Mark partner as having an active delivery
  await supabaseAdmin
    .from('delivery_partners')
    .update({ active_delivery_id: delivery.id })
    .eq('id', partner.id);

  // Arm 30-second acceptance timeout:
  //   • Redis sorted set tracks the deadline (for the polling-based checker)
  //   • A per-delivery Redis key lets the acceptance timeout job verify the
  //     partner hasn't already accepted before acting
  const deadline = Math.floor(Date.now() / 1000) + ACCEPTANCE_TIMEOUT_SECONDS;
  await redis.zadd('delivery_acceptance_timeouts', deadline, delivery.id);
  const acceptanceKey = `delivery_acceptance:${delivery.id}:${partner.id}`;
  await redis.setex(acceptanceKey, ACCEPTANCE_TIMEOUT_SECONDS, '1');

  // Schedule in-process delayed callback as belt-and-suspenders for the
  // standalone timeout job (handles the case where the job runner isn't running)
  setTimeout(async () => {
    try {
      await runAcceptanceTimeoutForDelivery(delivery.id, partner.id);
    } catch (e: any) {
      console.error('[delivery] acceptance timeout callback failed:', e.message);
    }
  }, ACCEPTANCE_TIMEOUT_SECONDS * 1000);

  // Notify partner immediately
  io.to(`partner:${partner.id}`).emit('new_delivery_request', {
    delivery_id: delivery.id,
    order_id: orderId,
    timeout_seconds: ACCEPTANCE_TIMEOUT_SECONDS,
  });

  return delivery;
}

// ─── Get Delivery ─────────────────────────────────────────────────────────────

export async function getDelivery(deliveryId: string, partnerId: string) {
  const { data, error } = await supabaseAdmin
    .from('delivery_assignments')
    .select(
      '*, orders(*, order_items(*, menu_items(name))), ' +
      'orders!inner(branches(name, address, lat, lon))',
    )
    .eq('id', deliveryId)
    .eq('partner_id', partnerId)
    .single();

  if (error || !data) throw Object.assign(new Error('Delivery not found'), { status: 404 });
  return data;
}

// ─── Update Delivery Status ───────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  assigned:  ['accepted', 'rejected'],
  accepted:  ['picked_up'],
  picked_up: ['delivered', 'failed'],
  delivered: [],
  failed:    [],
  rejected:  [],
};

export async function updateDeliveryStatus(
  deliveryId: string,
  partnerId: string,
  newStatus: string,
) {
  const { data: delivery, error: fetchErr } = await supabaseAdmin
    .from('delivery_assignments')
    .select('*, orders(id, branch_id, restaurant_id, customer_id)')
    .eq('id', deliveryId)
    .eq('partner_id', partnerId)
    .single();

  if (fetchErr || !delivery) throw Object.assign(new Error('Delivery not found'), { status: 404 });

  const allowed = VALID_TRANSITIONS[delivery.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw Object.assign(
      new Error(`Invalid transition: ${delivery.status} → ${newStatus}`),
      { status: 400 },
    );
  }

  const updatePayload: Record<string, unknown> = { status: newStatus };
  const now = new Date().toISOString();

  if (newStatus === 'accepted')  updatePayload.accepted_at  = now;
  if (newStatus === 'picked_up') updatePayload.picked_up_at = now;
  if (newStatus === 'delivered') updatePayload.delivered_at = now;

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('delivery_assignments')
    .update(updatePayload)
    .eq('id', deliveryId)
    .select()
    .single();

  if (updateErr) throw updateErr;

  const order = delivery.orders as {
    id: string;
    branch_id: string;
    restaurant_id: string;
    customer_id: string;
  };

  // ── Accepted: remove from acceptance timeout tracking ─────────────────────
  if (newStatus === 'accepted') {
    await redis.zrem('delivery_acceptance_timeouts', deliveryId);
    await redis.del(`delivery_acceptance:${deliveryId}:${partnerId}`);
  }

  // ── Delivered ─────────────────────────────────────────────────────────────
  if (newStatus === 'delivered') {
    await supabaseAdmin
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', order.id);

    await supabaseAdmin
      .from('delivery_partners')
      .update({ active_delivery_id: null })
      .eq('id', partnerId);

    // Notify customer and manager via Socket.io
    io.to(`order:${order.id}`).emit('delivery_complete', {
      delivery_id: deliveryId,
      order_id: order.id,
      branch_id: order.branch_id,
      delivered_at: now,
    });
    io.to(`branch:${order.branch_id}:manager`).emit('delivery_complete', {
      delivery_id: deliveryId,
      order_id: order.id,
      branch_id: order.branch_id,
      delivered_at: now,
    });

    // Supabase Realtime broadcast (belt-and-suspenders for non-Socket.io clients)
    supabaseAdmin.channel(`delivery:${deliveryId}`).send({
      type: 'broadcast',
      event: 'delivery_complete',
      payload: {
        delivery_id: deliveryId,
        order_id: order.id,
        branch_id: order.branch_id,
        delivered_at: now,
      },
    }).catch((e: Error) => console.warn('[delivery] Realtime broadcast failed:', e.message));

    console.log(`[delivery] TODO: trigger payment release and rating request for order ${order.id}`);
  }

  // ── Rejected or Failed: clear partner and auto-reassign ───────────────────
  if (newStatus === 'rejected' || newStatus === 'failed') {
    // Free up the partner immediately
    await supabaseAdmin
      .from('delivery_partners')
      .update({ active_delivery_id: null })
      .eq('id', partnerId);

    // Remove from timeout set (rejection is explicit — no timeout needed)
    await redis.zrem('delivery_acceptance_timeouts', deliveryId);
    await redis.del(`delivery_acceptance:${deliveryId}:${partnerId}`);

    // Auto-reassign to the next nearest available partner
    await autoReassignDelivery(deliveryId, partnerId, order.id);
  }

  // ── Realtime status update broadcast ──────────────────────────────────────
  io.to(`order:${order.id}`).emit('delivery_status_updated', {
    delivery_id: deliveryId,
    status: newStatus,
    branch_id: order.branch_id,
    updated_at: now,
  });

  supabaseAdmin.channel(`delivery:${deliveryId}`).send({
    type: 'broadcast',
    event: 'status_updated',
    payload: {
      delivery_id: deliveryId,
      status: newStatus,
      branch_id: order.branch_id,
      updated_at: now,
    },
  }).catch((e: Error) => console.warn('[delivery] status broadcast failed:', e.message));

  return updated;
}

// ─── Update Partner Online/Offline Status ────────────────────────────────────
/**
 * FIX 2: Toggle a delivery partner's online/offline availability.
 * Emits 'partner_status_changed' to the branch manager room via Socket.io.
 */
export async function updatePartnerOnlineStatus(partnerId: string, isOnline: boolean) {
  // Fetch partner's branch via the users join
  const { data: partner, error: fetchErr } = await supabaseAdmin
    .from('delivery_partners')
    .select('id, is_online, active_delivery_id, users!inner(branch_id)')
    .eq('id', partnerId)
    .single();

  if (fetchErr || !partner) {
    throw Object.assign(new Error('Delivery partner not found'), { status: 404 });
  }

  // Going offline while carrying an active delivery is not allowed
  if (!isOnline && partner.active_delivery_id !== null) {
    throw Object.assign(
      new Error('Cannot go offline while you have an active delivery in progress'),
      { status: 409 },
    );
  }

  const { error: updateErr } = await supabaseAdmin
    .from('delivery_partners')
    .update({ is_online: isOnline })
    .eq('id', partnerId);

  if (updateErr) throw updateErr;

  const branchId = (partner.users as any)?.branch_id as string | undefined;

  // Notify branch manager room
  if (branchId) {
    io.to(`branch:${branchId}:manager`).emit('partner_status_changed', {
      partner_id: partnerId,
      is_online: isOnline,
      branch_id: branchId,
    });
  }

  return { partner_id: partnerId, is_online: isOnline };
}

// ─── Update Partner Location ──────────────────────────────────────────────────

export async function updatePartnerLocation(
  partnerId: string,
  lat: number,
  lon: number,
  deliveryId?: string,
) {
  // Throttle to 1 update per 5s per partner
  const throttleKey = `loc_throttle:${partnerId}`;
  const isThrottled = await redis.exists(throttleKey);

  if (isThrottled) {
    return { throttled: true, retry_after_seconds: LOCATION_THROTTLE_SECONDS };
  }

  await redis.setex(throttleKey, LOCATION_THROTTLE_SECONDS, '1');

  const { error } = await supabaseAdmin
    .from('delivery_partners')
    .update({ current_lat: lat, current_lon: lon })
    .eq('id', partnerId);

  if (error) throw error;

  if (deliveryId) {
    io.to(`order:${deliveryId}`).emit('partner_location_updated', {
      partner_id: partnerId,
      lat,
      lon,
      delivery_id: deliveryId,
    });

    // Also broadcast via Supabase Realtime for non-Socket.io subscribers
    supabaseAdmin.channel(`delivery:${deliveryId}`).send({
      type: 'broadcast',
      event: 'location_update',
      payload: { partner_id: partnerId, lat, lon, delivery_id: deliveryId },
    }).catch((e: Error) => console.warn('[delivery] location broadcast failed:', e.message));
  }

  return { updated: true, lat, lon };
}

// ─── Get Active Delivery for Partner ─────────────────────────────────────────

export async function getActiveDelivery(partnerId: string) {
  const { data, error } = await supabaseAdmin
    .from('delivery_assignments')
    .select('*, orders(*, tables(label)), orders!inner(branches(name, address))')
    .eq('partner_id', partnerId)
    .in('status', ['assigned', 'accepted', 'picked_up'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ─── Get Delivery Status (with partner info) ──────────────────────────────────

export async function getDeliveryStatus(deliveryId: string) {
  const { data, error } = await supabaseAdmin
    .from('delivery_assignments')
    .select(
      '*, orders(id, status, total_amount, order_type), ' +
      'delivery_partners(id, is_online, current_lat, current_lon, active_delivery_id)',
    )
    .eq('id', deliveryId)
    .single();

  if (error || !data) throw Object.assign(new Error('Delivery not found'), { status: 404 });
  return data;
}

// ─── Get Active Deliveries for Branch ────────────────────────────────────────

export async function getActiveDeliveriesForBranch(branchId: string) {
  const { data, error } = await supabaseAdmin
    .from('delivery_assignments')
    .select(
      '*, orders!inner(id, status, total_amount, customer_id, branch_id), ' +
      'delivery_partners(id, current_lat, current_lon)',
    )
    .eq('orders.branch_id', branchId)
    .in('status', ['assigned', 'accepted', 'picked_up'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ─── Complete Delivery ────────────────────────────────────────────────────────

export async function completeDelivery(deliveryId: string) {
  const { data: delivery, error: fetchErr } = await supabaseAdmin
    .from('delivery_assignments')
    .select('id, partner_id, status, orders(id)')
    .eq('id', deliveryId)
    .single();

  if (fetchErr || !delivery) throw Object.assign(new Error('Delivery not found'), { status: 404 });

  if (delivery.status === 'delivered') {
    throw Object.assign(new Error('Delivery already completed'), { status: 409 });
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('delivery_assignments')
    .update({ status: 'delivered', delivered_at: now })
    .eq('id', deliveryId)
    .select()
    .single();

  if (updateErr) throw updateErr;

  await supabaseAdmin
    .from('delivery_partners')
    .update({ active_delivery_id: null })
    .eq('id', delivery.partner_id);

  const order = (delivery.orders as { id: string }[] | null)?.[0] ?? null;
  if (order?.id) {
    await supabaseAdmin
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', order.id);
  }

  return updated;
}

// ─── Get Partner Earnings ─────────────────────────────────────────────────────

export async function getPartnerEarnings(partnerId: string) {
  const { data, error } = await supabaseAdmin
    .from('delivery_assignments')
    .select('id, delivered_at, earning')
    .eq('partner_id', partnerId)
    .eq('status', 'delivered')
    .order('delivered_at', { ascending: false });

  if (error) throw error;

  const total = (data ?? []).reduce(
    (acc: number, d: any) => acc + (Number(d.earning) || 0),
    0,
  );

  return { deliveries: data ?? [], total_earnings: total };
}

// ─── FIX 3: Delivery Partner History ─────────────────────────────────────────
/**
 * Returns paginated delivery history for a partner with per-row earnings
 * calculated as: ₹DELIVERY_EARNINGS_BASE + (distance_km × ₹DELIVERY_EARNINGS_PER_KM).
 *
 * Note: delivery_assignments has no completed_at column — we use delivered_at.
 *       distance is derived from haversine between branch and delivery coords
 *       since there is no distance_km column in the schema.
 */
export async function getPartnerHistory(
  partnerId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;

  // Fetch assignments for this partner (all terminal + active statuses)
  const { data: assignments, error: assignErr } = await supabaseAdmin
    .from('delivery_assignments')
    .select(
      'id, created_at, delivered_at, status, ' +
      'delivery_lat, delivery_lon, earning, ' +
      'orders!inner(id, order_type, branch_id, customer_id, ' +
      '  branches(name, address, lat, lon), ' +
      '  customer:users(name))',
    )
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });

  if (assignErr) throw assignErr;

  const all = assignments ?? [];
  const total = all.length;
  const paginated = all.slice(offset, offset + limit);

  const deliveries = paginated.map((da: any) => {
    const order = da.orders ?? {};
    const branch = order.branches ?? {};
    const completedAt: string | null = da.delivered_at ?? null;
    const createdAt: string = da.created_at;

    // Duration in minutes from created_at to delivered_at (or now if in progress)
    const endMs = completedAt ? new Date(completedAt).getTime() : Date.now();
    const durationMinutes = Math.round((endMs - new Date(createdAt).getTime()) / 60_000);

    // Earnings: use stored value if present, else compute from distance
    let earnings: number;
    if (da.earning !== null && da.earning !== undefined) {
      earnings = Number(da.earning);
    } else {
      // Estimate distance in km from branch → delivery coordinates
      let distKm = 0;
      if (
        branch.lat != null && branch.lon != null &&
        da.delivery_lat != null && da.delivery_lon != null
      ) {
        distKm = calculateDistance(
          Number(branch.lat),
          Number(branch.lon),
          Number(da.delivery_lat),
          Number(da.delivery_lon),
        ) / 1000;
      }
      earnings = Math.round((EARNINGS_BASE_INR + distKm * EARNINGS_PER_KM_INR) * 100) / 100;
    }

    return {
      id: da.id,
      created_at: createdAt,
      completed_at: completedAt,
      status: da.status,
      order_id: order.id ?? null,
      order_type: order.order_type ?? null,
      branch_name: branch.name ?? null,
      pickup_address: branch.address ?? null,
      customer_name: order.customer?.name ?? null,
      duration_minutes: durationMinutes,
      earnings,
    };
  });

  // Aggregate stats across ALL assignments (not just this page)
  const completedAll = all.filter((d: any) => d.status === 'delivered');
  const totalEarnings = completedAll.reduce((sum: number, d: any) => {
    if (d.earning !== null && d.earning !== undefined) return sum + Number(d.earning);
    let distKm = 0;
    const branch = d.orders?.branches ?? {};
    if (
      branch.lat != null && branch.lon != null &&
      d.delivery_lat != null && d.delivery_lon != null
    ) {
      distKm = calculateDistance(
        Number(branch.lat), Number(branch.lon),
        Number(d.delivery_lat), Number(d.delivery_lon),
      ) / 1000;
    }
    return sum + EARNINGS_BASE_INR + distKm * EARNINGS_PER_KM_INR;
  }, 0);

  // Fetch partner's rating from delivery_partners table
  const { data: partnerRow } = await supabaseAdmin
    .from('delivery_partners')
    .select('rating, total_deliveries')
    .eq('id', partnerId)
    .single();

  return {
    deliveries,
    meta: buildPaginationMeta(total, page, limit),
    stats: {
      total_deliveries: partnerRow?.total_deliveries ?? completedAll.length,
      total_earnings: Math.round(totalEarnings * 100) / 100,
      avg_rating: partnerRow?.rating ? Number(partnerRow.rating) : null,
    },
  };
}

// ─── FIX 3 (cont.): Partner Stats ────────────────────────────────────────────
/**
 * Returns a lightweight stats summary for the authenticated delivery partner's
 * dashboard — avoids re-fetching full history just for the numbers.
 */
export async function getPartnerStats(partnerId: string) {
  const { data: partnerRow, error } = await supabaseAdmin
    .from('delivery_partners')
    .select('rating, total_deliveries, is_online')
    .eq('id', partnerId)
    .single();

  if (error) throw error;

  // Earnings for the current calendar month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: monthlyDeliveries } = await supabaseAdmin
    .from('delivery_assignments')
    .select('earning, delivery_lat, delivery_lon, orders(branches(lat, lon))')
    .eq('partner_id', partnerId)
    .eq('status', 'delivered')
    .gte('delivered_at', monthStart.toISOString());

  const monthlyEarnings = (monthlyDeliveries ?? []).reduce((sum: number, d: any) => {
    if (d.earning !== null) return sum + Number(d.earning);
    let distKm = 0;
    const branch = d.orders?.branches ?? {};
    if (branch.lat != null && branch.lon != null && d.delivery_lat != null) {
      distKm = calculateDistance(
        Number(branch.lat), Number(branch.lon),
        Number(d.delivery_lat), Number(d.delivery_lon),
      ) / 1000;
    }
    return sum + EARNINGS_BASE_INR + distKm * EARNINGS_PER_KM_INR;
  }, 0);

  return {
    total_deliveries: partnerRow?.total_deliveries ?? 0,
    avg_rating: partnerRow?.rating ? Number(partnerRow.rating) : null,
    is_online: partnerRow?.is_online ?? false,
    earnings_this_month: Math.round(monthlyEarnings * 100) / 100,
    deliveries_this_month: (monthlyDeliveries ?? []).length,
  };
}

// ─── FIX 4 (helper): Run acceptance timeout for a single delivery ─────────────
/**
 * Called either by the standalone job (delivery-acceptance-timeout.ts)
 * or by the in-process setTimeout set up in assignDelivery().
 *
 * Checks if the delivery is still in 'assigned' status. If so, treats it as
 * an implicit rejection, frees the partner, and calls autoReassignDelivery.
 */
export async function runAcceptanceTimeoutForDelivery(
  deliveryId: string,
  partnerId: string,
): Promise<void> {
  // Check if the acceptance key still exists in Redis (it's deleted on acceptance)
  const acceptanceKey = `delivery_acceptance:${deliveryId}:${partnerId}`;
  const stillPending = await redis.exists(acceptanceKey);

  if (!stillPending) {
    // Partner already accepted (or key already processed) — nothing to do
    return;
  }

  // Confirm in DB that status is still 'assigned'
  const { data: delivery, error } = await supabaseAdmin
    .from('delivery_assignments')
    .select('id, status, partner_id, orders(id, branch_id)')
    .eq('id', deliveryId)
    .eq('partner_id', partnerId)
    .maybeSingle();

  if (error || !delivery) {
    console.warn(`[delivery-timeout] delivery ${deliveryId} not found — skipping`);
    return;
  }

  if (delivery.status !== 'assigned') {
    // Already progressed — clean up Redis and exit
    await redis.del(acceptanceKey);
    await redis.zrem('delivery_acceptance_timeouts', deliveryId);
    return;
  }

  console.log(
    `[delivery-timeout] delivery ${deliveryId}: partner ${partnerId} did not accept in time — reassigning`,
  );

  // Mark as rejected due to timeout
  await supabaseAdmin
    .from('delivery_assignments')
    .update({ status: 'rejected' })
    .eq('id', deliveryId);

  // Free the partner
  await supabaseAdmin
    .from('delivery_partners')
    .update({ active_delivery_id: null })
    .eq('id', partnerId);

  // Clean up Redis
  await redis.del(acceptanceKey);
  await redis.zrem('delivery_acceptance_timeouts', deliveryId);

  // Notify the partner their window expired
  io.to(`partner:${partnerId}`).emit('delivery_acceptance_expired', {
    delivery_id: deliveryId,
  });

  const order = (delivery.orders as { id: string; branch_id: string } | null);
  if (order?.id) {
    await autoReassignDelivery(deliveryId, partnerId, order.id);
  }
}