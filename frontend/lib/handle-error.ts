import { ApiError } from "@repo/shared";

/**
 * Converts any thrown value into a human-readable error string.
 * Handles ApiError (from the backend), native Error objects, and unknowns.
 */
export function handleApiError(err: unknown, fallback?: string): string {
  if (err instanceof ApiError) {
    return err.message || fallback || "An unexpected error occurred. Please try again.";
  }
  if (err instanceof Error) {
    return err.message || fallback || "An unexpected error occurred. Please try again.";
  }
  if (typeof err === "string" && err.trim().length > 0) {
    return err;
  }
  return fallback || "An unexpected error occurred. Please try again.";
}