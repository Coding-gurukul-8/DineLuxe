"use client";

/**
 * app/customer/menu/page.tsx  — standalone menu (QR / direct link)
 *
 * Fixes vs. old implementation
 * ──────────────────────────────
 * 1. Wrong endpoint: was hitting /menu/branch/:id/categories and
 *    /menu/branch/:id/items separately. Spec says GET /menu/branch/:branchId
 *    returns { categories:[{id,name,items:[...]}] } — one fetch for everything.
 * 2. branchId resolution order: useAuth().branchId → ?branchId= query param
 *    → cart store branchId (fallback). Old code only checked the cart store.
 * 3. Category filter was never wired — buttons had no active styling and
 *    no onClick handler. Fixed with proper state and scroll-to-section.
 * 4. Quantity controls (Add / Remove) now call useCart instead of doing nothing.
 * 5. Cart FAB added — item count + running total, links to /customer/order/cart.
 */

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { FoodCard } from "@/components/customer/FoodCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, cn } from "@/lib/utils";
import { Search, SlidersHorizontal, ShoppingCart } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  discountedPrice?: number;
  photoUrl?: string;
  dietaryTags: string[];
  allergens: string[];
  prepTimeMinutes?: number;
  isAvailable: boolean;
  isSoldOut: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

interface MenuData {
  categories: MenuCategory[];
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CustomerMenuPage() {
  const { branchId: authBranchId, restaurantId } = useAuth();
  const searchParams = useSearchParams();

  // branchId resolution priority:
  // 1. logged-in user's branch (most reliable — they're physically here)
  // 2. ?branchId= query param (QR code link)
  // 3. whatever the cart already has (fallback for repeat visits)
  const cartBranchId = useCart((s) => s.branchId);
  const branchId =
    authBranchId ??
    searchParams.get("branchId") ??
    cartBranchId ??
    "";

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Cart actions
  const cartItems  = useCart((s) => s.items);
  const addItem    = useCart((s) => s.addItem);
  const removeItem = useCart((s) => s.removeItem);
  const updateQty  = useCart((s) => s.updateQty);
  const cartTotal  = useCart((s) => s.total);
  const cartCount  = useCart((s) => s.itemCount);

  // ── Fetch full menu (single request) ────────────────────────────────────────
  // GET /menu/branch/:branchId  → { categories:[{id,name,items:[...]}] }

  const { data: menuData, isLoading } = useQuery<MenuData>({
    queryKey: ["menu", "branch", branchId],
    queryFn: () => apiClient.get<MenuData>(`/menu/branch/${branchId}`),
    enabled: !!branchId,
    staleTime: 2 * 60_000,
  });

  const categories = menuData?.categories ?? [];

  // Derive flat item list for search
  const allItems = categories.flatMap((c) => c.items);

  // Search filter (client-side, instant)
  const filteredCategories = searchQuery.trim()
    ? categories
        .map((cat) => ({
          ...cat,
          items: cat.items.filter(
            (item) =>
              item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.description?.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((cat) => cat.items.length > 0)
    : categories;

  // Which category section is "active" for the sticky nav
  const selectedCatId = activeCategoryId ?? categories[0]?.id ?? null;

  // ── Cart helpers ─────────────────────────────────────────────────────────────

  const getItemQty = useCallback(
    (itemId: string) => cartItems.find((ci) => ci.id === itemId)?.quantity ?? 0,
    [cartItems]
  );

  const handleCartUpdate = useCallback(
    (item: MenuItem, newQty: number) => {
      if (newQty <= 0) {
        removeItem(item.id);
        return;
      }
      const inCart = cartItems.find((ci) => ci.id === item.id);
      if (!inCart) {
        addItem(
          {
            id: item.id,
            name: item.name,
            price: item.discountedPrice ?? item.price,
            quantity: 1,
            image_url: item.photoUrl ?? null,
          },
          restaurantId ?? null,
          branchId || null
        );
      } else {
        updateQty(item.id, newQty);
      }
    },
    [cartItems, addItem, removeItem, updateQty, restaurantId, branchId]
  );

  // ── Empty / no-branch guard ───────────────────────────────────────────────────

  if (!branchId) {
    return (
      <PageWrapper title="Menu">
        <EmptyState
          variant="menu"
          title="No branch selected"
          message="Scan the QR code at your table to view the menu."
        />
      </PageWrapper>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <PageWrapper title="Menu" subtitle="Browse our full menu">
        {/* ── Search bar ── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search menu…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:border-[#1A3C5E] focus:ring-2 focus:ring-[#1A3C5E]/20 outline-none transition-all text-sm"
            />
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <SlidersHorizontal size={18} />
          </motion.button>
        </div>

        {/* ── Sticky category nav ── */}
        {!isLoading && categories.length > 0 && (
          <div className="sticky top-0 z-20 -mx-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
              {categories.map((cat) => (
                <motion.button
                  key={cat.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setActiveCategoryId(cat.id);
                    document
                      .getElementById(`menu-cat-${cat.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                    selectedCatId === cat.id
                      ? "bg-[#1A3C5E] text-white"
                      : "bg-white text-gray-600 border border-gray-200 hover:border-[#1A3C5E]/40"
                  )}
                >
                  {cat.name}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {isLoading && (
          <div className="space-y-4 mt-2">
            <SkeletonCard variant="card" count={4} />
          </div>
        )}

        {/* ── Empty / no results ── */}
        {!isLoading && allItems.length === 0 && (
          <EmptyState
            variant="menu"
            title="Menu unavailable"
            message="This branch hasn't added any items yet."
          />
        )}

        {!isLoading && allItems.length > 0 && filteredCategories.length === 0 && (
          <EmptyState
            variant="search"
            title="No items found"
            message={`No menu items match "${searchQuery}".`}
          />
        )}

        {/* ── Category sections ── */}
        {!isLoading && filteredCategories.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={searchQuery}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-8 mt-2"
            >
              {filteredCategories.map((cat) => (
                <section key={cat.id} id={`menu-cat-${cat.id}`}>
                  {/* Category header */}
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-base font-bold text-gray-900">
                      {cat.name}
                    </h2>
                    <span className="text-xs text-gray-400">
                      ({cat.items.length})
                    </span>
                  </div>

                  {/* Item list */}
                  <div className="space-y-3">
                    {cat.items.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                      >
                        <FoodCard
                          item={item}
                          quantity={getItemQty(item.id)}
                          onAddToCart={(_, newQty) =>
                            handleCartUpdate(item, newQty)
                          }
                        />
                      </motion.div>
                    ))}
                  </div>
                </section>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </PageWrapper>

      {/* ── Cart FAB ── */}
      <AnimatePresence>
        {cartCount() > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-40"
          >
            <Link href="/customer/order/cart">
              <div className="flex items-center justify-between bg-[#1A3C5E] text-white px-5 py-3.5 rounded-2xl shadow-xl">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <ShoppingCart size={18} />
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 bg-amber-400 text-[#1A3C5E] text-[9px] font-bold rounded-full">
                      {cartCount()}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">View Cart</span>
                </div>
                <span className="text-sm font-bold">
                  {formatCurrency(cartTotal())}
                </span>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}