"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-client";

export interface UseSupabaseRealtimeOptions<TPayload> {
  channel?: string;
  event: string;
  enabled?: boolean;
  onEvent: (payload: TPayload) => void;
}

interface UseSupabaseRealtimeReturn {
  isConnected: boolean;
  error: string | null;
}

export function useSupabaseRealtime<TPayload>({
  channel,
  event,
  enabled = true,
  onEvent,
}: UseSupabaseRealtimeOptions<TPayload>): UseSupabaseRealtimeReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !channel || !event) {
      setIsConnected(false);
      return;
    }

    let mounted = true;
    let activeChannel: any = null;
    let supabaseClient: any = null;

    void (async () => {
      try {
        supabaseClient = await getBrowserSupabase();
        if (!mounted) return;

        activeChannel = supabaseClient
          .channel(channel)
          .on("broadcast", { event }, ({ payload }: { payload: TPayload }) => {
            if (!mounted) return;
            handlerRef.current(payload);
          })
          .subscribe((status: string) => {
            if (!mounted) return;
            setIsConnected(status === "SUBSCRIBED");
            if (status === "CHANNEL_ERROR") {
              setError(`Failed to subscribe to ${channel}:${event}`);
            }
          });
      } catch (err) {
        if (!mounted) return;
        setIsConnected(false);
        setError(err instanceof Error ? err.message : `Failed to subscribe to ${channel}:${event}`);
      }
    })();

    return () => {
      mounted = false;
      setIsConnected(false);

      if (activeChannel && supabaseClient) {
        void supabaseClient.removeChannel(activeChannel);
      }
    };
  }, [channel, enabled, event]);

  return { isConnected, error };
}