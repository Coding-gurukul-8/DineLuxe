"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getShiftsForWeek = getShiftsForWeek;
exports.createShift = createShift;
exports.createShiftForStaff = createShiftForStaff;
exports.updateShift = updateShift;
exports.deleteShift = deleteShift;
const supabase_1 = require("../../config/supabase");
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function httpError(status, code, message) {
    return Object.assign(new Error(message), { status, code });
}
/** Adds N days to a YYYY-MM-DD string, returns YYYY-MM-DD */
function addDays(dateStr, days) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
}
/**
 * Verifies that a branch belongs to the given restaurant.
 * Throws 404 if not found / not owned.
 */
async function assertBranchBelongsToRestaurant(branchId, restaurantId) {
    const { data, error } = await supabase_1.supabaseAdmin
        .from('branches')
        .select('id')
        .eq('id', branchId)
        .eq('restaurant_id', restaurantId)
        .single();
    if (error?.code === 'PGRST116' || !data) {
        throw httpError(404, 'BRANCH_NOT_FOUND', 'Branch not found or does not belong to this restaurant.');
    }
    if (error)
        throw error;
}
/**
 * Verifies that a staff member belongs to the given branch AND restaurant.
 * Throws 404 if not found / not owned.
 */
async function assertStaffBelongsToBranch(staffId, branchId, restaurantId) {
    const { data, error } = await supabase_1.supabaseAdmin
        .from('users')
        .select('id, name, role, employee_id')
        .eq('id', staffId)
        .eq('branch_id', branchId)
        .eq('restaurant_id', restaurantId)
        .single();
    if (error?.code === 'PGRST116' || !data) {
        throw httpError(404, 'STAFF_NOT_FOUND', 'Staff member not found in this branch.');
    }
    if (error)
        throw error;
    return {
        name: data.name,
        role: data.role,
        employee_id: data.employee_id ?? null,
    };
}
/**
 * Normalises a raw DB shift row into a typed ShiftRow.
 * The `users` join comes back as a nested object from Supabase.
 */
