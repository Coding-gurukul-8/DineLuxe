"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSession = initSession;
exports.analyzeIntent = analyzeIntent;
exports.generateResponse = generateResponse;
exports.sendMessage = sendMessage;
exports.getHistory = getHistory;
const supabase_1 = require("../../config/supabase");
const redis_1 = require("../../config/redis");
// ─── Redis key helpers ────────────────────────────────────────────────────────
const sessionKey = (userId) => `chat_session:${userId}`;
const ticketKey = (userId) => `chat_ticket:${userId}`;
const historyKey = (userId) => `chat_history:${userId}`;
const SESSION_TTL = 60 * 30; // 30 minutes
const HISTORY_TTL = 60 * 60; // 1 hour
// ─── Intent keywords ──────────────────────────────────────────────────────────
const ESCALATION_KEYWORDS = [
    'refund', 'complaint', 'wrong order', 'damaged', 'cold food', 'rude staff',
    'overcharged', 'never arrived', 'inedible', 'food poisoning', 'billing error',
];
const ORDER_STATUS_KEYWORDS = [
    'order status', 'where is my order', 'when will', 'track order', 'delivery',
];
const BOOKING_KEYWORDS = [
    'booking', 'reservation', 'table booked', 'my table',
];
const MENU_KEYWORDS = [
    'menu', 'what do you serve', 'food items', 'what can i order', 'ingredients',
];
const HOURS_KEYWORDS = [
    'timing', 'open', 'close', 'hours', 'when are you',
];
const GREETING_KEYWORDS = ['hi', 'hello', 'hey'];
// ─── initSession ──────────────────────────────────────────────────────────────
/**
 * Build or restore a ChatContext for a user.
 * Fetches last 3 orders (with restaurant name), active booking, and any
 * existing ticketId stored in Redis.
 */
async function initSession(userId, restaurantId) {
    // Check for an existing session in Redis
    const cached = await redis_1.redis.get(sessionKey(userId));
    if (cached) {
        const ctx = JSON.parse(cached);
        // Always refresh ticketId from Redis (may have been created mid-session)
        const storedTicketId = await redis_1.redis.get(ticketKey(userId));
        ctx.ticketId = storedTicketId ?? null;
        return ctx;
    }
    // Fetch last 3 orders joined with restaurants for name
    const { data: orders } = await supabase_1.supabaseAdmin
        .from('orders')
        .select(`
      id, status, total_amount,
      restaurants ( name )
    `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);
    const recentOrders = (orders ?? []).map((o) => ({
        id: o.id,
        status: o.status,
        restaurant_name: o.restaurants?.name ?? 'Unknown Restaurant',
        total: Number(o.total_amount ?? 0),
    }));
    // Fetch active booking (pending | confirmed | arrived)
    const { data: booking } = await supabase_1.supabaseAdmin
        .from('bookings')
        .select(`
      id, arrival_time, status,
      branches ( name )
    `)
        .eq('user_id', userId)
        .in('status', ['pending', 'confirmed', 'arrived'])
        .order('arrival_time', { ascending: true })
        .limit(1)
        .maybeSingle();
    const activeBooking = booking
        ? {
            id: booking.id,
            branch_name: booking.branches?.name ?? 'Unknown Branch',
            arrival_time: booking.arrival_time,
            status: booking.status,
        }
        : null;
    // Check for existing support ticket in Redis
    const storedTicketId = await redis_1.redis.get(ticketKey(userId));
    const context = {
        userId,
        restaurantId,
        recentOrders,
        activeBooking,
        ticketId: storedTicketId ?? null,
    };
    // Cache the context for 30 minutes
    await redis_1.redis.setex(sessionKey(userId), SESSION_TTL, JSON.stringify(context));
    return context;
}
// ─── analyzeIntent ────────────────────────────────────────────────────────────
/**
 * Rule-based intent detector.
 * Priority order: escalation → order_status → booking_status →
 * menu_info → hours_info → greeting → general
 */
function analyzeIntent(message) {
    const lower = message.toLowerCase().trim();
    // 1. ESCALATION — checked first; these must never be deflected
    if (ESCALATION_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'escalation', shouldEscalate: true };
    }
    // 2. ORDER STATUS
    if (ORDER_STATUS_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'order_status', shouldEscalate: false };
    }
    // 3. BOOKING STATUS
    if (BOOKING_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'booking_status', shouldEscalate: false };
    }
    // 4. MENU INFO
    if (MENU_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'menu_info', shouldEscalate: false };
    }
    // 5. HOURS INFO
    if (HOURS_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'hours_info', shouldEscalate: false };
    }
    // 6. GREETING — short messages or explicit greetings
    const wordCount = lower.split(/\s+/).filter(Boolean).length;
    if (wordCount < 10 || GREETING_KEYWORDS.some((kw) => lower.includes(kw))) {
        return { intent: 'greeting', shouldEscalate: false };
    }
    // 7. DEFAULT
    return { intent: 'general', shouldEscalate: false };
}
// ─── generateResponse ─────────────────────────────────────────────────────────
/**
 * Returns a deterministic text response for a given intent and context.
 * (Phase 2: replace with OpenAI call when OPENAI_API_KEY is available.)
 */
