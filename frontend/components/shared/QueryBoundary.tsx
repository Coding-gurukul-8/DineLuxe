"use client";

import { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";
import { handleApiError } from "@/lib/handle-error";

interface QueryBoundaryProps {
  /** Pass isLoading from useQuery */
  isLoading: boolean;
  /** Pass isError from useQuery */
  isError: boolean;
  /** Pass the error object from useQuery */
  error?: unknown;
  /** Pass refetch from useQuery */
  refetch?: () => void;
  /** Content to render when data is available */
  children: ReactNode;
  /** Optional custom loading message */
  loadingMessage?: string;
}

/**
 * Wraps any data-fetching section with consistent loading / error / content states.
 *
 * Usage:
 *   const { data, isLoading, isError, error, refetch } = useQuery(...)
 *
 *   <QueryBoundary isLoading={isLoading} isError={isError} error={error} refetch={refetch}>
 *     <YourContent data={data} />
 *   </QueryBoundary>
 */
export function QueryBoundary({
  isLoading,
  isError,
  error,
  refetch,
  children,
  loadingMessage,
}: QueryBoundaryProps) {
  if (isLoading) {
    return (
      <div className="relative min-h-[200px]">
        <LoadingOverlay isLoading message={loadingMessage} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <RefreshCw size={20} className="text-red-400" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 mb-1">Something went wrong</p>
          <p className="text-sm text-red-500 max-w-sm">{handleApiError(error)}</p>
        </div>
        {refetch && (
          <button
            onClick={() => refetch()}
            className="px-5 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}