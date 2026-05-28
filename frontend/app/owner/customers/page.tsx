"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Users2,
  Mail,
  Phone,
  CalendarDays,
  ShoppingBag,
  AlertCircle,
  ChevronRight,
  User,
} from "lucide-react";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string | null;
  created_at: string;
  is_active: boolean;
  order_count?: number;
  total_spent?: number;
}

interface CustomerRow extends Record<string, unknown> {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  is_active: boolean;
  order_count: number;
}

// ── Side Sheet ────────────────────────────────────────────────────────────────

function CustomerSheet({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const displayName =
    customer.name ??
    (`${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
      "—");

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 350, damping: 35 }}
        className="bg-white w-full max-w-sm shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1A3C5E]/10 flex items-center justify-center text-[#1A3C5E] font-bold text-sm">
              {displayName[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">{displayName}</h2>
              <StatusBadge status={customer.is_active ? "active" : "inactive"} size="sm" />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sheet body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Contact info */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Contact</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl">
                <Mail size={14} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-700 break-all">{customer.email}</span>
              </div>
              {customer.phone ? (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl">
                  <Phone size={14} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700">{customer.phone}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl text-gray-400 text-sm">
                  <Phone size={14} className="shrink-0" />
                  No phone number
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Activity</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="px-3 py-3 bg-[#1A3C5E]/5 rounded-xl">
                <div className="flex items-center gap-1.5 text-[#1A3C5E] mb-1">
                  <ShoppingBag size={13} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Orders</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 font-mono">
                  {customer.order_count ?? 0}
                </p>
              </div>
              <div className="px-3 py-3 bg-[#E8A020]/8 rounded-xl">
                <div className="flex items-center gap-1.5 text-[#E8A020] mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Joined</span>
                </div>
                <p className="text-sm font-semibold text-gray-700">
                  {formatDate(customer.created_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Account status */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Account</p>
            <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl">
              <span className="text-sm text-gray-600">Status</span>
              <StatusBadge status={customer.is_active ? "active" : "inactive"} />
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl">
              <span className="text-sm text-gray-600">Member since</span>
              <span className="text-sm font-medium text-gray-800">{formatDate(customer.created_at)}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const { restaurantId } = useAuth();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [selected, setSelected] = useState<Customer | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  // ── Fetch customers ────────────────────────────────────────────────────────
  const { data: customers = [], isLoading, isError, refetch } = useQuery<Customer[]>({
    queryKey: ["customers", restaurantId],
    queryFn: () =>
      apiClient.get<Customer[]>(`/users?role=customer&restaurant_id=${restaurantId}`),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });

  // ── Filter + search ────────────────────────────────────────────────────────
  const filtered = useMemo<CustomerRow[]>(() => {
    const q = debouncedSearch.toLowerCase();
    return customers
      .filter((c) => {
        const name = c.name ?? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
        const matchSearch =
          !q ||
          name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q);
        const matchStatus =
          activeFilter === "all" ||
          (activeFilter === "active" && c.is_active) ||
          (activeFilter === "inactive" && !c.is_active);
        return matchSearch && matchStatus;
      })
      .map((c) => ({
        ...c,
        display_name:
          c.name ??
          (`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"),
        phone: c.phone ?? null,
        order_count: c.order_count ?? 0,
      }));
  }, [customers, debouncedSearch, activeFilter]);

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns: Column<CustomerRow>[] = [
    {
      key: "display_name",
      label: "Customer",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1A3C5E]/8 flex items-center justify-center text-[#1A3C5E] font-semibold text-sm shrink-0">
            {(row.display_name as string)[0]?.toUpperCase() ?? <User size={14} />}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{row.display_name as string}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <Mail size={10} /> {row.email as string}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (row) => (
        row.phone ? (
          <span className="text-sm text-gray-600 flex items-center gap-1.5">
            <Phone size={12} className="text-gray-400" />
            {row.phone as string}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )
      ),
    },
    {
      key: "created_at",
      label: "Joined",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-gray-500 flex items-center gap-1.5">
          <CalendarDays size={11} className="text-gray-400" />
          {formatDate(row.created_at as string)}
        </span>
      ),
    },
    {
      key: "order_count",
      label: "Orders",
      sortable: true,
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <ShoppingBag size={12} className="text-[#E8A020]" />
          <span className="font-mono font-semibold text-sm text-gray-700">
            {row.order_count as number}
          </span>
        </div>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      align: "center",
      render: (row) => (
        <StatusBadge status={(row.is_active as boolean) ? "active" : "inactive"} size="sm" />
      ),
    },
    {
      key: "action",
      label: "",
      align: "right",
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const c = customers.find((c) => c.id === row.id);
            if (c) setSelected(c);
          }}
          className="p-1.5 rounded-lg text-gray-300 hover:text-[#1A3C5E] hover:bg-[#1A3C5E]/5 transition"
        >
          <ChevronRight size={14} />
        </button>
      ),
    },
  ];

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Customers
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? "Loading…" : `${filtered.length} of ${customers.length} customers`}
          </p>
        </div>

        {/* Stats chips */}
        {!isLoading && (
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {customers.filter((c) => c.is_active).length} active
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500">
              {customers.filter((c) => !c.is_active).length} inactive
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 flex-1 min-w-56 max-w-sm">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or phone…"
            className="flex-1 text-sm outline-none placeholder:text-gray-400 bg-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-gray-300 hover:text-gray-500">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-semibold capitalize transition",
                activeFilter === f
                  ? "bg-[#1A3C5E] text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 mb-4">
          <AlertCircle size={14} />
          Failed to load customers.{" "}
          <button onClick={() => refetch()} className="underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <DataTable<CustomerRow>
        columns={columns}
        data={filtered}
        loading={isLoading}
        pageSize={20}
        keyField="id"
        emptyTitle="No customers found"
        emptyDesc={
          search || activeFilter !== "all"
            ? "Try adjusting your search or filters"
            : "Customers who have ordered at your restaurant will appear here"
        }
        onRowClick={(row) => {
          const c = customers.find((c) => c.id === row.id);
          if (c) setSelected(c);
        }}
      />

      {/* Side sheet */}
      <AnimatePresence>
        {selected && (
          <CustomerSheet customer={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </PageWrapper>
  );
}