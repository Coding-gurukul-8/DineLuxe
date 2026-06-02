"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
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
  Utensils, Info, MessageSquare,
  CheckCircle2, XCircle, Send, ShoppingCart,
  Calendar, Users,
  // INTEGRATION ADDITION: New icons for allergen warning and pricing badge
  AlertTriangle, Flame, Tag,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Branch {
  id: string; name: string; address: string; city: string;
  phone?: string; lat: number; lng: number;
  opening_time?: string; closing_time?: string; is_active: boolean;
}
interface Restaurant {
  id: string; name: string; description?: string;
  logo_url?: string; banner_url?: string; cuisine_type?: string;
  avg_rating: number; total_reviews: number; branches: Branch[];
}
interface LiveStatus { is_open: boolean; queue_length: number; }
interface MenuItemRaw {
  id: string; name: string; description?: string; price: number;
  discounted_price?: number; photo_url?: string; dietary_tags?: string[];
  allergens?: string[]; prep_time_minutes?: number;
  is_available: boolean; is_sold_out?: boolean;
}
interface MenuCategory { id: string; name: string; display_order: number; items: MenuItemRaw[]; }
interface ReviewItem {
  id: string; rating: number; comment?: string; created_at: string;
  user?: { name?: string | null; profile_pic_url?: string | null };
}

// INTEGRATION ADDITION: Dynamic pricing rule type from /api/v1/dynamic-pricing/branch/:branchId/active
interface DynamicPricingRule {
  id: string;
  menu_item_id: string;
  label: string;           // e.g. "Happy Hour"
  discount_percent: number; // e.g. 20
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

// INTEGRATION ADDITION: Dietary profile shape from localStorage / context
interface LocalDietaryProfile {
  preferences: string[];  // e.g. ["vegan", "halal"]
  allergies: string[];    // e.g. ["nuts", "dairy"]
}

function normalizeItem(raw: MenuItemRaw) {
  return {
    id: raw.id, name: raw.name, description: raw.description, price: raw.price,
    discountedPrice: raw.discounted_price, photoUrl: raw.photo_url,
    dietaryTags: raw.dietary_tags ?? [], allergens: raw.allergens ?? [],
    prepTimeMinutes: raw.prep_time_minutes, isAvailable: raw.is_available,
    isSoldOut: raw.is_sold_out ?? false,
  };
}

// INTEGRATION ADDITION: Load dietary profile from localStorage (persisted by DietaryProfile component)
function loadLocalDietaryProfile(): LocalDietaryProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("dietary_profile");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalDietaryProfile;
    if (Array.isArray(parsed.allergies)) return parsed;
    return null;
  } catch {
    return null;
  }
}

// INTEGRATION ADDITION: Human-readable allergen label map
const ALLERGEN_LABELS: Record<string, string> = {
  nuts: "Nuts",
  dairy: "Dairy",
  gluten: "Gluten",
  eggs: "Eggs",
  soy: "Soy",
  shellfish: "Shellfish",
  fish: "Fish",
};

// INTEGRATION ADDITION: AllergenWarningIcon — small inline warning shown on items
// that overlap with the user's personal allergy list.
function AllergenWarningIcon({ overlapping }: { overlapping: string[] }) {
  if (overlapping.length === 0) return null;
  const label = overlapping
    .map((k) => ALLERGEN_LABELS[k] ?? k)
    .join(", ");
  return (
    <div
      className="group relative inline-flex items-center"
      title={`Contains: ${label}`}
      aria-label={`Allergen warning: Contains ${label}`}
    >
      {/* ⚠️ icon badge */}
      <span className="inline-flex items-center gap-0.5 bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full cursor-default select-none">
        <AlertTriangle size={9} className="shrink-0" />
        {overlapping.length === 1
          ? (ALLERGEN_LABELS[overlapping[0]] ?? overlapping[0])
          : `${overlapping.length} allergens`}
      </span>
      {/* Tooltip on hover */}
      <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 hidden group-hover:block
        bg-gray-900 text-white text-[10px] font-medium rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
        ⚠️ Contains: {label}
      </span>
    </div>
  );
}

