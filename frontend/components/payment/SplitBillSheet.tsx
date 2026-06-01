"use client";

/**
 * components/payment/SplitBillSheet.tsx
 *
 * Two modes:
 *   A — Even Split: split the total evenly among N people (2-20).
 *       Each person gets a UPI QR or Razorpay link for their share.
 *   B — Item-by-Item: fetch order items, let the customer select theirs,
 *       pay only their subtotal.
 *
 * Backend contracts used:
 *   GET  /payment-gateway/split/:orderId?split_by=N → { total, per_person, split_count }
 *   GET  /orders/:orderId                            → { order_items: [...] }
 *   POST /payment-gateway/partial-payment            → { portions_paid, total_portions, remaining_amount }
 */

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  ListChecks,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { UPIQRSheet } from "./UPIQRSheet";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  name?: string;
  quantity: number;
  unit_price: number;
  menu_items?: { name: string; price: number };
}

interface Order {
  id: string;
  order_items?: OrderItem[];
  status: string;
}

interface SplitCalculation {
  order_id: string;
  total: number;
  per_person: number;
  split_count: number;
  per_person_paise: number;
}

interface PartialPaymentResponse {
  portions_paid: number;
  total_portions: number;
  remaining_amount: number;
  all_paid: boolean;
}

type Tab = "even" | "items";

