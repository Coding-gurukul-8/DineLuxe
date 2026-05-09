"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicket = createTicket;
exports.getTickets = getTickets;
exports.getTicketById = getTicketById;
exports.updateTicketStatus = updateTicketStatus;
exports.postMessage = postMessage;
exports.getMessages = getMessages;
exports.autoEscalateStaleTickets = autoEscalateStaleTickets;
const supabase_1 = require("../../config/supabase");
const pagination_1 = require("../../utils/pagination");
const notifications_service_1 = require("../notifications/notifications.service");
const AUTO_ESCALATE_HOURS = 24;
function parseConversation(raw) {
    if (!raw)
        return [];
    if (Array.isArray(raw))
        return raw;
    return [];
}
// ─── Create ticket ─────────────────────────────────────────────────────────────
async function createTicket(userId, payload) {
    const now = new Date().toISOString();
    const firstMessage = {
        sender_id: userId,
        sender_role: 'customer',
        message: payload.description,
        created_at: now,
        attachments: [],
    };
    const { data: ticket, error } = await supabase_1.supabaseAdmin
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
    if (error)
        throw error;
    await (0, notifications_service_1.createInApp)(userId, 'system_alert', 'Support ticket submitted', `We received "${payload.subject}" and will get back to you soon.`, ticket.id, 'support_ticket').catch(() => { });
    notifySupportAgents(ticket.id, payload.subject, payload.priority);
    return ticket;
}
async function notifySupportAgents(ticketId, subject, priority) {
    const { data: agents } = await supabase_1.supabaseAdmin.from('users').select('id').eq('role', 'support');
    for (const agent of agents ?? []) {
        (0, notifications_service_1.sendPush)(agent.id, `New ${priority} priority ticket`, subject, {
            ticket_id: ticketId,
            type: 'new_ticket',
        });
    }
}
// ─── Get tickets for user ─────────────────────────────────────────────────────
async function getTickets(userId, role, page, limit) {
    const { from, to } = (0, pagination_1.paginate)(page, limit);
    let query = supabase_1.supabaseAdmin
        .from('support_tickets')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
    if (role === 'customer') {
        query = query.eq('user_id', userId);
    }
    const { data, error, count } = await query;
    if (error)
        throw error;
    return { data, count };
}
// ─── Get ticket by ID ─────────────────────────────────────────────────────────
async function getTicketById(ticketId, userId, role) {
    const { data, error } = await supabase_1.supabaseAdmin
        .from('support_tickets')
        .select('*, user:users(id, name, email)')
        .eq('id', ticketId)
        .single();
    if (error)
        throw error;
    if (role === 'customer' && data.user_id !== userId) {
        throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    }
    return data;
}
// ─── Update ticket status ─────────────────────────────────────────────────────
async function updateTicketStatus(ticketId, agentId, status, _resolutionNote) {
    void _resolutionNote;
    const resolvedAt = status === 'resolved' || status === 'closed' ? new Date().toISOString() : null;
    let error = (await supabase_1.supabaseAdmin
        .from('support_tickets')
        .update({
        status,
        updated_at: new Date().toISOString(),
        resolved_at: resolvedAt,
        agent_id: agentId,
    })
        .eq('id', ticketId)).error;
    if (error) {
        error = (await supabase_1.supabaseAdmin
            .from('support_tickets')
            .update({
            status,
            updated_at: new Date().toISOString(),
            resolved_at: resolvedAt,
        })
            .eq('id', ticketId)).error;
    }
    if (error)
        throw error;
    const { data: row, error: fetchErr } = await supabase_1.supabaseAdmin
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .single();
    if (fetchErr || !row)
        throw fetchErr ?? new Error('Ticket not found');
    notifyTicketStatus(row.user_id, ticketId, status);
    return row;
}
function notifyTicketStatus(customerUserId, ticketId, status) {
    const statusMessages = {
        assigned: 'Your ticket is being reviewed.',
        resolved: 'Your support ticket has been resolved.',
        closed: 'Your support ticket has been closed.',
    };
    if (statusMessages[status]) {
        (0, notifications_service_1.sendPush)(customerUserId, 'Ticket Update', statusMessages[status], {
            ticket_id: ticketId,
            type: 'ticket_update',
        });
    }
}
// ─── Post message to ticket (appends to conversation JSON) ─────────────────
async function postMessage(ticketId, senderId, senderRole, message, attachments) {
    const { data: ticket, error: fetchErr } = await supabase_1.supabaseAdmin
        .from('support_tickets')
        .select('conversation')
        .eq('id', ticketId)
        .single();
    if (fetchErr || !ticket)
        throw fetchErr ?? new Error('Ticket not found');
    const conv = parseConversation(ticket.conversation);
    const entry = {
        sender_id: senderId,
        sender_role: senderRole,
        message,
        created_at: new Date().toISOString(),
        attachments: attachments ?? [],
    };
    const { data, error } = await supabase_1.supabaseAdmin
        .from('support_tickets')
        .update({
        conversation: [...conv, entry],
        updated_at: new Date().toISOString(),
    })
        .eq('id', ticketId)
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
// ─── Get messages for ticket ─────────────────────────────────────────────────
async function getMessages(ticketId, userId, role) {
    await getTicketById(ticketId, userId, role);
    const { data, error } = await supabase_1.supabaseAdmin
        .from('support_tickets')
        .select('conversation')
        .eq('id', ticketId)
        .single();
    if (error)
        throw error;
    return parseConversation(data?.conversation);
}
// ─── Auto-escalation check (called by cron) ───────────────────────────────────
async function autoEscalateStaleTickets() {
    const threshold = new Date(Date.now() - AUTO_ESCALATE_HOURS * 60 * 60 * 1000).toISOString();
    const { data: staleTickets, error } = await supabase_1.supabaseAdmin
        .from('support_tickets')
        .select('id, user_id, subject')
        .eq('status', 'open')
        .lt('created_at', threshold);
    if (error)
        throw error;
    if (!staleTickets?.length)
        return;
    const ids = staleTickets.map((t) => t.id);
    await supabase_1.supabaseAdmin
        .from('support_tickets')
        .update({ status: 'assigned', updated_at: new Date().toISOString() })
        .in('id', ids);
    const { data: managers } = await supabase_1.supabaseAdmin.from('users').select('id').eq('role', 'admin');
    for (const manager of managers ?? []) {
        (0, notifications_service_1.sendPush)(manager.id, 'Tickets Auto-Escalated', `${staleTickets.length} ticket(s) have been open for over ${AUTO_ESCALATE_HOURS} hours.`, { type: 'auto_escalation' });
    }
    return staleTickets.length;
}
//# sourceMappingURL=support.service.js.map