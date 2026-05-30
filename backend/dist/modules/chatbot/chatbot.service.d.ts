export interface ChatMessage {
    role: 'user' | 'ai' | 'agent';
    content: string;
    timestamp: string;
}
export interface ChatContext {
    userId: string;
    restaurantId?: string;
    recentOrders: Array<{
        id: string;
        status: string;
        restaurant_name: string;
        total: number;
    }>;
    activeBooking: {
        id: string;
        branch_name: string;
        arrival_time: string;
        status: string;
    } | null;
    ticketId: string | null;
}
interface IntentResult {
    intent: string;
    shouldEscalate: boolean;
    dataRef?: string;
}
/**
 * Build or restore a ChatContext for a user.
 * Fetches last 3 orders (with restaurant name), active booking, and any
 * existing ticketId stored in Redis.
 */
export declare function initSession(userId: string, restaurantId?: string): Promise<ChatContext>;
/**
 * Rule-based intent detector.
 * Priority order: escalation → order_status → booking_status →
 * menu_info → hours_info → greeting → general
 */
export declare function analyzeIntent(message: string): IntentResult;
/**
 * Returns a deterministic text response for a given intent and context.
 * (Phase 2: replace with OpenAI call when OPENAI_API_KEY is available.)
 */
export declare function generateResponse(intent: string, context: ChatContext, _message: string): string;
/**
 * Main entry point.
 * - Builds context via initSession
 * - Detects intent
 * - Creates support ticket if escalation required
 * - Generates and caches response
 * - Returns { response, isEscalated, ticketId }
 */
export declare function sendMessage(userId: string, message: string, restaurantId?: string): Promise<{
    response: string;
    isEscalated: boolean;
    ticketId: string | null;
}>;
/**
 * Retrieve the chat history for a user.
 * If they have an open ticket, also pull the full DB conversation.
 * Falls back to the Redis session history.
 */
export declare function getHistory(userId: string): Promise<{
    messages: ChatMessage[];
    ticketId: string | null;
}>;
export {};
//# sourceMappingURL=chatbot.service.d.ts.map