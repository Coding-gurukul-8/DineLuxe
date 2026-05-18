"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ShoppingBag } from "lucide-react";

interface Order {
  id: string;
  status: string;
  total: number;
  order_type: string;
  created_at: string;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const columns: Column<Order>[] = [
  {
    key: "id",
    label: "Order ID",
    render: (row) => (
      <span className="font-mono text-xs text-gray-500">#{row.id.slice(-8).toUpperCase()}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "order_type",
    label: "Type",
    render: (row) => (
      <span className="capitalize text-gray-700">{row.order_type?.replace("_", " ") ?? "-"}</span>
    ),
  },
  {
    key: "total",
    label: "Total",
    sortable: true,
    align: "right",
    render: (row) => (
      <span className="font-semibold text-gray-900">{formatCurrency(row.total ?? 0)}</span>
    ),
  },
  {
    key: "created_at",
    label: "Date",
    sortable: true,
    render: (row) => (
      <span className="text-gray-500 text-sm">
        {new Date(row.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </span>
    ),
  },
];

export default function CustomerOrderHistoryPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", "user", "me"],
    queryFn: () => apiClient.get<Order[]>("/orders/user/me"),
  });

  return (
    <PageWrapper title="Order History" subtitle="All your past orders">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
          <ShoppingBag size={20} />
        </div>
        <p className="text-sm text-gray-500">
          {isLoading ? "Loading…" : `${orders.length} order${orders.length !== 1 ? "s" : ""} found`}
        </p>
      </div>

      <DataTable<Order>
        columns={columns}
        data={orders}
        loading={isLoading}
        pageSize={15}
        emptyTitle="No orders yet"
        emptyDesc="Your order history will appear here once you place your first order."
        keyField="id"
      />
    </PageWrapper>
  );
}
