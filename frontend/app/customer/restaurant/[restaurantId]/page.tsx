"use client";

/**
 * app/customer/restaurant/[restaurantId]/page.tsx
 *
 * Replaces the old stub (which only showed a CustomerTableSelector and nothing else).
 *
 * Features
 * ─────────
 * • GET /restaurants/:restaurantId         → restaurant data + branches
 * • GET /restaurants/:restaurantId/live-status  → refetched every 30 s
 * • GET /menu/branch/:branchId             → full categorised menu
 * • Tab bar: Menu | Info | Reviews
 * • "Add to cart" on FoodCard calls useCart.addItem
 * • Cart FAB when cart has items
 */

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useCart } from "@/hooks/useCart";
import { FoodCard } from "@/components/customer/FoodCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Star,
  Clock,
  MapPin,
  Phone,
  ChevronLeft,
  ShoppingCart,
  Utensils,
  Info,
  MessageSquare,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone?: string;
  lat: number;
  lng: number;
  opening_time?: string;
  closing_time?: string;
  is_active: boolean;
}

interface Restaurant {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  cuisine_type?: string;
  avg_rating: number;
  total_reviews: number;
  branches: Branch[];
}

interface LiveStatus {
  is_open: boolean;
  queue_length: number;
  wait_minutes: number;
}

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

type Tab = "menu" | "info" | "reviews";

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ restaurantId: string }>;
}

