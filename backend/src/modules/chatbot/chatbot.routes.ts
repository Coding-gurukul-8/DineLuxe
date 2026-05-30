import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { handleSendMessage, handleGetHistory } from './chatbot.controller';

const router: import('express').Router = Router();

// All chatbot routes require authentication — we need req.user.id to scope
// orders, bookings, and support tickets to the correct customer.
router.use(authenticate);

// POST /chatbot/message — send a message, get an AI/rule-based response
router.post('/message', handleSendMessage);

// GET /chatbot/history — fetch conversation history (Redis session or DB ticket)
router.get('/history', handleGetHistory);

export default router;