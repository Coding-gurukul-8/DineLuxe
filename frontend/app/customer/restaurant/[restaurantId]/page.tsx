"use client";

/**
 * app/customer/restaurant/[restaurantId]/page.tsx
 *
 * Merged from both versions — every deliberate decision annotated.
 *
 * Data flow
 * ─────────
 * GET /restaurants/:restaurantId          → restaurant + branches
 * GET /restaurants/:restaurantId/live-status  → polled every 30 s
 * GET /menu/branch/:branchId              → categorised menu (enabled on menu tab)
 * GET /reviews/restaurant/:restaurantId   → reviews list (enabled on reviews tab)
 * POST /reviews                           → submit new review (customer role only)
 *
 * Cart wiring (ground truth from useCart.ts)
 * ──────────────────────────────────────────
 * CartItem shape  : { id, name, price, quantity, image_url? }
 * addItem()       : (CartItem, restaurantId, branchId)
 * removeItem()    : (id)
 * updateQuantity(): (id, quantity)
 * total()         : () => number                    ← it's a getter function
 * itemCount()     : () => number                    ← it's a getter function
 *
 * FoodCard wiring (ground truth from FoodCard.tsx)
 * ─────────────────────────────────────────────────
 * item prop expects camelCase: { id, name, description, price, discountedPrice?,
 *   photoUrl?, dietaryTags[], allergens[], prepTimeMinutes?, isAvailable, isSoldOut }
 * API returns snake_case  →  normalizeItem() translates before passing to FoodCard
 * onAddToCart(itemId, newQuantity): FoodCard passes the NEW quantity (not a delta)
 */

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { FoodCard } from "@/components/customer/FoodCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  Star, Clock, MapPin, Phone, ChevronLeft,
  Utensils, Info, MessageSquare, Users,
  CheckCircle2, XCircle, Send,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// Raw shape returned by the API (snake_case)
interface RawMenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  discounted_price?: number;
  photo_url?: string;
  dietary_tags?: string[];
  allergens?: string[];
  prep_time_minutes?: number;
  is_available?: boolean;
  is_sold_out?: boolean;
}

// Camelcase shape expected by <FoodCard />
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
  items: RawMenuItem[];   // API delivers raw items inside categories
}

interface MenuData {
  categories: MenuCategory[];
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user: { name: string };
}

type Tab = "menu" | "info" | "reviews";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Translates the snake_case API response into the camelCase shape
 * that <FoodCard /> expects. Without this, photos, dietary tags, etc.
 * all silently come through as undefined.
 */
function normalizeItem(raw: RawMenuItem): MenuItem {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    price: raw.price,
    discountedPrice: raw.discounted_price,
    photoUrl: raw.photo_url,
    dietaryTags: raw.dietary_tags ?? [],
    allergens: raw.allergens ?? [],
    prepTimeMinutes: raw.prep_time_minutes,
    isAvailable: raw.is_available ?? true,
    isSoldOut: raw.is_sold_out ?? false,
  };
}

// ── Star Picker (write review) ────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none"
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
        >
          <Star
            size={28}
            className={cn(
              "transition-colors",
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "fill-gray-100 text-gray-300"
            )}
          />
        </motion.button>
      ))}
    </div>
  );
}

// ── Star Display (read reviews) ───────────────────────────────────────────────

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={cn(
            s <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-gray-100 text-gray-200"
          )}
        />
      ))}
    </div>
  );
}

// ── Reviews Sub-Component ─────────────────────────────────────────────────────

function ReviewsTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const { isAuthenticated, role } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [ratingError, setRatingError] = useState(false);

  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ["reviews", "restaurant", restaurantId],
    queryFn: () => apiClient.get<Review[]>(`/reviews/restaurant/${restaurantId}`),
    enabled: !!restaurantId,
  });

  const submitMutation = useMutation({
    mutationFn: (body: { restaurant_id: string; rating: number; comment?: string }) =>
      apiClient.post("/reviews", body),
    onSuccess: () => {
      // Refetch the reviews list so the new entry appears immediately
      qc.invalidateQueries({ queryKey: ["reviews", "restaurant", restaurantId] });
      toast.success("Review submitted!");
      setShowForm(false);
      setRating(0);
      setComment("");
      setRatingError(false);
    },
    onError: () => toast.error("Failed to submit review"),
  });

  const handleSubmit = () => {
    if (rating === 0) { setRatingError(true); return; }
    setRatingError(false);
    submitMutation.mutate({
      restaurant_id: restaurantId,
      rating,
      comment: comment.trim() || undefined,
    });
  };

  // Only logged-in customers see the "Write a Review" button
  const canReview = isAuthenticated && role === "customer";

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-3">
        <SkeletonCard variant="list-item" count={3} />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Write a review CTA */}
      {canReview && !showForm && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A3C5E] text-white text-sm font-medium hover:bg-[#1A3C5E]/90 transition-colors shadow-sm"
        >
          <Star size={16} className="fill-white" />
          Write a Review
        </motion.button>
      )}

      {/* Review form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4"
          >
            <h3 className="font-semibold text-gray-900 text-sm">Your Review</h3>

            <div>
              <StarPicker value={rating} onChange={(v) => { setRating(v); setRatingError(false); }} />
              {ratingError && (
                <p className="text-xs text-red-500 mt-1">Please select a star rating</p>
              )}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience (optional)"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1A3C5E]/30 resize-none transition"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setRating(0); setComment(""); }}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-[#1A3C5E] text-white text-sm font-medium hover:bg-[#1A3C5E]/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
              >
                {submitMutation.isPending ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Submit
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <MessageSquare size={36} className="text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium text-sm">No reviews yet</p>
          <p className="text-gray-400 text-xs mt-1">Be the first to share your experience!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#1A3C5E]/10 flex items-center justify-center text-xs font-bold text-[#1A3C5E] uppercase">
                    {review.user.name?.charAt(0) ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{review.user.name}</p>
                    <p className="text-xs text-gray-400">{formatDate(review.created_at)}</p>
                  </div>
                </div>
                <StarDisplay rating={review.rating} />
              </div>
              {review.comment && (
                <p className="text-sm text-gray-600 leading-relaxed pl-10">{review.comment}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ restaurantId: string }>;
}

export default function RestaurantDetailPage({ params }: Props) {
  const { restaurantId } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>("menu");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // ── Cart selectors ────────────────────────────────────────────────────────
  // total() and itemCount() are getter functions in CartState, call them with ()
  const cartItems      = useCart((s) => s.items);
  const addItem        = useCart((s) => s.addItem);
  const removeItem     = useCart((s) => s.removeItem);
  const updateQuantity = useCart((s) => s.updateQuantity);  // correct method name
  const cartTotal      = useCart((s) => s.total);           // getter fn, call as cartTotal()
  const cartCount      = useCart((s) => s.itemCount);       // getter fn, call as cartCount()

  // ── Fetch restaurant ──────────────────────────────────────────────────────

  const { data: restaurant, isLoading: restaurantLoading } = useQuery<Restaurant>({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => apiClient.get<Restaurant>(`/restaurants/${restaurantId}`),
    enabled: !!restaurantId,
  });

  // First active branch drives the menu
  const activeBranch =
    restaurant?.branches?.find((b) => b.is_active) ?? restaurant?.branches?.[0];

  // ── Fetch live status (poll every 30 s) ───────────────────────────────────

  const { data: liveStatus } = useQuery<LiveStatus>({
    queryKey: ["restaurant", restaurantId, "live-status"],
    queryFn: () => apiClient.get<LiveStatus>(`/restaurants/${restaurantId}/live-status`),
    enabled: !!restaurantId,
    refetchInterval: 30_000,
  });

  // ── Fetch menu (only when the menu tab is active) ─────────────────────────

  const { data: menuData, isLoading: menuLoading } = useQuery<MenuData>({
    queryKey: ["menu", "branch", activeBranch?.id],
    queryFn: () => apiClient.get<MenuData>(`/menu/branch/${activeBranch!.id}`),
    enabled: !!activeBranch?.id && activeTab === "menu",
  });

  const categories = menuData?.categories ?? [];
  const selectedCat = activeCategoryId ?? categories[0]?.id ?? null;

  // ── Cart helpers ──────────────────────────────────────────────────────────

  // Returns how many of this item are in the cart (keyed by menu item id)
  const getItemQty = useCallback(
    (itemId: string) =>
      cartItems.find((ci) => ci.id === itemId)?.quantity ?? 0,
    [cartItems]
  );

  /**
   * Called by FoodCard with (itemId, newQuantity).
   * FoodCard already computes the new qty (current ± 1), so we receive the
   * target quantity — we do not add a delta here.
   *
   * normalizedItem.id === the API item id === CartItem.id, so using item.id
   * as the removeItem / updateQuantity key is correct.
   */
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
            quantity: newQty,
            image_url: item.photoUrl,
          },
          restaurantId,
          activeBranch?.id ?? null
        );
      } else {
        updateQuantity(item.id, newQty);
      }
    },
    [cartItems, addItem, removeItem, updateQuantity, restaurantId, activeBranch]
  );

  // ── Loading state ─────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

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
            style={{ background: "linear-gradient(135deg, #1a3c5e 0%, #e8a020 100%)" }}
          />
        )}

        {/* Back button */}
        <Link
          href="/customer/home"
          className="absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow"
        >
          <ChevronLeft size={20} className="text-gray-700" />
        </Link>

        {/* Live status pill — CheckCircle2/XCircle from Document version */}
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
              {liveStatus.is_open ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
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

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="flex items-center gap-1 text-sm font-semibold text-amber-600">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            {restaurant.avg_rating?.toFixed(1) ?? "—"}
            <span className="text-gray-400 font-normal text-xs">
              ({restaurant.total_reviews?.toLocaleString("en-IN")} reviews)
            </span>
          </span>

          {liveStatus?.is_open && liveStatus.wait_minutes > 0 && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <Clock size={13} />
              ~{liveStatus.wait_minutes} min wait
            </span>
          )}

          {liveStatus?.is_open && liveStatus.queue_length > 0 && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <Users size={13} />
              {liveStatus.queue_length} in queue
            </span>
          )}
        </div>

        {restaurant.description && (
          <p className="text-sm text-gray-500 mt-2 line-clamp-2">{restaurant.description}</p>
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
                {/* Category horizontal nav — scrollIntoView from Document version */}
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
                        {/* Item count badge from Document version */}
                        <span className="ml-2 text-xs text-gray-400 font-normal">
                          ({cat.items.length})
                        </span>
                      </h2>
                      <div className="space-y-3">
                        {cat.items.map((rawItem) => {
                          // normalizeItem() is essential — without it FoodCard
                          // receives photo_url instead of photoUrl, dietary_tags
                          // instead of dietaryTags, etc. (all undefined)
                          const item = normalizeItem(rawItem);
                          return (
                            <FoodCard
                              key={item.id}
                              item={item}
                              quantity={getItemQty(item.id)}
                              onAddToCart={(_itemId, newQty) =>
                                handleCartUpdate(item, newQty)
                              }
                            />
                          );
                        })}
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
                    <span>{branch.opening_time} – {branch.closing_time}</span>
                  </div>
                )}

                {/* StatusBadge from Document version */}
                <StatusBadge
                  status={branch.is_active ? "active" : "inactive"}
                  size="sm"
                />
              </div>
            ))}
          </motion.div>
        )}

        {/* ── REVIEWS TAB — fully wired, from our version ── */}
        {activeTab === "reviews" && (
          <motion.div
            key="reviews"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <ReviewsTab restaurantId={restaurantId} />
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
                {/* formatCurrency from Document version — not hardcoded ₹ */}
                <span className="text-sm font-bold">{formatCurrency(cartTotal())}</span>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}