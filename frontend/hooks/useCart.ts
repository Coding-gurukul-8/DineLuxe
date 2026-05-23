"use client";

/**
 * useCart — Zustand-persisted shopping cart
 *
 * Fixes vs. old implementation
 * ──────────────────────────────
 * 1. CartItem.menuItemId → id  (matches spec / API)
 * 2. CartItem.photoUrl   → image_url  (matches spec)
 * 3. persist key "dineluxe-cart" → "dineluxe_cart"  (spec)
 * 4. updateQuantity kept + updateQty alias added  (spec surface)
 * 5. addItem now takes (item, restaurantId?, branchId?) — restaurantId /
 *    branchId are optional so call-sites that don't have them still compile.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CartItem {
  /** Primary key — matches menu_item.id from the backend. */
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
  notes?: string;
  addons?: { name: string; extraPrice: number }[];
}

interface CartState {
  // ── State ────────────────────────────────────────────────────────────────────
  items: CartItem[];
  restaurantId: string | null;
  branchId: string | null;
  tableId: string | null;

  // ── Mutators ─────────────────────────────────────────────────────────────────

  /**
   * Add an item to the cart.
   * • If the restaurantId changes, the existing cart is cleared first.
   * • If the item already exists, its quantity is incremented.
   */
  addItem: (
    item: CartItem,
    restaurantId?: string | null,
    branchId?: string | null
  ) => void;

  /** Remove a line by item id. */
  removeItem: (id: string) => void;

  /**
   * Set the exact quantity for an item.
   * Passing qty ≤ 0 removes the item.
   */
  updateQty: (id: string, qty: number) => void;

  /** Backward-compat alias for updateQty. */
  updateQuantity: (id: string, quantity: number) => void;

  /** Update per-item notes (special requests). */
  updateNotes: (id: string, notes: string) => void;

  /** Attach a table to the in-progress order. */
  setTable: (tableId: string) => void;

  /** Wipe the entire cart. */
  clearCart: () => void;

  // ── Derived (called as functions because zustand can't persist computed values) ──

  /** Grand total including addons. */
  total: () => number;

  /** Total number of individual items (sum of quantities). */
  itemCount: () => number;
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantId: null,
      branchId: null,
      tableId: null,

      // ── addItem ─────────────────────────────────────────────────────────────

      addItem: (newItem, restaurantId = null, branchId = null) => {
        const { items, restaurantId: currentRestaurantId } = get();

        // Different restaurant → clear and start fresh
        if (
          restaurantId &&
          currentRestaurantId &&
          currentRestaurantId !== restaurantId
        ) {
          set({ items: [{ ...newItem, quantity: newItem.quantity || 1 }], restaurantId, branchId });
          return;
        }

        const existing = items.find((i) => i.id === newItem.id);
        if (existing) {
          set({
            items: items.map((i) =>
              i.id === newItem.id
                ? { ...i, quantity: i.quantity + (newItem.quantity || 1) }
                : i
            ),
          });
        } else {
          set({
            items: [...items, { ...newItem, quantity: newItem.quantity || 1 }],
            restaurantId: restaurantId ?? currentRestaurantId,
            branchId: branchId ?? get().branchId,
          });
        }
      },

      // ── removeItem ──────────────────────────────────────────────────────────

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      // ── updateQty ───────────────────────────────────────────────────────────

      updateQty: (id, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.id !== id)
              : s.items.map((i) => (i.id === id ? { ...i, quantity: qty } : i)),
        })),

      // Backward-compat alias
      updateQuantity: (id, quantity) => get().updateQty(id, quantity),

      // ── updateNotes ─────────────────────────────────────────────────────────

      updateNotes: (id, notes) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, notes } : i)),
        })),

      // ── setTable ────────────────────────────────────────────────────────────

      setTable: (tableId) => set({ tableId }),

      // ── clearCart ───────────────────────────────────────────────────────────

      clearCart: () =>
        set({ items: [], restaurantId: null, branchId: null, tableId: null }),

      // ── total ───────────────────────────────────────────────────────────────

      total: () =>
        get().items.reduce((sum, item) => {
          const addonsTotal =
            item.addons?.reduce((a, b) => a + b.extraPrice, 0) ?? 0;
          return sum + (item.price + addonsTotal) * item.quantity;
        }, 0),

      // ── itemCount ───────────────────────────────────────────────────────────

      itemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      // ← spec requires underscore key "dineluxe_cart"
      name: "dineluxe_cart",
      // Use a lazy localStorage getter so the store is safe to import in SSR
      // contexts (Next.js server render, middleware). The actual read/write only
      // happens in the browser after hydration.
      storage: createJSONStorage(() => {
        // In Next.js 15, client components are pre-rendered on the server with a
        // partial window mock where localStorage exists but getItem is NOT a real
        // function. We must verify the API is callable before using it.
        if (
          typeof window !== "undefined" &&
          typeof window.localStorage?.getItem === "function" &&
          typeof window.localStorage?.setItem === "function"
        ) {
          return window.localStorage;
        }
        // Fall back to a no-op shim for SSR / broken environments.
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        } as unknown as Storage;
      }),
      // Prevent Zustand from calling localStorage during SSR initialisation.
      skipHydration: true,
    }
  )
);