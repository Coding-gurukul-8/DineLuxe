"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { DataTable, Column } from "@/components/shared/DataTable";
import { AlertTriangle, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInventoryLow } from "@/hooks/useInventoryLow";

interface InventoryItem extends Record<string, unknown> {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  min_threshold: number;
  category?: string;
  supplier?: string;
  cost_per_unit?: number;
}

type InventoryResponse = {
  data: InventoryItem[];
  count: number | null;
};

const columns: Column<InventoryItem>[] = [
  {
    key: "name",
    label: "Item",
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-2">
        {row.quantity <= row.min_threshold && (
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
        )}
        <span className="font-medium text-gray-800">{row.name}</span>
      </div>
    ),
  },
  {
    key: "category",
    label: "Category",
    render: (row) => (
      <span className="text-gray-500 capitalize">{row.category ?? "—"}</span>
    ),
  },
  {
    key: "quantity",
    label: "Quantity",
    sortable: true,
    align: "center",
    render: (row) => {
      const isLow = row.quantity <= row.min_threshold;
      return (
        <span className={cn("font-semibold", isLow ? "text-amber-600" : "text-gray-800")}>
          {row.quantity} <span className="font-normal text-gray-400 text-xs">{row.unit}</span>
        </span>
      );
    },
  },
  {
    key: "min_threshold",
    label: "Min Threshold",
    align: "center",
    render: (row) => (
      <span className="text-gray-500 text-sm">{row.min_threshold} {row.unit}</span>
    ),
  },
  {
    key: "supplier",
    label: "Supplier",
    render: (row) => <span className="text-gray-500">{row.supplier ?? "—"}</span>,
  },
  {
    key: "status",
    label: "Stock Status",
    render: (row) => {
      const isLow = row.quantity <= row.min_threshold;
      return (
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
          isLow
            ? "bg-amber-50 text-amber-700"
            : "bg-green-50 text-green-700"
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full", isLow ? "bg-amber-500" : "bg-green-500")} />
          {isLow ? "Low Stock" : "OK"}
        </span>
      );
    },
  },
];

export default function InventoryPage() {
  const { branchId } = useAuth();
  const qc = useQueryClient();

  useInventoryLow({
    branchId: branchId ?? undefined,
    onInventoryLow: () => {
      qc.invalidateQueries({ queryKey: ["inventory", "branch", branchId] });
    },
  });

  const { data: inventoryResponse, isLoading } = useQuery<InventoryResponse>({
    queryKey: ["inventory", "branch", branchId],
    queryFn: () => apiClient.get<InventoryResponse>(`/inventory/branch/${branchId}`),
    enabled: !!branchId,
    refetchInterval: 60_000,
  });

  const items = inventoryResponse?.data ?? [];
  const lowStockCount = items.filter((i) => i.quantity <= i.min_threshold).length;

  return (
    <PageWrapper
      title="Inventory"
      subtitle="Stock levels for this branch"
    >
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Package size={16} />
          <span>{isLoading ? "Loading…" : `${items.length} item${items.length !== 1 ? "s" : ""}`}</span>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-amber-600 font-medium">
            <AlertTriangle size={14} />
            {lowStockCount} low-stock item{lowStockCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      <DataTable<InventoryItem>
        columns={columns}
        data={items}
        loading={isLoading}
        pageSize={20}
        emptyTitle="No inventory items"
        emptyDesc="Inventory items for this branch will appear here once added."
        keyField="id"
      />
    </PageWrapper>
  );
}
