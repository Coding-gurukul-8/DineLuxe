"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { toast } from "sonner";
import { handleApiError } from "@/lib/handle-error";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 30 seconds before a background refetch
            staleTime: 30_000,
            // Retry once on failure before surfacing the error
            retry: 1,
            // Don't refetch just because the user alt-tabbed back
            refetchOnWindowFocus: false,
          },
          mutations: {
            onError: (err) => {
              // Global mutation error: show a toast so every mutation gets
              // error feedback without needing per-call error handling.
              // Individual mutations can still override with their own onError.
              toast.error(handleApiError(err));
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}