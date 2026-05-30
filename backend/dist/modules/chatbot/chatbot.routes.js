"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const chatbot_controller_1 = require("./chatbot.controller");
const router = (0, express_1.Router)();
// All chatbot routes require authentication — we need req.user.id to scope
// orders, bookings, and support tickets to the correct customer.
router.use(auth_middleware_1.authenticate);
// POST /chatbot/message — send a message, get an AI/rule-based response
router.post('/message', chatbot_controller_1.handleSendMessage);
// GET /chatbot/history — fetch conversation history (Redis session or DB ticket)
router.get('/history', chatbot_controller_1.handleGetHistory);
exports.default = router;
//# sourceMappingURL=chatbot.routes.js.map