"use client";

import { useEffect } from "react";
import { useCart } from "@/hooks/useCart";

/**
 * Triggers Zustand's persist rehydration from localStorage on the client.
 *
 * useCart is created with skipHydration: true so that the persist middleware
 * never calls localStorage.getItem during Next.js server-side prerendering
 * (where window.localStorage exists as a mock but getItem is not a real function).
 *
 * This component runs a single useEffect on mount — guaranteed client-only —
 * to load the persisted cart state into the store.
 *
 * Place it inside the root layout, inside any providers it depends on.
 */
export function CartHydrator() {
  useEffect(() => {
    useCart.persist.rehydrate();
  }, []);

  return null;
}