import { createClient } from '@supabase/supabase-js';
import { config } from './env';

export const supabaseAdmin = createClient<any>(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

import { Response } from 'express';

/**
 * Send a successful JSON response.
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string,
): void => {
  res.status(statusCode).json({
    success: true,
    ...(message && { message }),
    data,
  });
};

/**
 * Send a created (201) JSON response.
 */
export const sendCreated = <T>(res: Response, data: T, message?: string): void => {
  sendSuccess(res, data, 201, message);
};

/**
 * Send an error JSON response.
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  details?: unknown,
): void => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(details !== undefined && { details }),
  });
};

/**
 * Send a 400 Bad Request response.
 */
export const sendBadRequest = (res: Response, message: string, details?: unknown): void => {
  sendError(res, message, 400, details);
};

/**
 * Send a 401 Unauthorized response.
 */
export const sendUnauthorized = (res: Response, message = 'Unauthorized'): void => {
  sendError(res, message, 401);
};

/**
 * Send a 403 Forbidden response.
 */
export const sendForbidden = (res: Response, message = 'Forbidden'): void => {
  sendError(res, message, 403);
};

/**
 * Send a 404 Not Found response.
 */
export const sendNotFound = (res: Response, message = 'Not found'): void => {
  sendError(res, message, 404);
};

/**
 * Send a 409 Conflict response.
 */
export const sendConflict = (res: Response, message: string): void => {
  sendError(res, message, 409);
};