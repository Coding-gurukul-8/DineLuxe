"use client";

import { Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import PageWrapper from "@/components/layout/PageWrapper";
import LoyaltyConfig from "@/components/owner/LoyaltyConfig";

export default function LoyaltyPage() {
  const { restaurantId, loading } = useAuth();

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#1A3C5E]/20 border-t-[#1A3C5E] animate-spin" />
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (!restaurantId) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-gray-400">No restaurant found for your account.</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Loyalty Program
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
            <Trophy size={13} className="text-[#E8A020]" />
            <p className="text-sm text-gray-400">🏆 Rewards</p>
          </div>
        </div>
      </div>

      <LoyaltyConfig restaurantId={restaurantId} />
    </PageWrapper>
  );
}