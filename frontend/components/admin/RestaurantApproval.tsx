"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  Calendar,
  GitBranch,
  ExternalLink,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PendingRestaurantOwner {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface PendingRestaurant {
  id: string;
  name: string;
  cuisine_type?: string | null;
  gst_number?: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  city?: string | null;
  owner?: PendingRestaurantOwner | null;
  branches?: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    is_active?: boolean;
  }[];
}

interface RestaurantApprovalProps {
  restaurant: PendingRestaurant | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

// ─── Info Row ──────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
  masked = false,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
  mono?: boolean;
  masked?: boolean;
}) {
  const displayValue = masked && value
    ? value.slice(0, 3) + "••••" + value.slice(-3)
    : value;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-[#1A3C5E]/6 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className="text-[#1A3C5E]" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <p
          className={cn(
            "text-sm text-gray-800 break-all",
            mono && "font-mono",
            !value && "text-gray-400 italic"
          )}
        >
          {displayValue ?? "Not provided"}
        </p>
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

import { useState } from "react";

export function RestaurantApproval({
  restaurant,
  isOpen,
  onClose,
  onApprove,
  onReject,
  isApproving = false,
  isRejecting = false,
}: RestaurantApprovalProps) {
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  const handleApprove = () => {
    if (!restaurant) return;
    setShowApproveConfirm(false);
    onApprove(restaurant.id);
  };

  const handleReject = () => {
    if (!restaurant || rejectReason.trim().length < 20) return;
    setShowRejectModal(false);
    onReject(restaurant.id, rejectReason.trim());
    setRejectReason("");
  };

  const handleClose = () => {
    setShowRejectModal(false);
    setShowApproveConfirm(false);
    setRejectReason("");
    onClose();
  };

  const daysAgo = restaurant
    ? Math.floor(
        (Date.now() - new Date(restaurant.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  return (
    <AnimatePresence>
      {isOpen && restaurant && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          {/* Slide-in Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-[#1A3C5E] to-[#2d5a8e]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-400/20 text-amber-200 rounded-full">
                    Awaiting Review
                  </span>
                  <span className="text-xs text-white/50">
                    Applied {daysAgo === 0 ? "today" : `${daysAgo}d ago`}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white leading-tight">
                  {restaurant.name}
                </h2>
                {restaurant.cuisine_type && (
                  <p className="text-sm text-white/60 mt-0.5">
                    {restaurant.cuisine_type}
                  </p>
                )}
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors mt-0.5"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Restaurant Details */}
              <div className="px-6 pt-5 pb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Restaurant Details
                </p>
                <div className="bg-gray-50/70 rounded-xl px-4">
                  <InfoRow
                    icon={Building2}
                    label="Restaurant Name"
                    value={restaurant.name}
                  />
                  <InfoRow
                    icon={FileText}
                    label="Cuisine Type"
                    value={restaurant.cuisine_type}
                  />
                  <InfoRow
                    icon={FileText}
                    label="GST Number"
                    value={restaurant.gst_number}
                    mono
                  />
                  <InfoRow
                    icon={MapPin}
                    label="City"
                    value={restaurant.city}
                  />
                  <InfoRow
                    icon={Calendar}
                    label="Applied On"
                    value={formatDate(restaurant.created_at)}
                  />
                </div>
              </div>

              {/* Owner Details */}
              {restaurant.owner && (
                <div className="px-6 pt-3 pb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Owner Profile
                  </p>
                  <div className="bg-gray-50/70 rounded-xl px-4">
                    {/* Avatar */}
                    <div className="flex items-center gap-3 py-4 border-b border-gray-100">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1A3C5E] to-[#E85D04] flex items-center justify-center text-white font-bold text-lg shrink-0">
                        {restaurant.owner.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {restaurant.owner.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          Account {restaurant.owner.is_active ? "active" : "inactive"}
                        </p>
                      </div>
                    </div>
                    <InfoRow
                      icon={Mail}
                      label="Email"
                      value={restaurant.owner.email}
                    />
                    <InfoRow
                      icon={Phone}
                      label="Phone"
                      value={restaurant.owner.phone}
                      masked
                    />
                    {restaurant.owner.created_at && (
                      <InfoRow
                        icon={Calendar}
                        label="Account Created"
                        value={formatDate(restaurant.owner.created_at)}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Branch Details */}
              {restaurant.branches && restaurant.branches.length > 0 && (
                <div className="px-6 pt-3 pb-6">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Branches ({restaurant.branches.length})
                  </p>
                  <div className="space-y-2">
                    {restaurant.branches.map((branch) => (
                      <div
                        key={branch.id}
                        className="bg-gray-50/70 rounded-xl px-4 py-3 flex items-start gap-3"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#1A3C5E]/8 flex items-center justify-center shrink-0 mt-0.5">
                          <GitBranch size={12} className="text-[#1A3C5E]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 leading-tight">
                            {branch.name}
                          </p>
                          {branch.address && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {branch.address}
                            </p>
                          )}
                          {branch.city && (
                            <p className="text-xs text-gray-400">{branch.city}</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-auto",
                            branch.is_active
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-gray-100 text-gray-400"
                          )}
                        >
                          {branch.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              {/* Reject Modal */}
              <AnimatePresence>
                {showRejectModal && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mb-4 bg-white rounded-xl border border-red-100 p-4 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-gray-800 mb-2">
                      Reason for rejection
                    </p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Describe why this application is being rejected (min 20 characters)..."
                      rows={3}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 resize-none placeholder:text-gray-400"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p
                        className={cn(
                          "text-xs",
                          rejectReason.trim().length < 20
                            ? "text-red-400"
                            : "text-emerald-500"
                        )}
                      >
                        {rejectReason.trim().length}/20 min chars
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowRejectModal(false)}
                          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleReject}
                          disabled={
                            rejectReason.trim().length < 20 || isRejecting
                          }
                          className="px-4 py-1.5 text-xs font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {isRejecting ? "Sending…" : "Send Rejection"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Approve Confirm */}
              <AnimatePresence>
                {showApproveConfirm && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mb-4 bg-emerald-50 rounded-xl border border-emerald-100 p-4"
                  >
                    <p className="text-sm font-semibold text-gray-800 mb-1">
                      Approve {restaurant.name}?
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      The owner will receive an approval email with onboarding
                      steps and a link to their dashboard.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowApproveConfirm(false)}
                        className="flex-1 px-3 py-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="flex-1 px-3 py-2 text-xs font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-40 transition-colors"
                      >
                        {isApproving ? "Approving…" : "Yes, Approve"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Primary Action Buttons */}
              {!showRejectModal && !showApproveConfirm && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={isRejecting || isApproving}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => setShowApproveConfirm(true)}
                    disabled={isApproving || isRejecting}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}