function generateResponse(intent, context, _message) {
    switch (intent) {
        case 'greeting':
            return ('Hi! I am your DineLuxe assistant. How can I help you today? ' +
                'You can ask about your order status, bookings, menu, or restaurant timings.');
        case 'order_status': {
            if (context.recentOrders.length > 0) {
                const order = context.recentOrders[0];
                return (`Your most recent order from ${order.restaurant_name} is currently ${order.status}. ` +
                    `Order total: ₹${order.total}. Order ID: #${order.id.slice(-8)}`);
            }
            return "I don't see any recent orders on your account.";
        }
        case 'booking_status': {
            if (context.activeBooking) {
                const b = context.activeBooking;
                // Format arrival_time to a readable string
                const arrivalDisplay = new Date(b.arrival_time).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                });
                return `Your booking at ${b.branch_name} on ${arrivalDisplay} is ${b.status}.`;
            }
            return "I don't see any active bookings on your account.";
        }
        case 'menu_info':
            return ('You can view the full menu on the restaurant page. ' +
                'Would you like me to help you navigate there?');
        case 'hours_info':
            return ("Restaurant timings vary by location. " +
                "You can find exact hours on each restaurant's profile page.");
        case 'escalation':
            return ("I'm sorry to hear that. I've escalated your concern to a support agent who will " +
                "review your case as soon as possible. You'll receive a follow-up via email. " +
                `Your support ticket ID is #${(context.ticketId ?? '').slice(-8) || 'pending'}.`);
        case 'general':
        default:
            return ("I'm here to help! Could you provide more details about your query? " +
                'For complex issues, I can connect you with a support agent.');
    }
}
// ─── sendMessage ──────────────────────────────────────────────────────────────
/**
 * Main entry point.
 * - Builds context via initSession
 * - Detects intent
 * - Creates support ticket if escalation required
 * - Generates and caches response
 * - Returns { response, isEscalated, ticketId }
 */
async function sendMessage(userId, message, restaurantId) {
    const now = new Date().toISOString();
    // 1. Build context (uses Redis cache when available)
    const context = await initSession(userId, restaurantId);
    // 2. Detect intent
    const { intent, shouldEscalate } = analyzeIntent(message);
    // 3. Escalation: create support ticket if not already open
    if (shouldEscalate && !context.ticketId) {
        const firstMessage = {
            role: 'user',
            content: message,
            timestamp: now,
        };
        const { data: ticket, error: ticketErr } = await supabase_1.supabaseAdmin
            .from('support_tickets')
            .insert({
            user_id: userId,
            restaurant_id: restaurantId ?? null,
            subject: 'Customer support request',
            conversation: [
                {
                    sender_id: userId,
                    sender_role: 'customer',
                    message,
                    created_at: now,
                    attachments: [],
                },
            ],
            status: 'open',
            created_at: now,
            updated_at: now,
        })
            .select('id')
            .single();
        if (ticketErr)
            throw ticketErr;
        context.ticketId = ticket.id;
        // Store ticketId in Redis so the session remembers it
        await redis_1.redis.setex(ticketKey(userId), SESSION_TTL, ticket.id);
        // Refresh cached context with ticketId
        await redis_1.redis.setex(sessionKey(userId), SESSION_TTL, JSON.stringify(context));
    }
    // 4. Generate the AI/rule-based response
    const response = generateResponse(intent, context, message);
    // 5. Append to conversation history in Redis
    const rawHistory = await redis_1.redis.get(historyKey(userId));
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    const userMsg = { role: 'user', content: message, timestamp: now };
    const aiMsg = { role: 'ai', content: response, timestamp: new Date().toISOString() };
    history.push(userMsg, aiMsg);
    await redis_1.redis.setex(historyKey(userId), HISTORY_TTL, JSON.stringify(history));
    // 6. If ticket is open, also append to the DB conversation array
    if (context.ticketId) {
        const { data: existing } = await supabase_1.supabaseAdmin
            .from('support_tickets')
            .select('conversation')
            .eq('id', context.ticketId)
            .single();
        const conv = Array.isArray(existing?.conversation)
            ? existing.conversation
            : [];
        // Append AI response (mark as agent/ai for audit trail)
        await supabase_1.supabaseAdmin
            .from('support_tickets')
            .update({
            conversation: [
                ...conv,
                {
                    sender_id: 'chatbot',
                    sender_role: 'agent',
                    message: response,
                    created_at: aiMsg.timestamp,
                    attachments: [],
                },
            ],
            updated_at: aiMsg.timestamp,
        })
            .eq('id', context.ticketId);
    }
    return {
        response,
        isEscalated: shouldEscalate,
        ticketId: context.ticketId,
    };
}
// ─── getHistory ───────────────────────────────────────────────────────────────
/**
 * Retrieve the chat history for a user.
 * If they have an open ticket, also pull the full DB conversation.
 * Falls back to the Redis session history.
 */
async function getHistory(userId) {
    const ticketId = await redis_1.redis.get(ticketKey(userId));
    if (ticketId) {
        const { data: ticket } = await supabase_1.supabaseAdmin
            .from('support_tickets')
            .select('conversation')
            .eq('id', ticketId)
            .single();
        const conv = Array.isArray(ticket?.conversation) ? ticket.conversation : [];
        // Map DB conversation entries → ChatMessage shape
        const messages = conv.map((entry) => ({
            role: entry.sender_role === 'customer' ? 'user' : entry.sender_role,
            content: entry.message ?? '',
            timestamp: entry.created_at ?? new Date().toISOString(),
        }));
        return { messages, ticketId };
    }
    // No ticket — return Redis session history
    const rawHistory = await redis_1.redis.get(historyKey(userId));
    const messages = rawHistory ? JSON.parse(rawHistory) : [];
    return { messages, ticketId: null };
}
//# sourceMappingURL=chatbot.service.js.map