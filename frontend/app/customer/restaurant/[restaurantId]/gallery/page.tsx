"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ZoomIn, Images } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface RestaurantDetail { id: string; name: string; gallery_images?: string[]; }

function Lightbox({ images, index, onClose, onPrev, onNext }: { images: string[]; index: number; onClose: () => void; onPrev: () => void; onNext: () => void }) {
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [hasPrev, hasNext, onPrev, onNext, onClose]);

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (delta < -50 && hasNext) onNext();
    if (delta > 50 && hasPrev) onPrev();
    setTouchStartX(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="flex items-center justify-between px-4 pt-12 pb-4">
        <span className="text-white/60 text-sm font-semibold">{index + 1} / {images.length}</span>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><X size={20} className="text-white" /></motion.button>
      </div>
      <div className="flex-1 flex items-center justify-center relative px-14 min-h-0">
        <motion.button whileTap={{ scale: 0.85 }} onClick={onPrev} disabled={!hasPrev} className={cn("absolute left-2 w-10 h-10 rounded-full flex items-center justify-center transition-all", hasPrev ? "bg-white/10 text-white" : "opacity-0 pointer-events-none")}><ChevronLeft size={22} /></motion.button>
        <AnimatePresence mode="wait">
          <motion.img key={index} src={images[index]} alt={`Photo ${index + 1}`} initial={{ opacity: 0, scale: 0.96, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.96, x: -20 }} transition={{ type: "spring", stiffness: 320, damping: 28 }} className="max-h-full max-w-full object-contain rounded-xl" draggable={false} />
        </AnimatePresence>
        <motion.button whileTap={{ scale: 0.85 }} onClick={onNext} disabled={!hasNext} className={cn("absolute right-2 w-10 h-10 rounded-full flex items-center justify-center transition-all", hasNext ? "bg-white/10 text-white" : "opacity-0 pointer-events-none")}><ChevronRight size={22} /></motion.button>
      </div>
      <div className="py-4 px-4 pb-8">
        <div className="flex gap-2 overflow-x-auto justify-center">
          {images.map((img, i) => (
            <button key={i} className={cn("w-12 h-12 rounded-lg overflow-hidden shrink-0 ring-2 transition-all", i === index ? "ring-white" : "ring-transparent opacity-50")}>
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function GalleryPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const router = useRouter();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => apiClient.get<RestaurantDetail>(`/restaurants/${restaurantId}`),
    enabled: !!restaurantId,
  });

  const images = restaurant?.gallery_images ?? [];
  const openLightbox = (i: number) => setLightboxIndex(i);
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = useCallback(() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i)), []);
  const nextImage = useCallback(() => setLightboxIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : i)), [images.length]);

  useEffect(() => {
    document.body.style.overflow = lightboxIndex !== null ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxIndex]);

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-24">
      <AnimatePresence>
        {lightboxIndex !== null && <Lightbox images={images} index={lightboxIndex} onClose={closeLightbox} onPrev={prevImage} onNext={nextImage} />}
      </AnimatePresence>

      <div className="bg-linear-to-br from-[#1A3C5E] to-[#0D2A45] px-4 pt-12 pb-6 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-[#E8A020]/10" />
        <div className="relative flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ChevronLeft size={18} className="text-white" /></motion.button>
          <div className="min-w-0 flex-1">
            <p className="text-[#E8A020] text-xs font-semibold uppercase tracking-widest">Restaurant</p>
            <h1 className="text-white font-bold text-xl truncate">{isLoading ? "Loading…" : (restaurant?.name ?? "Gallery")}</h1>
          </div>
          {images.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 shrink-0">
              <Images size={14} className="text-white/70" />
              <span className="text-white/70 text-xs font-semibold">{images.length}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 mt-5">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{[1,2,3,4,5,6].map((n) => <div key={n} className="aspect-square rounded-2xl bg-white border border-gray-100 animate-pulse" />)}</div>
        ) : images.length === 0 ? (
          <EmptyState icon={<Images size={32} className="text-gray-300" />} title="No photos yet" message="This restaurant hasn't uploaded any photos." />
        ) : (
          <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {images.map((url, i) => (
              <motion.button key={i} variants={{ hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 280, damping: 22 } } }} whileTap={{ scale: 0.96 }} onClick={() => openLightbox(i)} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 group">
                <img src={url} alt={`Photo ${i + 1}`} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {i === 0 && images.length > 6 && <div className="absolute top-2 left-2 bg-[#E8A020] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Featured</div>}
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}