export default function RestaurantDetailPage({ params }: Props) {
  const { restaurantId } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>("menu");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Cart state
  const cartItems      = useCart((s) => s.items);
  const addItem        = useCart((s) => s.addItem);
  const removeItem     = useCart((s) => s.removeItem);
  // FIX C: CartState exposes updateQuantity, not updateQty
  const updateQuantity = useCart((s) => s.updateQuantity);
  const cartTotal      = useCart((s) => s.total);
  const cartCount      = useCart((s) => s.itemCount);

  // ── Fetch restaurant ─────────────────────────────────────────────────────────

  const {
    data: restaurant,
    isLoading: restaurantLoading,
  } = useQuery<Restaurant>({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => apiClient.get<Restaurant>(`/restaurants/${restaurantId}`),
    enabled: !!restaurantId,
  });

  // First active branch drives the menu
  const activeBranch =
    restaurant?.branches?.find((b) => b.is_active) ??
    restaurant?.branches?.[0];

  // ── Fetch live status (poll every 30 s) ─────────────────────────────────────

  const { data: liveStatus } = useQuery<LiveStatus>({
    queryKey: ["restaurant", restaurantId, "live-status"],
    queryFn: () =>
      apiClient.get<LiveStatus>(`/restaurants/${restaurantId}/live-status`),
    enabled: !!restaurantId,
    refetchInterval: 30_000,
  });

  // ── Fetch menu ───────────────────────────────────────────────────────────────

  const { data: menuData, isLoading: menuLoading } = useQuery<MenuData>({
    queryKey: ["menu", "branch", activeBranch?.id],
    queryFn: () =>
      apiClient.get<MenuData>(`/menu/branch/${activeBranch!.id}`),
    enabled: !!activeBranch?.id,
  });

  const categories = menuData?.categories ?? [];

  // Default the sticky nav to the first category
  const selectedCat =
    activeCategoryId ?? categories[0]?.id ?? null;

  // ── Cart helpers ─────────────────────────────────────────────────────────────

  // FIX D: CartItem key is "menuItemId", not "id"
  const getItemQty = useCallback(
    (itemId: string) =>
      cartItems.find((ci) => ci.menuItemId === itemId)?.quantity ?? 0,
    [cartItems]
  );

  const handleCartUpdate = useCallback(
    (item: MenuItem, newQty: number) => {
      if (newQty <= 0) {
        removeItem(item.id);
        return;
      }
      // FIX D: CartItem key is "menuItemId", not "id"
      const inCart = cartItems.find((ci) => ci.menuItemId === item.id);
      if (!inCart) {
        // FIX A: CartItem shape is { menuItemId, photoUrl }, not { id, image_url }
        addItem(
          {
            menuItemId: item.id,
            name: item.name,
            price: item.discountedPrice ?? item.price,
            quantity: 1,
            photoUrl: item.photoUrl,
          },
          restaurantId,
          activeBranch?.id ?? null
        );
      } else {
        // FIX C: method is updateQuantity, not updateQty
        updateQuantity(item.id, newQty);
      }
    },
    [cartItems, addItem, removeItem, updateQuantity, restaurantId, activeBranch]
  );

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (restaurantLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-56 bg-gray-200 animate-pulse" />
        <div className="px-4 py-4 space-y-4">
          <SkeletonCard variant="text" />
          <SkeletonCard variant="card" count={3} />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Restaurant not found.</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* ── Hero / Banner ── */}
      <div className="relative">
        {restaurant.banner_url ? (
          <img
            src={restaurant.banner_url}
            alt={restaurant.name}
            className="w-full h-56 object-cover"
          />
        ) : (
          <div
            className="w-full h-56"
            style={{
              background:
                "linear-gradient(135deg, #1a3c5e 0%, #e8a020 100%)",
            }}
          />
        )}

        {/* Back button */}
        <Link
          href="/customer/home"
          className="absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow"
        >
          <ChevronLeft size={20} className="text-gray-700" />
        </Link>

        {/* Live status pill */}
        {liveStatus && (
          <div className="absolute top-4 right-4">
            <span
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow backdrop-blur-sm",
                liveStatus.is_open
                  ? "bg-green-500/90 text-white"
                  : "bg-red-500/90 text-white"
              )}
            >
              {liveStatus.is_open ? (
                <CheckCircle2 size={12} />
              ) : (
                <XCircle size={12} />
              )}
              {liveStatus.is_open ? "Open" : "Closed"}
            </span>
          </div>
        )}

        {/* Logo */}
        {restaurant.logo_url && (
          <div className="absolute -bottom-8 left-4 w-16 h-16 rounded-2xl border-2 border-white shadow-md overflow-hidden bg-white">
            <img
              src={restaurant.logo_url}
              alt={`${restaurant.name} logo`}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* ── Restaurant Info ── */}
      <div className="px-4 pt-12 pb-4 bg-white border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">{restaurant.name}</h1>
        {restaurant.cuisine_type && (
          <p className="text-sm text-gray-500 mt-0.5">{restaurant.cuisine_type}</p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {/* Rating */}
          <span className="flex items-center gap-1 text-sm font-semibold text-amber-600">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            {restaurant.avg_rating?.toFixed(1) ?? "—"}
            <span className="text-gray-400 font-normal text-xs">
              ({restaurant.total_reviews?.toLocaleString("en-IN")} reviews)
            </span>
          </span>

          {/* Wait time */}
          {liveStatus?.is_open && liveStatus.wait_minutes > 0 && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <Clock size={13} />
              ~{liveStatus.wait_minutes} min wait
            </span>
          )}

          {/* Queue */}
          {liveStatus?.is_open && liveStatus.queue_length > 0 && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <Users size={13} />
              {liveStatus.queue_length} in queue
            </span>
          )}
        </div>

        {restaurant.description && (
          <p className="text-sm text-gray-500 mt-2 line-clamp-2">
            {restaurant.description}
          </p>
        )}
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex bg-white border-b border-gray-100 sticky top-0 z-30">
        {(
          [
            { key: "menu",    label: "Menu",    icon: Utensils },
            { key: "info",    label: "Info",    icon: Info },
            { key: "reviews", label: "Reviews", icon: MessageSquare },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === key
                ? "border-[#1A3C5E] text-[#1A3C5E]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {/* ── MENU TAB ── */}
        {activeTab === "menu" && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {menuLoading ? (
              <div className="px-4 py-4 space-y-4">
                <SkeletonCard variant="card" count={4} />
              </div>
            ) : categories.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                Menu not available
              </div>
            ) : (
              <>
                {/* Category horizontal nav */}
                <div className="sticky top-[49px] z-20 bg-white border-b border-gray-100 px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-hide">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategoryId(cat.id);
                        document
                          .getElementById(`cat-${cat.id}`)
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                        selectedCat === cat.id
                          ? "bg-[#1A3C5E] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Category sections */}
                <div className="px-4 py-4 space-y-8">
                  {categories.map((cat) => (
                    <section key={cat.id} id={`cat-${cat.id}`}>
                      <h2 className="text-base font-bold text-gray-900 mb-3">
                        {cat.name}
                        <span className="ml-2 text-xs text-gray-400 font-normal">
                          ({cat.items.length})
                        </span>
                      </h2>
                      <div className="space-y-3">
                        {cat.items.map((item) => (
                          <FoodCard
                            key={item.id}
                            item={item}
                            quantity={getItemQty(item.id)}
                            onAddToCart={(_, newQty) =>
                              handleCartUpdate(item, newQty)
                            }
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── INFO TAB ── */}
        {activeTab === "info" && (
          <motion.div
            key="info"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-4 py-6 space-y-5"
          >
            {restaurant.branches?.map((branch) => (
              <div
                key={branch.id}
                className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-3"
              >
                <h3 className="font-semibold text-gray-900">{branch.name}</h3>

                {branch.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin size={15} className="text-gray-400 shrink-0 mt-0.5" />
                    <span>{branch.address}, {branch.city}</span>
                  </div>
                )}

                {branch.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone size={15} className="text-gray-400 shrink-0" />
                    <a href={`tel:${branch.phone}`} className="text-[#1A3C5E]">
                      {branch.phone}
                    </a>
                  </div>
                )}

                {branch.opening_time && branch.closing_time && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock size={15} className="text-gray-400 shrink-0" />
                    <span>
                      {branch.opening_time} – {branch.closing_time}
                    </span>
                  </div>
                )}

                <StatusBadge
                  status={branch.is_active ? "active" : "inactive"}
                  size="sm"
                />
              </div>
            ))}
          </motion.div>
        )}

        {/* ── REVIEWS TAB ── */}
        {activeTab === "reviews" && (
          <motion.div
            key="reviews"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-4 py-12 text-center"
          >
            <MessageSquare size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Reviews coming soon.</p>
            <p className="text-xs text-gray-400 mt-1">
              {restaurant.total_reviews} reviews • avg {restaurant.avg_rating?.toFixed(1)} ★
            </p>
          </motion.div>
        )}
      </AnimatePresence>

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
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full text-xs font-bold">
                    {cartCount()}
                  </span>
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