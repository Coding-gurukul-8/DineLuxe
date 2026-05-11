/* Shared API types */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: { page: number; limit: number; total: number; pages: number };
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: { code: string; message: string; field?: string };
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
