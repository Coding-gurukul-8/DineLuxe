"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import FloorLayoutDesigner from "@/components/floor/FloorLayoutDesigner";

export default function OwnerFloorIndexPage() {
  return (
    <PageWrapper
      title="Floor Layouts"
      subtitle="Design and publish floor plans for each branch"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <FloorLayoutDesigner />
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Get started
            </p>
            <h3 className="mt-2 text-lg font-semibold text-gray-800">
              Select a branch to edit
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Choose a branch from the branches list to open its floor layout editor.
            </p>
          </div>
          <Link
            href="/owner/branches"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1A3C5E] hover:text-[#15304d]"
          >
            View branches <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
}