export interface SplitBillSheetProps {
  orderId: string;
  totalAmount: number;
  branchName?: string;
  onSplitComplete: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemDisplayName(item: OrderItem): string {
  return item.menu_items?.name ?? item.name ?? "Item";
}

function formatRupees(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function SplitProgress({
  paid,
  total,
  remaining,
}: {
  paid: number;
  total: number;
  remaining: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-gray-700">
          {paid} of {total} paid
        </span>
        <span className="text-[#E8A020] font-bold">
          {formatRupees(remaining)} remaining
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-[#E8A020] to-[#F0B840] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(paid / total) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ── Mode A — Even Split ───────────────────────────────────────────────────────

function EvenSplitTab({
  orderId,
  totalAmount,
  branchName,
  onSplitComplete,
}: {
  orderId: string;
  totalAmount: number;
  branchName: string;
  onSplitComplete: () => void;
}) {
  const [splitCount, setSplitCount] = useState(2);
  const [activePerson, setActivePerson] = useState<number | null>(null);
  const [paidPersons, setPaidPersons] = useState<Set<number>>(new Set());

  const { data: calc, isLoading } = useQuery({
    queryKey: ["split-calc", orderId, splitCount],
    queryFn: () =>
      apiClient.get<SplitCalculation>(
        `/payment-gateway/split/${orderId}?split_by=${splitCount}`,
      ),
    staleTime: 30_000,
  });

  const perPerson = calc?.per_person ?? totalAmount / splitCount;
  const paidCount = paidPersons.size;

  const handlePersonPaid = useCallback(
    (personIndex: number) => {
      const updated = new Set(paidPersons);
      updated.add(personIndex);
      setPaidPersons(updated);
      setActivePerson(null);
      toast.success(`Person ${personIndex + 1} payment confirmed!`);

      if (updated.size >= splitCount) {
        toast.success("All portions paid! 🎉");
        onSplitComplete();
      }
    },
    [paidPersons, splitCount, onSplitComplete],
  );

  return (
    <div className="space-y-5">
      {/* Split count picker */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs text-gray-500 font-semibold mb-4 uppercase tracking-wide">
          Split between
        </p>
        <div className="flex items-center justify-center gap-5">
          <button
            onClick={() => setSplitCount((n) => Math.max(2, n - 1))}
            disabled={splitCount <= 2}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-40"
          >
            <Minus size={16} className="text-gray-700" />
          </button>
          <AnimatePresence mode="wait">
            <motion.span
              key={splitCount}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 400 }}
              className="text-3xl font-bold text-[#1A3C5E] w-10 text-center"
            >
              {splitCount}
            </motion.span>
          </AnimatePresence>
          <button
            onClick={() => setSplitCount((n) => Math.min(20, n + 1))}
            disabled={splitCount >= 20}
            className="w-10 h-10 rounded-full bg-[#E8A020] flex items-center justify-center disabled:opacity-40"
          >
            <Plus size={16} className="text-white" />
          </button>
          <span className="text-sm text-gray-500">people</span>
        </div>

        <div className="mt-4 text-center">
          {isLoading ? (
            <Loader2 size={16} className="animate-spin mx-auto text-gray-400" />
          ) : (
            <p className="text-2xl font-bold text-[#E8A020]">
              {formatRupees(perPerson)}{" "}
              <span className="text-sm font-normal text-gray-400">per person</span>
            </p>
          )}
        </div>
      </div>

      {/* Progress */}
      {paidCount > 0 && (
        <SplitProgress
          paid={paidCount}
          total={splitCount}
          remaining={(splitCount - paidCount) * perPerson}
        />
      )}

      {/* Person list */}
      <div className="space-y-2">
        {Array.from({ length: splitCount }, (_, i) => {
          const isPaid = paidPersons.has(i);
          const isOpen = activePerson === i;

          return (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => !isPaid && setActivePerson(isOpen ? null : i)}
                disabled={isPaid}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{
                    background: isPaid
                      ? "#22C55E"
                      : `hsl(${(i * 47) % 360}, 60%, 45%)`,
                  }}
                >
                  {isPaid ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">
                    Person {i + 1}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatRupees(perPerson)}
                  </p>
                </div>
                {isPaid ? (
                  <span className="text-xs text-green-600 font-semibold">Paid</span>
                ) : isOpen ? (
                  <ChevronUp size={16} className="text-gray-400" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400" />
                )}
              </button>

              <AnimatePresence>
                {isOpen && !isPaid && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden border-t border-gray-50"
                  >
                    <div className="p-4">
                      <UPIQRSheet
                        orderId={orderId}
                        amount={perPerson}
                        branchName={branchName}
                        onSuccess={() => handlePersonPaid(i)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Mode B — Item-by-Item ─────────────────────────────────────────────────────

function ItemSplitTab({
  orderId,
  totalAmount,
  branchName,
  onSplitComplete,
}: {
  orderId: string;
  totalAmount: number;
  branchName: string;
  onSplitComplete: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showQR, setShowQR] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-items", orderId],
    queryFn: () => apiClient.get<Order>(`/orders/${orderId}`),
  });

  const items = order?.order_items ?? [];

  const subtotal = useMemo(() => {
    return items
      .filter((item) => selected.has(item.id))
      .reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
  }, [items, selected]);

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={24} className="animate-spin text-[#E8A020]" />
      </div>
    );
  }

  if (showQR && subtotal > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Your share</p>
          <p className="text-lg font-bold text-[#E8A020]">{formatRupees(subtotal)}</p>
        </div>
        <UPIQRSheet
          orderId={orderId}
          amount={subtotal}
          branchName={branchName}
          onSuccess={() => {
            setShowQR(false);
            toast.success("Your items are paid!");
            if (subtotal >= totalAmount * 0.99) onSplitComplete();
          }}
        />
        <button
          onClick={() => setShowQR(false)}
          className="w-full text-xs text-gray-400 hover:text-gray-600 py-2"
        >
          ← Change selection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
        Select your items
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No items found</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isSelected = selected.has(item.id);
            const lineTotal = Number(item.unit_price) * Number(item.quantity);
            return (
              <button
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all
                  ${isSelected
                    ? "border-[#E8A020] bg-[#E8A020]/5"
                    : "border-gray-100 bg-white"
                  }
                `}
              >
                <div
                  className={`
                    w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
                    ${isSelected ? "border-[#E8A020] bg-[#E8A020]" : "border-gray-300 bg-white"}
                  `}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2 h-2 bg-white rounded-sm"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {itemDisplayName(item)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {item.quantity} × {formatRupees(Number(item.unit_price))}
                  </p>
                </div>
                <p className="text-sm font-bold text-gray-700 shrink-0">
                  {formatRupees(lineTotal)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Subtotal + pay button */}
      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {selected.size} item{selected.size !== 1 ? "s" : ""} selected
            </span>
            <span className="font-bold text-gray-900">{formatRupees(subtotal)}</span>
          </div>
          <button
            onClick={() => setShowQR(true)}
            className="w-full bg-[#E8A020] text-white font-bold text-sm py-3.5 rounded-2xl shadow"
          >
            Pay {formatRupees(subtotal)}
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SplitBillSheet({
  orderId,
  totalAmount,
  branchName = "Restaurant",
  onSplitComplete,
}: SplitBillSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>("even");

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-2 bg-gray-100 rounded-2xl p-1">
        {[
          { key: "even" as Tab, label: "Even Split", icon: Users },
          { key: "items" as Tab, label: "By Items", icon: ListChecks },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl transition-all
              ${activeTab === key
                ? "bg-white text-[#1A3C5E] shadow"
                : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: activeTab === "even" ? -12 : 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === "even" ? (
            <EvenSplitTab
              orderId={orderId}
              totalAmount={totalAmount}
              branchName={branchName}
              onSplitComplete={onSplitComplete}
            />
          ) : (
            <ItemSplitTab
              orderId={orderId}
              totalAmount={totalAmount}
              branchName={branchName}
              onSplitComplete={onSplitComplete}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}