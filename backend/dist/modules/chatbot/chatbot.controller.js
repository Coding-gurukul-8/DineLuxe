"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSendMessage = handleSendMessage;
exports.handleGetHistory = handleGetHistory;
const response_1 = require("../../utils/response");
const chatbot_service_1 = require("./chatbot.service");
// ─── Helper ───────────────────────────────────────────────────────────────────
function handleKnownError(err, res, next) {
    const code = err.statusCode ?? err.status;
    if (code && code >= 400 && code < 600) {
        return res.status(code).json((0, response_1.error)(err.message));
    }
    next(err);
}
// ─── POST /chatbot/message ────────────────────────────────────────────────────
/**
 * Accepts a user message and returns an AI/rule-based response.
 * Body: { message: string; restaurant_id?: string }
 * Auth: customer JWT required (req.user.id is the customer's userId)
 */
async function handleSendMessage(req, res, next) {
    try {
        const userId = req.user.id;
        const { message, restaurant_id } = req.body;
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json((0, response_1.error)('VALIDATION_ERROR', 'message is required'));
        }
        const result = await (0, chatbot_service_1.sendMessage)(userId, message.trim(), restaurant_id);
        res.json((0, response_1.success)(result, result.isEscalated ? 'Your concern has been escalated to a support agent' : undefined));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
// ─── GET /chatbot/history ─────────────────────────────────────────────────────
/**
 * Returns the conversation history for the authenticated user.
 * If an open support ticket exists, returns the full DB conversation.
 * Otherwise returns the Redis session history.
 */
async function handleGetHistory(req, res, next) {
    try {
        const userId = req.user.id;
        const result = await (0, chatbot_service_1.getHistory)(userId);
        res.json((0, response_1.success)(result));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
//# sourceMappingURL=chatbot.controller.js.map