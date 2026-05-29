"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, Heart, Utensils, Store, Star, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, cn } from "@/lib/utils";

interface FavoriteRestaurant { id: string; name: string; cuisine_type?: string | null; avg_rating?: number | null; logo_url?: string | null; address?: string; }
interface FavoriteItem { id: string; name: string; description?: string | null; price: number; photo_url?: string | null; restaurant_name?: string; }
interface FavoritesData { restaurants: FavoriteRestaurant[]; items: FavoriteItem[]; }

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 260, damping: 22, delay: i * 0.05 } }),
  exit: { opacity: 0, scale: 0.94, transition: { duration: 0.18 } },
};

function RestaurantFavCard({ restaurant, index, onUnfavorite, removing }: { restaurant: FavoriteRestaurant; index: number; onUnfavorite: (id: string) => void; removing: boolean }) {
  return (
    <motion.div layout variants={cardVariants} initial="hidden" animate="visible" exit="exit" custom={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="relative h-36 bg-gray-100">
        {restaurant.logo_url ? <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Store size={32} className="text-gray-300" /></div>}
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => onUnfavorite(restaurant.id)} disabled={removing} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center">
          <Heart size={16} className={cn("transition-colors", removing ? "text-gray-300" : "text-red-400 fill-red-400")} />
        </motion.button>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">{restaurant.name}</p>
            {restaurant.cuisine_type && <p className="text-xs text-gray-400 mt-0.5">{restaurant.cuisine_type}</p>}
          </div>
          {restaurant.avg_rating != null && <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#E8A020]/10 text-[#E8A020] px-2 py-1 rounded-full shrink-0"><Star size={10} className="fill-[#E8A020]" />{restaurant.avg_rating.toFixed(1)}</span>}
        </div>
        {restaurant.address && <div className="flex items-center gap-1 mt-2 text-xs text-gray-400"><MapPin size={11} /><span className="truncate">{restaurant.address}</span></div>}
      </div>
    </motion.div>
  );
}

function FoodFavCard({ item, index, onUnfavorite, removing }: { item: FavoriteItem; index: number; onUnfavorite: (id: string) => void; removing: boolean }) {
  return (
    <motion.div layout variants={cardVariants} initial="hidden" animate="visible" exit="exit" custom={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 p-3">
      <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
        {item.photo_url ? <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Utensils size={18} className="text-gray-300" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-sm truncate">{item.name}</p>
        {item.restaurant_name && <p className="text-xs text-gray-400 mt-0.5 truncate">{item.restaurant_name}</p>}
        {item.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>}
        <p className="text-sm font-bold text-[#1A3C5E] mt-1.5">{formatCurrency(item.price)}</p>
      </div>
      <motion.button whileTap={{ scale: 0.85 }} onClick={() => onUnfavorite(item.id)} disabled={removing} className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
        <Heart size={16} className={cn("transition-colors", removing ? "text-gray-300" : "text-red-400 fill-red-400")} />
      </motion.button>
    </motion.div>
  );
}

function TabBar({ active, onChange, counts }: { active: "restaurants" | "items"; onChange: (t: "restaurants" | "items") => void; counts: { restaurants: number; items: number } }) {
  const tabs = [{ key: "restaurants" as const, label: "Restaurants", icon: Store }, { key: "items" as const, label: "Dishes", icon: Utensils }];
  return (
    <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button key={key} onClick={() => onChange(key)} className="relative flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors">
          {active === key && <motion.div layoutId="tab-pill" className="absolute inset-0 bg-[#1A3C5E] rounded-xl" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
          <Icon size={15} className={cn("relative z-10", active === key ? "text-white" : "text-gray-400")} />
          <span className={cn("relative z-10", active === key ? "text-white" : "text-gray-500")}>{label}</span>
          <span className={cn("relative z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-full", active === key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400")}>{counts[key]}</span>
        </button>
      ))}
    </div>
  );
}

export default function FavoritesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"restaurants" | "items">("restaurants");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customer", "favorites"],
    queryFn: () => apiClient.get<FavoritesData>("/users/me/favorites"),
  });

  const restaurants = data?.restaurants ?? [];
  const items = data?.items ?? [];

  const { mutate: unfavorite } = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) => apiClient.delete(`/users/me/favorites/${type}/${id}`),
    onMutate: ({ id }) => setRemovingId(id),
    onSuccess: () => { toast.success("Removed from favorites."); qc.invalidateQueries({ queryKey: ["customer", "favorites"] }); },
    onError: () => toast.error("Could not remove favorite."),
    onSettled: () => setRemovingId(null),
  });

  const panelVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
  };

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">
      <div className="bg-linear-to-br from-[#1A3C5E] to-[#0D2A45] px-4 pt-12 pb-6 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-[#E8A020]/10" />
        <div className="relative flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ChevronLeft size={18} className="text-white" /></motion.button>
          <div>
            <p className="text-[#E8A020] text-xs font-semibold uppercase tracking-widest">Profile</p>
            <h1 className="text-white font-bold text-xl">My Favourites</h1>
          </div>
          <div className="ml-auto"><Heart size={22} className="text-red-400 fill-red-400" /></div>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">
        <TabBar active={activeTab} onChange={setActiveTab} counts={{ restaurants: restaurants.length, items: items.length }} />
        <AnimatePresence mode="wait" custom={activeTab === "restaurants" ? -1 : 1}>
          {activeTab === "restaurants" ? (
            <motion.div key="restaurants" custom={-1} variants={panelVariants} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 300, damping: 28 }} className="space-y-3">
              {isLoading ? [1,2,3].map((n) => <div key={n} className="h-52 bg-white rounded-2xl animate-pulse border border-gray-100" />) :
                restaurants.length === 0 ? <EmptyState icon={<Store size={32} className="text-gray-300" />} title="No favourite restaurants" message="Restaurants you heart will appear here." /> :
                <AnimatePresence>{restaurants.map((r, i) => <RestaurantFavCard key={r.id} restaurant={r} index={i} onUnfavorite={(id) => unfavorite({ type: "restaurants", id })} removing={removingId === r.id} />)}</AnimatePresence>}
            </motion.div>
          ) : (
            <motion.div key="items" custom={1} variants={panelVariants} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 300, damping: 28 }} className="space-y-3">
              {isLoading ? [1,2,3,4].map((n) => <div key={n} className="h-24 bg-white rounded-2xl animate-pulse border border-gray-100" />) :
                items.length === 0 ? <EmptyState icon={<Utensils size={32} className="text-gray-300" />} title="No favourite dishes" message="Heart a menu item to save it here." /> :
                <AnimatePresence>{items.map((item, i) => <FoodFavCard key={item.id} item={item} index={i} onUnfavorite={(id) => unfavorite({ type: "items", id })} removing={removingId === item.id} />)}</AnimatePresence>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}