function normaliseShift(row) {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
        id: row.id,
        branch_id: row.branch_id,
        staff_id: row.staff_id,
        staff_name: user?.name ?? '',
        staff_role: user?.role ?? '',
        employee_id: user?.employee_id ?? null,
        date: row.date,
        start_time: row.start_time,
        end_time: row.end_time,
        notes: row.notes ?? null,
        created_by: row.created_by,
        created_at: row.created_at,
    };
}
// ---------------------------------------------------------------------------
// getShiftsForWeek
// GET /shifts?branch_id=&week_start=&staff_id=
// ---------------------------------------------------------------------------
async function getShiftsForWeek(branchId, weekStart, restaurantId, staffId) {
    // Security: verify the branch belongs to the caller's restaurant
    await assertBranchBelongsToRestaurant(branchId, restaurantId);
    const weekEnd = addDays(weekStart, 6);
    let query = supabase_1.supabaseAdmin
        .from('shifts')
        .select(`
      id, branch_id, staff_id, date, start_time, end_time, notes, created_by, created_at,
      users!staff_id (
        name,
        role,
        employee_id
      )
    `)
        .eq('branch_id', branchId)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });
    if (staffId) {
        query = query.eq('staff_id', staffId);
    }
    const { data, error } = await query;
    if (error)
        throw error;
    // Group by staff_id for calendar rendering
    const map = new Map();
    for (const row of data ?? []) {
        const shift = normaliseShift(row);
        const { staff_id, staff_name, staff_role, employee_id, ...rest } = shift;
        if (!map.has(staff_id)) {
            map.set(staff_id, {
                staff_id,
                staff_name,
                staff_role,
                employee_id,
                shifts: [],
            });
        }
        map.get(staff_id).shifts.push(rest);
    }
    return Array.from(map.values());
}
// ---------------------------------------------------------------------------
// createShift  (core — used by both POST /shifts and POST /staff/:id/shifts)
// ---------------------------------------------------------------------------
async function createShift(data, createdBy, restaurantId) {
    // 1. Branch ownership check
    await assertBranchBelongsToRestaurant(data.branch_id, restaurantId);
    // 2. Staff membership check
    await assertStaffBelongsToBranch(data.staff_id, data.branch_id, restaurantId);
    // 3. Conflict check — one shift per staff per day per branch (DB unique constraint)
    const { data: existing, error: conflictErr } = await supabase_1.supabaseAdmin
        .from('shifts')
        .select('id')
        .eq('staff_id', data.staff_id)
        .eq('branch_id', data.branch_id)
        .eq('date', data.date)
        .maybeSingle();
    if (conflictErr)
        throw conflictErr;
    if (existing) {
        throw httpError(409, 'SHIFT_CONFLICT', `A shift already exists for this staff member on ${data.date}. Delete or update it first.`);
    }
    // 4. Insert
    const { data: inserted, error: insertErr } = await supabase_1.supabaseAdmin
        .from('shifts')
        .insert({
        branch_id: data.branch_id,
        staff_id: data.staff_id,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        notes: data.notes ?? null,
        created_by: createdBy,
    })
        .select(`
      id, branch_id, staff_id, date, start_time, end_time, notes, created_by, created_at,
      users!staff_id (
        name,
        role,
        employee_id
      )
    `)
        .single();
    if (insertErr)
        throw insertErr;
    return normaliseShift(inserted);
}
// ---------------------------------------------------------------------------
// createShiftForStaff
// POST /staff/:staffId/shifts  — staffId comes from URL, branch from JWT
// ---------------------------------------------------------------------------
async function createShiftForStaff(staffId, data, createdBy, branchId, restaurantId) {
    // Verify the staff member belongs to the caller's branch before delegating
    await assertStaffBelongsToBranch(staffId, branchId, restaurantId);
    return createShift({
        branch_id: branchId,
        staff_id: staffId,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        notes: data.notes,
    }, createdBy, restaurantId);
}
// ---------------------------------------------------------------------------
// updateShift
// PATCH /shifts/:id
// ---------------------------------------------------------------------------
async function updateShift(shiftId, updates, restaurantId) {
    // Verify ownership via branch → restaurant join
    const { data: existing, error: fetchErr } = await supabase_1.supabaseAdmin
        .from('shifts')
        .select('id, start_time, end_time, branches!branch_id ( restaurant_id )')
        .eq('id', shiftId)
        .single();
    if (fetchErr?.code === 'PGRST116' || !existing) {
        throw httpError(404, 'SHIFT_NOT_FOUND', 'Shift not found.');
    }
    if (fetchErr)
        throw fetchErr;
    const branch = Array.isArray(existing.branches)
        ? existing.branches[0]
        : existing.branches;
    if (branch?.restaurant_id !== restaurantId) {
        throw httpError(403, 'FORBIDDEN', 'You do not have permission to update this shift.');
    }
    // Validate time ordering if both fields are being updated
    const newStart = updates.start_time ?? existing.start_time;
    const newEnd = updates.end_time ?? existing.end_time;
    if (newStart >= newEnd) {
        throw httpError(400, 'INVALID_TIME_RANGE', 'start_time must be before end_time.');
    }
    const updatePayload = {};
    if (updates.start_time !== undefined)
        updatePayload.start_time = updates.start_time;
    if (updates.end_time !== undefined)
        updatePayload.end_time = updates.end_time;
    if (updates.notes !== undefined)
        updatePayload.notes = updates.notes;
    const { data: updated, error: updateErr } = await supabase_1.supabaseAdmin
        .from('shifts')
        .update(updatePayload)
        .eq('id', shiftId)
        .select(`
      id, branch_id, staff_id, date, start_time, end_time, notes, created_by, created_at,
      users!staff_id (
        name,
        role,
        employee_id
      )
    `)
        .single();
    if (updateErr)
        throw updateErr;
    return normaliseShift(updated);
}
// ---------------------------------------------------------------------------
// deleteShift
// DELETE /shifts/:id
// ---------------------------------------------------------------------------
async function deleteShift(shiftId, restaurantId) {
    // Verify ownership before deleting
    const { data: existing, error: fetchErr } = await supabase_1.supabaseAdmin
        .from('shifts')
        .select('id, branches!branch_id ( restaurant_id )')
        .eq('id', shiftId)
        .single();
    if (fetchErr?.code === 'PGRST116' || !existing) {
        throw httpError(404, 'SHIFT_NOT_FOUND', 'Shift not found.');
    }
    if (fetchErr)
        throw fetchErr;
    const branch = Array.isArray(existing.branches)
        ? existing.branches[0]
        : existing.branches;
    if (branch?.restaurant_id !== restaurantId) {
        throw httpError(403, 'FORBIDDEN', 'You do not have permission to delete this shift.');
    }
    const { error: deleteErr } = await supabase_1.supabaseAdmin
        .from('shifts')
        .delete()
        .eq('id', shiftId);
    if (deleteErr)
        throw deleteErr;
    return { deleted: true, id: shiftId };
}
//# sourceMappingURL=shifts.service.js.map