import type { PaginationMeta } from './pagination';

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  meta?: unknown;
}

export interface PaginatedSuccessResponse<T = unknown> extends SuccessResponse<T> {
  pagination: PaginationMeta;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
    errors?: Array<{ field: string; message: string }>;
  };
}

export function success<T>(
  data: T,
  messageOrMeta?: string | unknown,
  meta?: unknown,
): SuccessResponse<T> {
  const message = typeof messageOrMeta === 'string' ? messageOrMeta : undefined;
  const resolvedMeta = typeof messageOrMeta === 'object' ? messageOrMeta : meta;

  return {
    success: true,
    data,
    ...(message !== undefined && { message }),
    ...(resolvedMeta !== undefined && { meta: resolvedMeta }),
  };
}

export function paginatedSuccess<T>(
  data: T,
  pagination: PaginationMeta,
): PaginatedSuccessResponse<T> {
  return {
    success: true,
    data,
    pagination,
  };
}

export function error(
  codeOrMessage: string,
  message?: string,
  field?: string,
): ErrorResponse {
  const code = message ? codeOrMessage : 'ERROR';
  const resolvedMessage = message ? message : codeOrMessage;

  return {
    success: false,
    error: {
      code,
      message: resolvedMessage,
      ...(field !== undefined && { field }),
    },
  };
}

export function validationError(
  errors: Array<{ field: string; message: string }>,
): ErrorResponse {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors,
    },
  };
}


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
