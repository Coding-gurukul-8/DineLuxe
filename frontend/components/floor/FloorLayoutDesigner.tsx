"use client";

import { FloorMap, type FloorTable } from "@/components/floor/FloorMap";
import { LayoutGrid } from "lucide-react";

interface FloorLayoutDesignerProps {
  branchId?: string;
  tables?: FloorTable[];
  height?: number;
}

const SAMPLE_TABLES: FloorTable[] = [
  {
    id: "t1",
    label: "T1",
    capacity: 4,
    status: "free",
    shape: "round",
    x: 40,
    y: 60,
    width: 72,
    height: 72,
  },
  {
    id: "t2",
    label: "T2",
    capacity: 2,
    status: "reserved",
    shape: "square",
    x: 160,
    y: 80,
    width: 64,
    height: 64,
  },
  {
    id: "t3",
    label: "T3",
    capacity: 6,
    status: "occupied",
    shape: "rectangle",
    x: 90,
    y: 190,
    width: 120,
    height: 56,
  },
];

export default function FloorLayoutDesigner({
  branchId,
  tables,
  height = 520,
}: FloorLayoutDesignerProps) {
  const layoutTables = tables ?? SAMPLE_TABLES;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#1A3C5E]/10 p-2 text-[#1A3C5E]">
            <LayoutGrid size={16} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Floor layout
            </p>
            <p className="text-sm font-semibold text-gray-800">Designer preview</p>
          </div>
        </div>
        <span className="text-xs text-gray-400">
          {branchId ? `Branch ${branchId.slice(0, 8)}...` : "No branch selected"}
        </span>
      </div>

      <FloorMap
        tables={layoutTables}
        branchId={branchId ?? "preview"}
        readOnly
        height={height}
      />

      <p className="text-xs text-gray-400">
        Drag-and-drop editing and publishing controls will appear here.
      </p>
    </div>
  );
}
