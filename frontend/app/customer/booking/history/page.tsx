"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CalendarDays } from "lucide-react";

interface Booking {
  id: string;
  status: string;
  scheduled_at: string;
  party_size: number;
  notes?: string;
  branch?: { name: string };
}

const columns: Column<Booking>[] = [
  {
    key: "id",
    label: "Booking ID",
    render: (row) => (
      <span className="font-mono text-xs text-gray-500">#{row.id.slice(-8).toUpperCase()}</span>
    ),
  },
  {
    key: "branch",
    label: "Branch",
    render: (row) => <span className="text-gray-700">{row.branch?.name ?? "—"}</span>,
  },
  {
    key: "scheduled_at",
    label: "Date & Time",
    sortable: true,
    render: (row) => (
      <span className="text-gray-600 text-sm">
        {new Date(row.scheduled_at).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    ),
  },
  {
    key: "party_size",
    label: "Guests",
    align: "center",
    sortable: true,
    render: (row) => <span className="font-medium text-gray-800">{row.party_size}</span>,
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export default function CustomerBookingHistoryPage() {
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", "user", "me"],
    queryFn: () => apiClient.get<Booking[]>("/bookings/user/me"),
  });

  return (
    <PageWrapper title="Booking History" subtitle="Your past and upcoming reservations">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
          <CalendarDays size={20} />
        </div>
        <p className="text-sm text-gray-500">
          {isLoading ? "Loading…" : `${bookings.length} booking${bookings.length !== 1 ? "s" : ""} found`}
        </p>
      </div>

      <DataTable<Booking>
        columns={columns}
        data={bookings}
        loading={isLoading}
        pageSize={15}
        emptyTitle="No bookings yet"
        emptyDesc="Your table reservations will appear here once you make a booking."
        keyField="id"
      />
    </PageWrapper>
  );
}
