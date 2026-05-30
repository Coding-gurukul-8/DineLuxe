import crypto from 'crypto';
import { io } from '../../server';
import { supabaseAdmin } from '../../config/supabase';
import { CreateGroupInput, PreOrderInput } from './social-dining.schema';

type BookingStatus = 'pending' | 'confirmed' | 'arrived' | 'seated' | 'no_show' | 'cancelled';

interface BookingRow {
  id: string;
  user_id: string;
  branch_id: string;
  people_count: number;
  arrival_time: string;
  status: BookingStatus;
}

interface GroupRow {
  id: string;
  booking_id: string;
  invite_code: string;
  organizer_id: string;
  max_members: number;
  is_open: boolean;
  created_at: string;
}

interface MemberRow {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  pre_orders: unknown;
}

interface UserRow {
  id: string;
  name: string | null;
}

interface BranchRow {
  id: string;
  name: string;
}

interface MenuItemRow {
  id: string;
  name: string;
}

interface ParsedPreOrder {
  menu_item_id: string;
  quantity: number;
  notes?: string;
}

interface MemberDetail {
  id: string;
  user_id: string;
  joined_at: string;
  first_name: string;
  last_name: string;
  pre_orders: ParsedPreOrder[];
  has_pre_ordered: boolean;
}

interface AggregatedPreOrder {
  menu_item_id: string;
  item_name: string;
  total_quantity: number;
  notes_list: string[];
}

function splitName(name?: string | null): { first_name: string; last_name: string } {
  const parts = (name ?? '').trim().split(' ').filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

function asHttpError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

function parsePreOrders(preOrders: unknown): ParsedPreOrder[] {
  if (!Array.isArray(preOrders)) return [];

  return preOrders
    .map((entry): ParsedPreOrder | null => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as Record<string, unknown>;
      const menuItemId = candidate['menu_item_id'];
      const quantity = candidate['quantity'];
      const notes = candidate['notes'];

      if (typeof menuItemId !== 'string' || typeof quantity !== 'number') return null;

      return {
        menu_item_id: menuItemId,
        quantity,
        ...(typeof notes === 'string' && notes.trim() ? { notes: notes.trim() } : {}),
      };
    })
    .filter((entry): entry is ParsedPreOrder => entry !== null);
}

function mapMemberDetail(member: MemberRow, user?: UserRow): MemberDetail {
  const { first_name, last_name } = splitName(user?.name);
  const pre_orders = parsePreOrders(member.pre_orders);

  return {
    id: member.id,
    user_id: member.user_id,
    joined_at: member.joined_at,
    first_name,
    last_name,
    pre_orders,
    has_pre_ordered: pre_orders.length > 0,
  };
}

function aggregatePreOrders(
  members: Array<MemberRow & { pre_orders: ParsedPreOrder[] }>,
  menuItems: MenuItemRow[],
): AggregatedPreOrder[] {
  const itemNames = new Map(menuItems.map((item) => [item.id, item.name]));
  const aggregated = new Map<string, AggregatedPreOrder>();

  for (const member of members) {
    for (const preOrder of member.pre_orders) {
      const current = aggregated.get(preOrder.menu_item_id) ?? {
        menu_item_id: preOrder.menu_item_id,
        item_name: itemNames.get(preOrder.menu_item_id) ?? 'Unknown item',
        total_quantity: 0,
        notes_list: [],
      };

      current.total_quantity += preOrder.quantity;
      if (preOrder.notes) current.notes_list.push(preOrder.notes);
      aggregated.set(preOrder.menu_item_id, current);
    }
  }

  return [...aggregated.values()];
}

async function fetchGroupById(groupId: string): Promise<GroupRow | null> {
  const { data, error } = await supabaseAdmin
    .from('social_dining_groups')
    .select('id, booking_id, invite_code, organizer_id, max_members, is_open, created_at')
    .eq('id', groupId)
    .maybeSingle();

  if (error) throw error;
  return (data as GroupRow | null) ?? null;
}

async function fetchGroupByBookingId(bookingId: string): Promise<GroupRow | null> {
  const { data, error } = await supabaseAdmin
    .from('social_dining_groups')
    .select('id, booking_id, invite_code, organizer_id, max_members, is_open, created_at')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (error) throw error;
  return (data as GroupRow | null) ?? null;
}

async function fetchGroupByInviteCode(inviteCode: string): Promise<GroupRow | null> {
  const { data, error } = await supabaseAdmin
    .from('social_dining_groups')
    .select('id, booking_id, invite_code, organizer_id, max_members, is_open, created_at')
    .eq('invite_code', inviteCode)
    .maybeSingle();

  if (error) throw error;
  return (data as GroupRow | null) ?? null;
}

