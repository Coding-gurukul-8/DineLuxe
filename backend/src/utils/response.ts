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
