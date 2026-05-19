"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, AlertCircle, ShoppingBag, Mail } from "lucide-react";

import PageWrapper from "@/components/layout/PageWrapper";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { apiClient } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  name?: string | null;
  email: string;
  created_at?: string;
  total_orders?: number;
  phone?: string | null;
  is_active?: boolean;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");

  // GET /admin/customers?role=customer
  // adminService.getCustomers() returns paginated users with role=customer.
  // The controller unwraps pagination into { data, count } — apiClient strips
  // the outer ApiResponse envelope so we receive { data, count } or Customer[].
  const { data: raw, isLoading, isError } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () =>
      apiClient.get<Customer[] | { data: Customer[]; count: number }>(
        "/admin/customers?role=customer"
      ),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  // Normalise response shape
  const customers: Customer[] = useMemo(() => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if ("data" in raw && Array.isArray(raw.data)) return raw.data;
    return [];
  }, [raw]);

  // Client-side search filter
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(needle) ||
        c.email?.toLowerCase().includes(needle)
    );
  }, [customers, search]);

  // ── DataTable columns ─────────────────────────────────────────────────────

  const columns: Column<Customer>[] = [
    {
      key: "name",
      label: "Customer",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#1A3C5E]/10 flex items-center justify-center text-xs font-bold text-[#1A3C5E] shrink-0">
            {(row.name ?? row.email).slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-800 leading-tight">
              {row.name ?? "—"}
            </p>
            <p className="text-xs text-gray-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (row) => (
        <a
          href={`mailto:${row.email}`}
          className="flex items-center gap-1.5 text-[#1A3C5E] hover:underline text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <Mail size={13} />
          {row.email}
        </a>
      ),
    },
    {
      key: "created_at",
      label: "Joined",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-gray-600">
          {row.created_at ? formatDate(row.created_at) : "—"}
        </span>
      ),
    },
    {
      key: "total_orders",
      label: "Total Orders",
      sortable: true,
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1.5">
          <ShoppingBag size={13} className="text-gray-400" />
          <span className="font-semibold text-gray-800">
            {row.total_orders ?? 0}
          </span>
        </div>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      align: "center",
      render: (row) => (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
            row.is_active === false
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-700"
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              row.is_active === false ? "bg-red-500" : "bg-green-500"
            )}
          />
          {row.is_active === false ? "Inactive" : "Active"}
        </span>
      ),
    },
  ];

  return (
    <PageWrapper
      title="Customers"
      subtitle="All registered customers on the platform"
    >
      <div className="space-y-5">

        {/* Stats pills */}
        {!isLoading && (
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600">
              {customers.length} total
            </span>
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">
              {customers.filter((c) => c.is_active !== false).length} active
            </span>
            <span className="px-3 py-1 rounded-full bg-[#1A3C5E]/10 text-[#1A3C5E]">
              {customers.reduce((s, c) => s + (c.total_orders ?? 0), 0)} total
              orders
            </span>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
          />
        </div>

        {/* Error */}
        {isError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            <AlertCircle size={16} />
            Failed to load customers. Check your permissions and try again.
          </div>
        )}

        {/* Empty state when not loading and nothing returned */}
        {!isLoading && !isError && filtered.length === 0 && !search && (
          <div className="flex flex-col items-center gap-3 py-16 bg-white rounded-xl border border-gray-100">
            <Users size={40} className="text-gray-200" />
            <p className="text-sm text-gray-400">No customers found</p>
          </div>
        )}

        {/* DataTable */}
        {(isLoading || filtered.length > 0 || !!search) && (
          <DataTable<Customer>
            columns={columns}
            data={filtered}
            loading={isLoading}
            pageSize={20}
            keyField="id"
            emptyTitle="No customers found"
            emptyDesc={
              search
                ? `No customers match "${search}"`
                : "No customer records available"
            }
          />
        )}
      </div>
    </PageWrapper>
  );
}