async function fetchMembers(groupId: string): Promise<MemberRow[]> {
  const { data, error } = await supabaseAdmin
    .from('social_dining_members')
    .select('id, group_id, user_id, joined_at, pre_orders')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as MemberRow[];
}

async function fetchUsersByIds(userIds: string[]): Promise<Map<string, UserRow>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .in('id', uniqueIds);

  if (error) throw error;
  return new Map(((data ?? []) as UserRow[]).map((user) => [user.id, user]));
}

async function fetchBookingDetails(bookingId: string): Promise<{ booking: BookingRow; branch: BranchRow; customer: UserRow | null }> {
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('id, user_id, branch_id, people_count, arrival_time, status')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) throw bookingError;
  if (!booking) throw asHttpError('Booking not found', 404);

  const { data: branch, error: branchError } = await supabaseAdmin
    .from('branches')
    .select('id, name')
    .eq('id', booking.branch_id)
    .maybeSingle();

  if (branchError) throw branchError;
  if (!branch) throw asHttpError('Branch not found', 404);

  const { data: customer, error: customerError } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .eq('id', booking.user_id)
    .maybeSingle();

  if (customerError) throw customerError;

  return {
    booking: booking as BookingRow,
    branch: branch as BranchRow,
    customer: (customer as UserRow | null) ?? null,
  };
}

async function fetchMenuItems(menuItemIds: string[]): Promise<MenuItemRow[]> {
  const uniqueIds = [...new Set(menuItemIds)];
  if (uniqueIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .select('id, name')
    .in('id', uniqueIds);

  if (error) throw error;
  return (data ?? []) as MenuItemRow[];
}

export async function generateInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const suffix = crypto.randomBytes(6).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X');
    const inviteCode = `DINE-${suffix}`;

    const { data, error } = await supabaseAdmin
      .from('social_dining_groups')
      .select('id')
      .eq('invite_code', inviteCode)
      .maybeSingle();

    if (error) throw error;
    if (!data) return inviteCode;
  }

  throw asHttpError('Unable to generate a unique invite code', 500);
}

export async function createGroup(userId: string, input: CreateGroupInput) {
  const bookingDetails = await fetchBookingDetails(input.booking_id);

  if (bookingDetails.booking.user_id !== userId) {
    throw asHttpError('You can only create a social dining group for your own booking', 403);
  }

  if (!['pending', 'confirmed'].includes(bookingDetails.booking.status)) {
    throw asHttpError('Social dining groups can only be created for pending or confirmed bookings', 422);
  }

  const existingGroup = await fetchGroupByBookingId(input.booking_id);
  if (existingGroup) {
    throw asHttpError('A social dining group already exists for this booking', 409);
  }

  const inviteCode = await generateInviteCode();

  const { data: group, error: groupError } = await supabaseAdmin
    .from('social_dining_groups')
    .insert({
      booking_id: input.booking_id,
      organizer_id: userId,
      invite_code: inviteCode,
      max_members: input.max_members,
      is_open: true,
    })
    .select('id, booking_id, invite_code, organizer_id, max_members, is_open, created_at')
    .single();

  if (groupError) throw groupError;

  const { error: memberError } = await supabaseAdmin.from('social_dining_members').insert({
    group_id: group.id,
    user_id: userId,
    pre_orders: [],
  });

  if (memberError) {
    await supabaseAdmin.from('social_dining_groups').delete().eq('id', group.id);
    throw memberError;
  }

  return {
    group_id: group.id,
    invite_code: group.invite_code,
    share_url: `https://dineluxe.app/join/${group.invite_code}`,
  };
}

