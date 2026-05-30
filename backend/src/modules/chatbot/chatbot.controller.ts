import { Request, Response, NextFunction } from 'express';
import { success, error } from '../../utils/response';
import { sendMessage, getHistory } from './chatbot.service';

// ─── Helper ───────────────────────────────────────────────────────────────────

function handleKnownError(err: any, res: Response, next: NextFunction) {
  const code = err.statusCode ?? err.status;
  if (code && code >= 400 && code < 600) {
    return res.status(code).json(error(err.message));
  }
  next(err);
}

// ─── POST /chatbot/message ────────────────────────────────────────────────────

/**
 * Accepts a user message and returns an AI/rule-based response.
 * Body: { message: string; restaurant_id?: string }
 * Auth: customer JWT required (req.user.id is the customer's userId)
 */
export async function handleSendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { message, restaurant_id } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json(error('VALIDATION_ERROR', 'message is required'));
    }

    const result = await sendMessage(userId, message.trim(), restaurant_id);

    res.json(
      success(result, result.isEscalated ? 'Your concern has been escalated to a support agent' : undefined),
    );
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}

// ─── GET /chatbot/history ─────────────────────────────────────────────────────

/**
 * Returns the conversation history for the authenticated user.
 * If an open support ticket exists, returns the full DB conversation.
 * Otherwise returns the Redis session history.
 */
export async function handleGetHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const result = await getHistory(userId);
    res.json(success(result));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}