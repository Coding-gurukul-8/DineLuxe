"use client";

/**
 * useCart — Zustand-persisted shopping cart
 *
 * SSR Safety Fix
 * ──────────────
 * createJSONStorage(factory) calls the factory IMMEDIATELY when the Zustand
 * store is created (i.e. at module-load time). In Next.js 15 SSR, this runs
 * on the server where window.localStorage exists as a partial mock but
 * getItem/setItem are NOT real functions, causing:
 *   TypeError: localStorage.getItem is not a function
 *
 * Fix: use a lazy proxy storage object whose methods only access
 * window.localStorage at call time (inside useEffect / client interactions),
 * never at module initialisation time. Combined with skipHydration: true,
 * the persist middleware never calls these during SSR.
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

// ── SSR-safe lazy storage proxy ────────────────────────────────────────────────
//
// createJSONStorage(fn) invokes fn() immediately at store-creation time, which
// happens during module import — potentially on the server. Instead of passing
// a factory that reads window.localStorage right away, we pass a proxy whose
// methods resolve localStorage lazily (at call time). During SSR, skipHydration
// ensures these methods are never actually called; on the client they work
// normally. This avoids "localStorage.getItem is not a function" during Next.js
// server-side pre-rendering.
const lazyLocalStorage: Storage = new Proxy({} as Storage, {
  get(_target, prop: string) {
    if (typeof window === "undefined") {
      // SSR: return no-op stubs — should never be called with skipHydration
      if (prop === "getItem") return () => null;
      if (prop === "setItem") return () => {};
      if (prop === "removeItem") return () => {};
      if (prop === "clear") return () => {};
      if (prop === "key") return () => null;
      if (prop === "length") return 0;
      return undefined;
    }
    // Client: delegate to the real localStorage
    const val = (window.localStorage as any)[prop];
    return typeof val === "function" ? val.bind(window.localStorage) : val;
  },
});

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
      name: "dineluxe_cart",
      // Pass the lazy proxy through createJSONStorage. The factory fn is called
      // immediately, but it just returns our proxy object — no localStorage
      // access happens at this point.
      storage: createJSONStorage(() => lazyLocalStorage),
      // Prevent Zustand from calling storage.getItem during SSR initialisation.
      skipHydration: true,
    }
  )
);