// INTEGRATION ADDITION: DynamicPricingBadge — amber "Happy Hour" badge shown
// when a menu item has an active dynamic pricing rule right now.
function DynamicPricingBadge({
  rule,
  originalPrice,
}: {
  rule: DynamicPricingRule;
  originalPrice: number;
}) {
  const discounted = originalPrice * (1 - rule.discount_percent / 100);
  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      {/* Badge */}
      <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
        <Flame size={9} className="fill-amber-500 text-amber-500" />
        🔥 {rule.label} — {rule.discount_percent}% off
      </span>
      {/* Prices */}
      <span className="text-gray-400 line-through text-xs">
        {formatCurrency(originalPrice)}
      </span>
      <span className="text-amber-600 font-bold text-sm">
        {formatCurrency(discounted)}
      </span>
    </div>
  );
}

// ── Animated star rating ──────────────────────────────────────────────────────

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });
  return (
    <div ref={ref} className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 400, damping: 18 }}
        >
          <Star
            size={14}
            className={i < Math.floor(rating) ? "text-[#E8A020] fill-[#E8A020]" : "text-gray-200 fill-gray-200"}
          />
        </motion.div>
      ))}
    </div>
  );
}

// ── Reviews tab ───────────────────────────────────────────────────────────────

function ReviewsTab({ restaurantId, role }: { restaurantId: string; role: string | null }) {
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const qc = useQueryClient();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews", restaurantId],
    queryFn: () => apiClient.get<ReviewItem[]>(`/reviews/restaurant/${restaurantId}`),
  });

  const { mutate: submitReview, isPending } = useMutation({
    mutationFn: () => apiClient.post("/reviews", { restaurant_id: restaurantId, rating, comment }),
    onSuccess: () => {
      toast.success("Review submitted!");
      setComment(""); setRating(0);
      qc.invalidateQueries({ queryKey: ["reviews", restaurantId] });
    },
    onError: () => toast.error("Could not submit review"),
  });

  const { ref: listRef, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Write review */}
      {role === "customer" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#FAF7F4] rounded-2xl p-4 space-y-3"
        >
          <p className="text-sm font-bold text-gray-800">Share your experience</p>
          <div className="flex gap-1">
            {[1,2,3,4,5].map((s) => (
              <motion.button
                key={s} whileTap={{ scale: 1.3 }}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(s)}
              >
                <Star
                  size={24}
                  className={(hover || rating) >= s ? "text-[#E8A020] fill-[#E8A020]" : "text-gray-200 fill-gray-200"}
                />
              </motion.button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us what you loved…"
            rows={3}
            className="w-full text-sm bg-white rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E8A020]/40 resize-none"
          />
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => submitReview()}
            disabled={isPending || rating === 0}
            className="flex items-center gap-2 bg-[#1A3C5E] text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-opacity"
          >
            {isPending ? <span className="animate-spin border-2 border-white/30 border-t-white rounded-full w-4 h-4" /> : <Send size={14} />}
            Submit Review
          </motion.button>
        </motion.div>
      )}

      {/* Review list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((n) => <div key={n} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <motion.div
          ref={listRef}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          className="space-y-4"
        >
          {reviews.map((review) => (
            <motion.div
              key={review.id}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260 } } }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{review.user?.name ?? "Guest"}</p>
                  <p className="text-xs text-gray-400">{formatDate(review.created_at)}</p>
                </div>
                <StarRating rating={review.rating} />
              </div>
              {review.comment && <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>}
            </motion.div>
          ))}
          {reviews.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No reviews yet. Be the first!</p>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { params: Promise<{ restaurantId: string }> }

export default function RestaurantPage({ params }: Props) {
  const { restaurantId } = use(params);
  const { role } = useAuth();
  const addItem = useCart((s) => s.addItem);
  const cartItems = useCart((s) => s.items);
  const cartTotal = useCart((s) => s.total);
  const cartCount = useCart((s) => s.itemCount);

  const [activeTab, setActiveTab] = useState<"menu" | "info" | "reviews">("menu");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // INTEGRATION ADDITION: Load customer dietary profile from localStorage on mount
  const [dietaryProfile, setDietaryProfile] = useState<LocalDietaryProfile | null>(null);
  useEffect(() => {
    setDietaryProfile(loadLocalDietaryProfile());
  }, []);

  // Parallax scroll
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const imgY = useTransform(scrollY, [0, 300], [0, 80]);
  const heroOpacity = useTransform(scrollY, [0, 200], [1, 0]);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: restaurant, isLoading: restLoading } = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => apiClient.get<Restaurant>(`/restaurants/${restaurantId}`),
  });

  const { data: liveStatus } = useQuery({
    queryKey: ["restaurant", restaurantId, "live"],
    queryFn: () => apiClient.get<LiveStatus>(`/restaurants/${restaurantId}/live-status`),
    refetchInterval: 30_000,
    enabled: !!restaurant,
  });

  const branchId = restaurant?.branches?.[0]?.id;

  const { data: menuData = [], isLoading: menuLoading } = useQuery({
    queryKey: ["menu", branchId],
    queryFn: () => apiClient.get<MenuCategory[]>(`/menu/branch/${branchId}`),
    enabled: !!branchId && activeTab === "menu",
  });

  // INTEGRATION ADDITION: Fetch active dynamic pricing rules for the branch.
  // Runs alongside the menu query when the menu tab is active.
  const { data: activePricingRules = [] } = useQuery<DynamicPricingRule[]>({
    queryKey: ["dynamic-pricing", branchId, "active"],
    queryFn: () =>
      apiClient.get<DynamicPricingRule[]>(
        `/dynamic-pricing/branch/${branchId}/active`
      ),
    enabled: !!branchId && activeTab === "menu",
    // Refresh every 2 minutes so the badge disappears when happy hour ends
    refetchInterval: 2 * 60 * 1000,
    // Silently ignore 404s – the endpoint may not exist on all deployments
    retry: false,
  });

  // INTEGRATION ADDITION: Build a lookup map { menuItemId → DynamicPricingRule }
  // for O(1) access inside CategorySection.
  const pricingByItemId = useCallback((): Map<string, DynamicPricingRule> => {
    const map = new Map<string, DynamicPricingRule>();
    for (const rule of activePricingRules) {
      if (rule.is_active) map.set(rule.menu_item_id, rule);
    }
    return map;
  }, [activePricingRules]);

  const categories = [...menuData].sort((a, b) => a.display_order - b.display_order);
  const selectedCat = activeCategoryId ?? categories[0]?.id ?? null;

  // INTEGRATION ADDITION: CategorySection now receives pricingMap and
  // dietaryProfile to render badges and allergen warnings per item.
  function CategorySection({
    cat,
    selectedCat,
    getItemQty,
    handleCartUpdate,
    pricingMap,
    userAllergies,
  }: {
    cat: MenuCategory;
    selectedCat: string | null;
    getItemQty: (id: string) => number;
    handleCartUpdate: (item: ReturnType<typeof normalizeItem>, newQty: number) => void;
    // INTEGRATION ADDITION: props for new features
    pricingMap: Map<string, DynamicPricingRule>;
    userAllergies: string[];
  }) {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 });
    return (
      <section key={cat.id} id={`cat-${cat.id}`} ref={ref}>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-bold text-gray-900">{cat.name}</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{cat.items.length}</span>
        </div>
        <motion.div
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          className="space-y-3"
        >
          {cat.items.map((rawItem) => {
            const item = normalizeItem(rawItem);

            // INTEGRATION ADDITION: Check for active dynamic pricing rule
            const pricingRule = pricingMap.get(item.id) ?? null;

            // INTEGRATION ADDITION: Find allergen overlap between item and user profile
            const overlappingAllergens = userAllergies.filter((a) =>
              item.allergens.includes(a)
            );

            return (
              <motion.div
                key={item.id}
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260 } } }}
              >
                {/* INTEGRATION ADDITION: Wrapper adds allergen border highlight and badges */}
                <div className={cn(
                  "relative rounded-2xl transition-all",
                  overlappingAllergens.length > 0 && "ring-1 ring-red-200"
                )}>
                  {/* INTEGRATION ADDITION: Allergen warning strip at top of card */}
                  {overlappingAllergens.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-red-50 rounded-t-2xl px-3 py-1.5 border-b border-red-100">
                      <AlertTriangle size={11} className="text-red-500 shrink-0" />
                      <span className="text-[10px] font-semibold text-red-600">
                        Contains allergens you've flagged:
                      </span>
                      <AllergenWarningIcon overlapping={overlappingAllergens} />
                    </div>
                  )}

                  <FoodCard
                    item={item}
                    quantity={getItemQty(item.id)}
                    onAddToCart={(_id, newQty) => handleCartUpdate(item, newQty)}
                  />

                  {/* INTEGRATION ADDITION: Dynamic pricing badge rendered below the
                      FoodCard (inside the same card wrapper) when a rule is active */}
                  {pricingRule && (
                    <div className="px-4 pb-3 -mt-1">
                      <DynamicPricingBadge
                        rule={pricingRule}
                        originalPrice={item.price}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>
    );
  }

  function getItemQty(itemId: string) {
    return cartItems.find((i) => i.id === itemId)?.quantity ?? 0;
  }

  function handleCartUpdate(item: ReturnType<typeof normalizeItem>, newQty: number) {
    if (newQty <= 0) {
      useCart.getState().removeItem(item.id);
      return;
    }
    addItem(
      { id: item.id, name: item.name, price: item.price, quantity: newQty, image_url: item.photoUrl },
      restaurant?.id, branchId
    );
  }

  if (restLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F4]">
        <div className="h-56 bg-gray-200 animate-pulse" />
        <div className="px-4 py-6 space-y-4">
          {[1,2,3].map((n) => <div key={n} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }
  if (!restaurant) return null;

  const branch = restaurant.branches?.[0];

  // INTEGRATION ADDITION: Resolve user allergies from loaded profile (safe empty fallback)
  const userAllergies = dietaryProfile?.allergies ?? [];

  // INTEGRATION ADDITION: Materialise the pricing map once per render
  const pricingMap = pricingByItemId();

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-32">

      {/* ── Parallax Hero ─────────────────────────────────────────────── */}
      <div ref={heroRef} className="relative h-64 overflow-hidden">
        <motion.div style={{ y: imgY }} className="absolute inset-0 h-[120%]">
          {restaurant.banner_url ? (
            <img src={restaurant.banner_url} alt={restaurant.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-linear-to-br from-[#1A3C5E] via-[#2A5C8E] to-[#E8A020]/60" />
          )}
        </motion.div>
        {/* gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />

        {/* Back button */}
        <motion.div style={{ opacity: heroOpacity }} className="absolute top-12 left-4 z-10">
          <Link href="/customer/home">
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
            >
              <ChevronLeft size={20} className="text-white" />
            </motion.div>
          </Link>
        </motion.div>

        {/* Hero content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="absolute bottom-4 left-4 right-4"
        >
          <h1 className="text-2xl font-bold text-white mb-1">{restaurant.name}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            {restaurant.cuisine_type && (
              <span className="text-white/80 text-xs">{restaurant.cuisine_type}</span>
            )}
            <div className="flex items-center gap-1">
              <Star size={12} className="text-[#E8A020] fill-[#E8A020]" />
              <span className="text-white text-xs font-semibold">{restaurant.avg_rating?.toFixed(1)}</span>
              <span className="text-white/60 text-xs">({restaurant.total_reviews})</span>
            </div>
            {liveStatus && (
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                liveStatus.is_open ? "bg-green-500/80 text-white" : "bg-red-500/80 text-white"
              )}>
                {liveStatus.is_open ? "Open" : "Closed"}
              </span>
            )}
            {/* INTEGRATION ADDITION: Queue wait time badge from liveStatus */}
            {liveStatus?.is_open && liveStatus.queue_length > 0 && (
              <span className="flex items-center gap-1 bg-amber-500/80 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                <Clock size={10} />
                ~{liveStatus.queue_length * 5}m wait
              </span>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Sticky Tab Bar ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex relative">
          {(["menu", "info", "reviews"] as const).map((tab) => {
            const icons = { menu: Utensils, info: Info, reviews: MessageSquare };
            const Icon = icons[tab];
            const labels = { menu: "Menu", info: "Info", reviews: "Reviews" };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors relative z-10",
                  activeTab === tab ? "text-[#E8A020]" : "text-gray-400"
                )}
              >
                <Icon size={15} />
                {labels[tab]}
              </button>
            );
          })}
          {/* Sliding gold indicator */}
          <motion.div
            layoutId="tabIndicator"
            className="absolute bottom-0 h-0.5 bg-[#E8A020] rounded-full"
            style={{ width: "33.33%", left: `${["menu","info","reviews"].indexOf(activeTab) * 33.33}%` }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        </div>
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {activeTab === "menu" && (
          <motion.div key="menu" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {menuLoading ? (
              <div className="px-4 py-4 space-y-4"><SkeletonCard variant="card" count={4} /></div>
            ) : categories.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">Menu not available</div>
            ) : (
              <>
                {/* INTEGRATION ADDITION: Show allergen context banner if profile has allergies */}
                {userAllergies.length > 0 && (
                  <div className="mx-4 mt-3 mb-1 flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    <AlertTriangle size={13} className="text-red-500 shrink-0" />
                    <p className="text-xs text-red-600 font-medium">
                      Items containing your allergens are highlighted below.
                    </p>
                  </div>
                )}

                {/* INTEGRATION ADDITION: Show happy hour banner if any active pricing rules exist */}
                {activePricingRules.length > 0 && (
                  <div className="mx-4 mt-2 mb-1 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <Flame size={13} className="text-amber-500 fill-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700 font-semibold">
                      🔥 Happy Hour is ON — special prices on selected items!
                    </p>
                  </div>
                )}

                {/* Category pill nav */}
                <div className="sticky top-12.25 z-20 bg-white border-b border-gray-50 px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-hide">
                  {categories.map((cat) => (
                    <motion.button
                      key={cat.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setActiveCategoryId(cat.id);
                        document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all relative",
                        selectedCat === cat.id
                          ? "bg-[#E8A020] text-white shadow-md"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {cat.name}
                    </motion.button>
                  ))}
                </div>

                <div className="px-4 py-4 space-y-8">
                  {categories.map((cat) => (
                    <CategorySection
                      key={cat.id}
                      cat={cat}
                      selectedCat={selectedCat}
                      getItemQty={getItemQty}
                      handleCartUpdate={handleCartUpdate}
                      // INTEGRATION ADDITION: Pass new props
                      pricingMap={pricingMap}
                      userAllergies={userAllergies}
                    />
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === "info" && (
          <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="px-4 py-6 space-y-4">
            {restaurant.description && (
              <p className="text-sm text-gray-600 leading-relaxed">{restaurant.description}</p>
            )}
            {restaurant.branches?.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                <h3 className="font-bold text-gray-900">{b.name}</h3>
                {b.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin size={15} className="text-gray-400 shrink-0 mt-0.5" />
                    <span>{b.address}, {b.city}</span>
                  </div>
                )}
                {b.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={15} className="text-gray-400 shrink-0" />
                    <a href={`tel:${b.phone}`} className="text-[#1A3C5E] font-medium">{b.phone}</a>
                  </div>
                )}
                {b.opening_time && b.closing_time && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock size={15} className="text-gray-400 shrink-0" />
                    <span>{b.opening_time} – {b.closing_time}</span>
                  </div>
                )}
                <StatusBadge status={b.is_active ? "active" : "inactive"} size="sm" />
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === "reviews" && (
          <motion.div key="reviews" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ReviewsTab restaurantId={restaurantId} role={role} />
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Book a Table sticky bar ───────────────────────────────────── */}
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 280, damping: 24 }}
        className="fixed bottom-20 left-4 right-4 z-40"
      >
        <AnimatePresence mode="wait">
          {cartCount() > 0 ? (
            <motion.div key="cart" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
              <Link href="/customer/order/cart">
                <div className="flex items-center justify-between bg-[#1A3C5E] text-white px-5 py-3.5 rounded-2xl shadow-2xl">
                  <div className="flex items-center gap-2">
                    <motion.span
                      key={cartCount()}
                      initial={{ scale: 1.4 }}
                      animate={{ scale: 1 }}
                      className="w-7 h-7 bg-[#E8A020] rounded-full flex items-center justify-center text-xs font-bold"
                    >
                      {cartCount()}
                    </motion.span>
                    <span className="text-sm font-semibold">View Cart</span>
                  </div>
                  <span className="text-sm font-bold">{formatCurrency(cartTotal())}</span>
                </div>
              </Link>
            </motion.div>
          ) : (
            <motion.div key="book" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
              <Link href="/customer/booking">
                <div className="flex items-center justify-center gap-2 bg-[#E8A020] text-white px-5 py-3.5 rounded-2xl shadow-2xl">
                  <Calendar size={17} />
                  <span className="font-bold">Book a Table</span>
                </div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </div>
  );
}