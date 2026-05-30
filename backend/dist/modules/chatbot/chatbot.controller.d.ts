import { Request, Response, NextFunction } from 'express';
/**
 * Accepts a user message and returns an AI/rule-based response.
 * Body: { message: string; restaurant_id?: string }
 * Auth: customer JWT required (req.user.id is the customer's userId)
 */
export declare function handleSendMessage(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Returns the conversation history for the authenticated user.
 * If an open support ticket exists, returns the full DB conversation.
 * Otherwise returns the Redis session history.
 */
export declare function handleGetHistory(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=chatbot.controller.d.ts.map