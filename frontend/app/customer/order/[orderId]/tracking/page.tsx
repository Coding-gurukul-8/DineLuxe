"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { getSocket, incrementRoomCount, decrementRoomCount } from "@/lib/socket";
import { formatCurrency, cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Order, OrderItem } from "@/types/api";
import {
  ArrowLeft, CheckCircle2, ChefHat, Bike,
  Package, Star, Phone, MessageCircle,
  ChevronDown, ChevronUp, MapPin, Clock,
  Wifi, WifiOff, Navigation,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PartnerLocation {
  lat: number;
  lon: number;
}

interface LocationUpdate {
  lat: number;
  lon: number;
  distance_km: number;
  eta_minutes: number;
}

type DeliveryPhase =
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered";

// ── Delivery status steps ─────────────────────────────────────────────────────

const DELIVERY_STEPS: Array<{
  phase: DeliveryPhase;
  label: string;
  subLabel: string;
  icon: React.ElementType;
}> = [
  {
    phase: "confirmed",
    label: "Order Confirmed",
    subLabel: "Restaurant received your order",
    icon: CheckCircle2,
  },
  {
    phase: "preparing",
    label: "Preparing",
    subLabel: "Your food is being prepared",
    icon: ChefHat,
  },
  {
    phase: "out_for_delivery",
    label: "Out for Delivery",
    subLabel: "On the way to you",
    icon: Bike,
  },
  {
    phase: "delivered",
    label: "Delivered",
    subLabel: "Enjoy your meal!",
    icon: Package,
  },
];

// Map backend OrderStatus → DeliveryPhase index
function orderStatusToPhaseIndex(status: string): number {
  const map: Record<string, number> = {
    created: 0,
    confirmed: 0,
    preparing: 1,
    ready: 2,
    served: 2, // in delivery context "served" means picked up
    out_for_delivery: 2,
    paid: 3,
    closed: 3,
    delivered: 3,
  };
  return map[status] ?? 0;
}

// ── Map component (Google Static Maps or text fallback) ───────────────────────

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

interface MapSectionProps {
  partnerLoc: PartnerLocation | null;
  branchLoc: { lat: number; lon: number } | null;
  isLive: boolean;
}

function MapSection({ partnerLoc, branchLoc, isLive }: MapSectionProps) {
  // ── Google Static Map ────────────────────────────────────────────────────
  if (GOOGLE_KEY && partnerLoc) {
    const centerLat = partnerLoc.lat;
    const centerLon = partnerLoc.lon;

    const branchMarker = branchLoc
      ? `&markers=icon:https://maps.google.com/mapfiles/kml/pal3/icon56.png|${branchLoc.lat},${branchLoc.lon}`
      : "";

    const partnerMarker = `&markers=color:red|label:D|${partnerLoc.lat},${partnerLoc.lon}`;

    const mapUrl =
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=${centerLat},${centerLon}` +
      `&zoom=14&size=640x360&scale=2` +
      `&maptype=roadmap` +
      partnerMarker +
      branchMarker +
      `&key=${GOOGLE_KEY}`;

    return (
      <div className="relative w-full h-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mapUrl}
          alt="Delivery tracking map"
          className="w-full h-full object-cover"
          key={mapUrl} // forces re-render when URL changes
        />
        {/* Live pulse badge */}
        {isLive && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-semibold text-gray-700">Live</span>
          </div>
        )}
      </div>
    );
  }

  // ── Text-based location fallback (no Google key or no location yet) ──────
  return (
    <div className="relative w-full h-full bg-gradient-to-br from-[#1A3C5E] to-[#0D2A45] flex flex-col items-center justify-center gap-4">
      {/* Animated concentric rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-white/10"
          style={{ width: 60 + i * 70, height: 60 + i * 70 }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.1, 0.3] }}
          transition={{
            duration: 2.5,
            delay: i * 0.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Delivery bike icon — pulsing */}
      <motion.div
        animate={{ y: [-4, 4, -4] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 w-16 h-16 bg-[#E8A020] rounded-full flex items-center justify-center shadow-xl"
      >
        <Bike size={30} className="text-white" />
      </motion.div>

      {/* Location text */}
      {partnerLoc ? (
        <div className="relative z-10 text-center">
          <p className="text-white font-semibold text-sm">Partner Location</p>
          <p className="text-white/60 text-xs mt-1 font-mono">
            {partnerLoc.lat.toFixed(5)}, {partnerLoc.lon.toFixed(5)}
          </p>
        </div>
      ) : (
        <div className="relative z-10 text-center px-6">
          <p className="text-white font-semibold text-sm">Locating your delivery partner…</p>
          <p className="text-white/50 text-xs mt-1">Live updates arriving shortly</p>
        </div>
      )}

      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-3 right-3 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs font-semibold text-white">Live</span>
        </div>
      )}
    </div>
  );
}

// ── Status step tracker ───────────────────────────────────────────────────────

interface StepTrackerProps {
  currentPhaseIndex: number;
  stepTimes: Record<string, string>; // phase → elapsed time label
}

function StepTracker({ currentPhaseIndex, stepTimes }: StepTrackerProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-sm font-bold text-gray-800 mb-5">Order Status</h3>
      <div className="space-y-0">
        {DELIVERY_STEPS.map((step, i) => {
          const done = i < currentPhaseIndex;
          const active = i === currentPhaseIndex;
          const future = i > currentPhaseIndex;
          const Icon = step.icon;
          const isLast = i === DELIVERY_STEPS.length - 1;

          return (
            <div key={step.phase} className="flex gap-4">
              {/* Line + icon column */}
              <div className="flex flex-col items-center">
                {/* Circle */}
                <motion.div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0 z-10",
                    done && "bg-[#1A3C5E] border-[#1A3C5E]",
                    active && "bg-white border-[#E8A020]",
                    future && "bg-gray-50 border-gray-200",
                  )}
                  animate={active ? { boxShadow: ["0 0 0 0px rgba(232,160,32,0.4)", "0 0 0 8px rgba(232,160,32,0)", "0 0 0 0px rgba(232,160,32,0)"] } : {}}
                  transition={active ? { duration: 1.8, repeat: Infinity } : {}}
                >
                  <Icon
                    size={16}
                    className={cn(
                      done && "text-white",
                      active && "text-[#E8A020]",
                      future && "text-gray-300",
                    )}
                  />
                </motion.div>

                {/* Connector line */}
                {!isLast && (
                  <div className="w-0.5 flex-1 my-1 min-h-6">
                    <motion.div
                      className="w-full bg-[#1A3C5E] origin-top"
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: done ? 1 : 0 }}
                      transition={{ duration: 0.5, delay: i * 0.15 }}
                      style={{ height: "100%" }}
                    />
                    {!done && <div className="w-full h-full bg-gray-200" />}
                  </div>
                )}
              </div>

              {/* Text column */}
              <div className={cn("pb-5 flex-1", isLast && "pb-0")}>
                <p
                  className={cn(
                    "font-semibold text-sm leading-tight",
                    done || active ? "text-gray-900" : "text-gray-400",
                  )}
                >
                  {step.label}
                  {active && (
                    <span className="ml-2 text-[10px] font-bold text-[#E8A020] uppercase tracking-wide bg-[#E8A020]/10 px-1.5 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{step.subLabel}</p>
                {stepTimes[step.phase] && (
                  <p className="text-[10px] text-[#1A3C5E] font-medium mt-1 flex items-center gap-1">
                    <Clock size={9} />
                    {stepTimes[step.phase]}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Delivery partner card ─────────────────────────────────────────────────────

interface PartnerCardProps {
  eta: number | null;
  distance: number | null;
  partnerPhone?: string | null;
  rating?: number;
}

function PartnerCard({ eta, distance, partnerPhone, rating = 4.8 }: PartnerCardProps) {
  // Mask phone: show only last 4 digits
  const maskedPhone = partnerPhone
    ? `+91 XXXXXX${partnerPhone.slice(-4)}`
    : null;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1A3C5E] to-[#2A5C8E] flex items-center justify-center shrink-0 shadow-lg">
          <Bike size={24} className="text-white" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">Your delivery partner</p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-0.5">
              <Star size={11} className="text-[#E8A020] fill-[#E8A020]" />
              <span className="text-xs font-semibold text-gray-700">{rating.toFixed(1)}</span>
            </div>
            {maskedPhone && (
              <span className="text-gray-300">·</span>
            )}
            {maskedPhone && (
              <span className="text-xs text-gray-500 font-mono">{maskedPhone}</span>
            )}
          </div>
        </div>

        {/* Call button */}
        {partnerPhone && (
          <a
            href={`tel:${partnerPhone}`}
            className="w-10 h-10 rounded-full bg-green-50 border border-green-200 flex items-center justify-center shrink-0 hover:bg-green-100 transition-colors"
            aria-label="Call delivery partner"
          >
            <Phone size={16} className="text-green-600" />
          </a>
        )}
      </div>

      {/* ETA + Distance */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-[#FFF8EC] rounded-xl p-3">
          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">
            Arriving in
          </p>
          {eta !== null ? (
            <motion.p
              key={eta}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-bold text-[#E8A020] tabular-nums"
            >
              ~{eta} <span className="text-sm font-semibold">min</span>
            </motion.p>
          ) : (
            <p className="text-sm text-gray-400">Calculating…</p>
          )}
        </div>

        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">
            Distance
          </p>
          {distance !== null ? (
            <motion.p
              key={distance}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-bold text-gray-800 tabular-nums"
            >
              {distance.toFixed(1)} <span className="text-sm font-semibold">km</span>
            </motion.p>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Order summary accordion ───────────────────────────────────────────────────

interface OrderSummaryProps {
  order: Order;
}

function OrderSummary({ order }: OrderSummaryProps) {
  const [open, setOpen] = useState(false);
  const items = order.order_items ?? [];
  const total = order.total ?? order.payment?.amount ?? 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Package size={16} className="text-[#1A3C5E]" />
          <span className="text-sm font-bold text-gray-800">Order Summary</span>
          <span className="text-xs text-gray-400 font-medium">
            ({items.length} item{items.length !== 1 ? "s" : ""})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#1A3C5E]">{formatCurrency(total)}</span>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={16} className="text-gray-400" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="summary-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100">
              {items.map((item: OrderItem, i) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#1A3C5E]/10 text-[#1A3C5E] text-[10px] font-bold flex items-center justify-center shrink-0">
                      {item.quantity}
                    </span>
                    <span className="text-sm text-gray-700">
                      {item.menu_item?.name ?? `Item ${i + 1}`}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">
                    {formatCurrency(item.unit_price * item.quantity)}
                  </span>
                </div>
              ))}

              {/* Totals */}
              <div className="px-5 py-4 bg-gray-50 space-y-2">
                {order.payment?.tax_amount != null && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Tax & charges</span>
                    <span>{formatCurrency(order.payment.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-200">
                  <span>Total Paid</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Delivered success overlay ─────────────────────────────────────────────────

function DeliveredOverlay({ orderId }: { orderId: string }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(`/customer/order/${orderId}/receipt`);
    }, 3000);
    return () => clearTimeout(timer);
  }, [orderId, router]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-6"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.1 }}
        className="bg-white rounded-3xl p-8 text-center shadow-2xl w-full max-w-sm"
      >
        {/* Animated checkmark */}
        <div className="flex justify-center mb-5">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.6 }}
            className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center"
          >
            <CheckCircle2 size={44} className="text-green-500" strokeWidth={1.5} />
          </motion.div>
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-2xl font-bold text-gray-900"
        >
          Order Delivered! 🎉
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-gray-500 text-sm mt-2"
        >
          Your food has arrived. Enjoy your meal!
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-5 text-xs text-gray-400"
        >
          Taking you to your receipt…
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ── Connection indicator ──────────────────────────────────────────────────────

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <AnimatePresence>
      {!connected && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-full left-0 right-0 flex justify-center pt-2 z-10"
        >
          <div className="bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-sm">
            <WifiOff size={12} className="text-amber-500" />
            <span className="text-xs font-medium text-amber-700">
              Reconnecting to live tracking…
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DeliveryTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();

  // ── Real-time state ─────────────────────────────────────────────────────────
  const [partnerLocation, setPartnerLocation] = useState<PartnerLocation | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>("confirmed");
  const [isDelivered, setIsDelivered] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [stepTimes] = useState<Record<string, string>>({
    confirmed: "Just now",
  });

  // ── Fetch order details ─────────────────────────────────────────────────────
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId, "tracking"],
    queryFn: () => apiClient.get<Order>(`/orders/${orderId}`),
    enabled: !!orderId,
    refetchInterval: isDelivered ? false : 20_000,
  });

  // Sync order status to local state on first load
  useEffect(() => {
    if (order?.status) {
      setCurrentStatus(order.status);
    }
    // If the order isn't a delivery, redirect back
    if (order && order.order_type !== "delivery") {
      router.replace(`/customer/order/${orderId}`);
    }
  }, [order, orderId, router]);

  // ── WebSocket setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId) return;

    const socket = getSocket();
    incrementRoomCount();

    const room = `order:${orderId}`;

    // Connection events
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) setSocketConnected(true);

    // Join the order room
    socket.emit("join_room", room);

    // Live location updates from the delivery partner
    const onLocationUpdate = (data: LocationUpdate) => {
      setPartnerLocation({ lat: data.lat, lon: data.lon });
      setEta(data.eta_minutes);
      setDistance(data.distance_km);
      setCurrentStatus("out_for_delivery");
    };

    // Delivery completed event
    const onDeliveryComplete = () => {
      setCurrentStatus("delivered");
      setIsDelivered(true);
    };

    socket.on("location_update", onLocationUpdate);
    socket.on("delivery_complete", onDeliveryComplete);

    return () => {
      socket.emit("leave_room", room);
      socket.off("location_update", onLocationUpdate);
      socket.off("delivery_complete", onDeliveryComplete);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      decrementRoomCount();
    };
  }, [orderId]);

  // ── Branch location (from order → branch) ──────────────────────────────────
  const branchLoc =
    order && (order as any).branch?.lat && (order as any).branch?.lon
      ? { lat: Number((order as any).branch.lat), lon: Number((order as any).branch.lon) }
      : null;

  // Partner phone
  const partnerPhone: string | null = (order as any)?.delivery?.partner?.phone ?? null;

  // Current phase index
  const phaseIndex = orderStatusToPhaseIndex(currentStatus);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F4]">
        {/* Header skeleton */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-4">
          <div className="h-6 bg-gray-100 rounded-lg animate-pulse w-40" />
        </div>
        {/* Map skeleton */}
        <div className="h-[50vh] bg-gray-200 animate-pulse" />
        {/* Cards skeleton */}
        <div className="px-4 pt-4 space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 bg-white rounded-2xl animate-pulse border border-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Delivered success overlay */}
      {isDelivered && <DeliveredOverlay orderId={orderId} />}

      <div className="min-h-screen bg-[#FAF7F4] pb-24">

        {/* ── Sticky header ────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-100 relative">
          <div className="flex items-center justify-between px-4 py-3.5">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft size={18} className="text-gray-700" />
            </button>

            <div className="text-center">
              <h1 className="text-sm font-bold text-gray-900">Track Order</h1>
              {orderId && (
                <p className="text-[10px] text-gray-400 font-mono">
                  #{orderId.slice(-8).toUpperCase()}
                </p>
              )}
            </div>

            <StatusBadge
              status={currentStatus === "out_for_delivery" ? "out_for_delivery" : currentStatus}
              size="sm"
            />
          </div>

          {/* Connection badge sits below header */}
          <ConnectionBadge connected={socketConnected} />
        </div>

        {/* ── Map (50% of screen height) ───────────────────────────────── */}
        <div className="h-[50vh] w-full relative">
          <MapSection
            partnerLoc={partnerLocation}
            branchLoc={branchLoc}
            isLive={socketConnected && partnerLocation !== null}
          />
        </div>

        {/* ── Content cards ─────────────────────────────────────────────── */}
        <div className="px-4 pt-4 space-y-4">

          {/* ── Status step tracker ──────────────────────────────────── */}
          <StepTracker
            currentPhaseIndex={phaseIndex}
            stepTimes={stepTimes}
          />

          {/* ── Delivery partner card ────────────────────────────────── */}
          {(currentStatus === "out_for_delivery" || currentStatus === "delivered" || partnerLocation) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
            >
              <PartnerCard
                eta={eta}
                distance={distance}
                partnerPhone={partnerPhone}
                rating={4.8}
              />
            </motion.div>
          )}

          {/* ── Order summary accordion ──────────────────────────────── */}
          {order && <OrderSummary order={order} />}

          {/* ── Footer: Get Help ─────────────────────────────────────── */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/customer/profile/support")}
            className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-100 rounded-2xl py-4 text-sm font-semibold text-gray-700 shadow-sm hover:border-gray-200 transition-colors"
          >
            <MessageCircle size={16} className="text-[#1A3C5E]" />
            Get Help
          </motion.button>

        </div>
      </div>
    </>
  );
}