export async function joinGroup(userId: string, inviteCode: string) {
  const group = await fetchGroupByInviteCode(inviteCode);

  if (!group || !group.is_open) {
    throw asHttpError('Group not found or invite has expired', 404);
  }

  const members = await fetchMembers(group.id);
  if (members.length >= group.max_members) {
    throw asHttpError('Group is full', 409);
  }

  if (members.some((member) => member.user_id === userId)) {
    throw asHttpError('You are already a member of this group', 409);
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .eq('id', userId)
    .maybeSingle();

  if (userError) throw userError;
  if (!user) throw asHttpError('User not found', 404);

  const { error: insertError } = await supabaseAdmin.from('social_dining_members').insert({
    group_id: group.id,
    user_id: userId,
    pre_orders: [],
  });

  if (insertError) throw insertError;

  const split = splitName(user.name);
  io.to(`user:${group.organizer_id}`).emit('group_member_joined', {
    group_id: group.id,
    new_member: {
      user_id: user.id,
      first_name: split.first_name,
      last_name: split.last_name,
    },
  });

  return {
    group_id: group.id,
    booking_id: group.booking_id,
    member_count: members.length + 1,
  };
}

export async function getGroupForBooking(bookingId: string, userId: string) {
  const group = await fetchGroupByBookingId(bookingId);
  if (!group) {
    throw asHttpError('Social dining group not found', 404);
  }

  const [bookingDetails, members] = await Promise.all([
    fetchBookingDetails(bookingId),
    fetchMembers(group.id),
  ]);

  if (!(group.organizer_id === userId || members.some((member) => member.user_id === userId))) {
    throw asHttpError('Forbidden', 403);
  }

  const users = await fetchUsersByIds([group.organizer_id, ...members.map((member) => member.user_id)]);
  const mappedMembers = members.map((member) => mapMemberDetail(member, users.get(member.user_id)));
  const organizerName = splitName(users.get(group.organizer_id)?.name ?? null);

  return {
    group: {
      id: group.id,
      booking_id: group.booking_id,
      invite_code: group.invite_code,
      organizer_id: group.organizer_id,
      organizer_first_name: organizerName.first_name,
      organizer_last_name: organizerName.last_name,
      max_members: group.max_members,
      is_open: group.is_open,
      created_at: group.created_at,
    },
    booking: {
      ...bookingDetails.booking,
      branch_name: bookingDetails.branch.name,
      branch: bookingDetails.branch,
      customer: bookingDetails.customer
        ? {
            ...bookingDetails.customer,
            ...splitName(bookingDetails.customer.name),
          }
        : null,
    },
    members: mappedMembers,
  };
}

export async function updatePreOrders(userId: string, groupId: string, input: PreOrderInput) {
  const group = await fetchGroupById(groupId);
  if (!group) {
    throw asHttpError('Social dining group not found', 404);
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('social_dining_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) {
    throw asHttpError('You must be a member of the group to update pre-orders', 403);
  }

  const { error } = await supabaseAdmin
    .from('social_dining_members')
    .update({ pre_orders: input.pre_orders })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw error;

  io.to(`user:${group.organizer_id}`).emit('pre_order_updated', {
    group_id: groupId,
    user_id: userId,
    pre_orders: input.pre_orders,
  });

  return { updated: true };
}

export async function closeGroup(organizerId: string, groupId: string) {
  const group = await fetchGroupById(groupId);
  if (!group) {
    throw asHttpError('Social dining group not found', 404);
  }

  if (group.organizer_id !== organizerId) {
    throw asHttpError('Only the organizer can close the group', 403);
  }

  const { error: updateError } = await supabaseAdmin
    .from('social_dining_groups')
    .update({ is_open: false })
    .eq('id', groupId);

  if (updateError) throw updateError;

  const members = await fetchMembers(groupId);
  const normalizedMembers = members.map((member) => ({
    ...member,
    pre_orders: parsePreOrders(member.pre_orders),
  }));
  const menuItems = await fetchMenuItems(normalizedMembers.flatMap((member) => member.pre_orders.map((preOrder) => preOrder.menu_item_id)));

  return {
    group_id: groupId,
    is_open: false,
    total_pre_orders: aggregatePreOrders(normalizedMembers, menuItems),
  };
}

export async function getGroupPreOrderSummary(groupId: string, organizerId: string) {
  const group = await fetchGroupById(groupId);
  if (!group) {
    throw asHttpError('Social dining group not found', 404);
  }

  if (group.organizer_id !== organizerId) {
    throw asHttpError('Only the organizer can view this summary', 403);
  }

  const members = await fetchMembers(groupId);
  const normalizedMembers = members.map((member) => ({
    ...member,
    pre_orders: parsePreOrders(member.pre_orders),
  }));
  const menuItems = await fetchMenuItems(normalizedMembers.flatMap((member) => member.pre_orders.map((preOrder) => preOrder.menu_item_id)));

  return {
    items: aggregatePreOrders(normalizedMembers, menuItems).map((item) => ({
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      quantity: item.total_quantity,
      notes: item.notes_list,
    })),
    member_count: members.length,
    pre_order_count: normalizedMembers.reduce((count, member) => count + member.pre_orders.length, 0),
  };
}

export async function getInviteTeaser(inviteCode: string) {
  const group = await fetchGroupByInviteCode(inviteCode);
  if (!group) {
    throw asHttpError('Group not found or invite has expired', 404);
  }

  const [bookingDetails, members, organizer] = await Promise.all([
    fetchBookingDetails(group.booking_id),
    fetchMembers(group.id),
    supabaseAdmin.from('users').select('id, name').eq('id', group.organizer_id).maybeSingle(),
  ]);

  if (organizer.error) throw organizer.error;

  return {
    invite_code: group.invite_code,
    branch_name: bookingDetails.branch.name,
    party_size: bookingDetails.booking.people_count,
    organizer_first_name: splitName((organizer.data as UserRow | null)?.name).first_name,
    current_members: members.length,
    is_open: group.is_open,
  };
}