import { supabaseAdmin } from '../../config/supabase';
import { paginate } from '../../utils/pagination';
import { createInApp, sendPush } from '../notifications/notifications.service';

const AUTO_ESCALATE_HOURS = 24;

type ConversationEntry = {
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
  attachments?: unknown[];
};

function parseConversation(raw: unknown): ConversationEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ConversationEntry[];
  return [];
}

// ─── Create ticket ─────────────────────────────────────────────────────────────
export async function createTicket(
  userId: string,
  payload: {
    subject: string;
    description: string;
    category: string;
    order_id?: string;
    priority: string;
  }
) {
  const now = new Date().toISOString();
  const firstMessage: ConversationEntry = {
    sender_id: userId,
    sender_role: 'customer',
    message: payload.description,
    created_at: now,
    attachments: [],
  };

  const { data: ticket, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      user_id: userId,
      subject: payload.subject,
      conversation: [
        {
          ...firstMessage,
          meta: {
            category: payload.category,
            priority: payload.priority,
            order_id: payload.order_id ?? null,
          },
        },
      ],
      status: 'open',
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw error;

  await createInApp(
    userId,
    'system_alert',
    'Support ticket submitted',
    `We received "${payload.subject}" and will get back to you soon.`,
    ticket.id,
    'support_ticket',
  ).catch(() => {});

  notifySupportAgents(ticket.id, payload.subject, payload.priority);

  return ticket;
}

async function notifySupportAgents(ticketId: string, subject: string, priority: string) {
  const { data: agents } = await supabaseAdmin.from('users').select('id').eq('role', 'support');

  for (const agent of agents ?? []) {
    sendPush(agent.id, `New ${priority} priority ticket`, subject, {
      ticket_id: ticketId,
      type: 'new_ticket',
    });
  }
}

// ─── Get tickets for user ─────────────────────────────────────────────────────
export async function getTickets(userId: string, role: string, page: number, limit: number) {
  const { from, to } = paginate(page, limit);

  let query = supabaseAdmin
    .from('support_tickets')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (role === 'customer') {
    query = query.eq('user_id', userId);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

// ─── Get ticket by ID ─────────────────────────────────────────────────────────
export async function getTicketById(ticketId: string, userId: string, role: string) {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select('*, user:users(id, name, email)')
    .eq('id', ticketId)
    .single();

  if (error) throw error;

  if (role === 'customer' && data.user_id !== userId) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }

  return data;
}

// ─── Update ticket status ─────────────────────────────────────────────────────
export async function updateTicketStatus(
  ticketId: string,
  agentId: string,
  status: string,
  _resolutionNote?: string
) {
  void _resolutionNote;

  const resolvedAt =
    status === 'resolved' || status === 'closed' ? new Date().toISOString() : null;

  let error = (
    await supabaseAdmin
      .from('support_tickets')
      .update({
        status,
        updated_at: new Date().toISOString(),
        resolved_at: resolvedAt,
        agent_id: agentId,
      })
      .eq('id', ticketId)
  ).error;

  if (error) {
    error = (
      await supabaseAdmin
        .from('support_tickets')
        .update({
          status,
          updated_at: new Date().toISOString(),
          resolved_at: resolvedAt,
        })
        .eq('id', ticketId)
    ).error;
  }

  if (error) throw error;

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (fetchErr || !row) throw fetchErr ?? new Error('Ticket not found');
  notifyTicketStatus(row.user_id, ticketId, status);
  return row;
}

function notifyTicketStatus(customerUserId: string, ticketId: string, status: string) {
  const statusMessages: Record<string, string> = {
    assigned: 'Your ticket is being reviewed.',
    resolved: 'Your support ticket has been resolved.',
    closed: 'Your support ticket has been closed.',
  };

  if (statusMessages[status]) {
    sendPush(customerUserId, 'Ticket Update', statusMessages[status], {
      ticket_id: ticketId,
      type: 'ticket_update',
    });
  }
}

// ─── Post message to ticket (appends to conversation JSON) ─────────────────
export async function postMessage(
  ticketId: string,
  senderId: string,
  senderRole: string,
  message: string,
  attachments?: string[]
) {
  const { data: ticket, error: fetchErr } = await supabaseAdmin
    .from('support_tickets')
    .select('conversation')
    .eq('id', ticketId)
    .single();

  if (fetchErr || !ticket) throw fetchErr ?? new Error('Ticket not found');

  const conv = parseConversation(ticket.conversation);
  const entry: ConversationEntry = {
    sender_id: senderId,
    sender_role: senderRole,
    message,
    created_at: new Date().toISOString(),
    attachments: attachments ?? [],
  };

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .update({
      conversation: [...conv, entry],
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Get messages for ticket ─────────────────────────────────────────────────
export async function getMessages(ticketId: string, userId: string, role: string) {
  await getTicketById(ticketId, userId, role);

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select('conversation')
    .eq('id', ticketId)
    .single();

  if (error) throw error;
  return parseConversation(data?.conversation);
}

// ─── Auto-escalation check (called by cron) ───────────────────────────────────
export async function autoEscalateStaleTickets() {
  const threshold = new Date(Date.now() - AUTO_ESCALATE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: staleTickets, error } = await supabaseAdmin
    .from('support_tickets')
    .select('id, user_id, subject')
    .eq('status', 'open')
    .lt('created_at', threshold);

  if (error) throw error;
  if (!staleTickets?.length) return;

  const ids = staleTickets.map((t: { id: string }) => t.id);

  await supabaseAdmin
    .from('support_tickets')
    .update({ status: 'assigned', updated_at: new Date().toISOString() })
    .in('id', ids);

  const { data: managers } = await supabaseAdmin.from('users').select('id').eq('role', 'admin');

  for (const manager of managers ?? []) {
    sendPush(
      manager.id,
      'Tickets Auto-Escalated',
      `${staleTickets.length} ticket(s) have been open for over ${AUTO_ESCALATE_HOURS} hours.`,
      { type: 'auto_escalation' }
    );
  }

  return staleTickets.length;
}
