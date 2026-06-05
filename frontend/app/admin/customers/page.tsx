"use client";

import { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Users,
  AlertCircle,
  ShoppingBag,
  Mail,
  MoreHorizontal,
  ShieldOff,
  ShieldCheck,
  Flag,
  Eye,
  Loader2,
  X,
  TicketCheck,
  RefreshCw,
} from "lucide-react";

import PageWrapper from "@/components/layout/PageWrapper";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { apiClient } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  name?: string | null;
  email: string;
  created_at?: string;
  total_orders?: number;
  phone?: string | null;
  is_active?: boolean;
  is_flagged?: boolean;
  flag_reason?: string | null;
  suspension_reason?: string | null;
  suspended_at?: string | null;
}

interface CustomerDetail {
  profile: Customer & { date_of_birth?: string | null };
  orderSummary: {
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: string | null;
  };
  openTickets: number;
  pendingRefunds: Array<{
    id: string;
    order_id: string;
    amount: number;
    reason: string;
    status: string;
    created_at: string;
  }>;
  accountStatus: "active" | "suspended" | "flagged";
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function patchCustomer(path: string, body?: object) {
  return apiClient.patch(path, body ?? {});
}

// ─── Shared status badge ──────────────────────────────────────────────────────

function AccountStatusBadge({ customer }: { customer: Customer }) {
  if (customer.is_active === false) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Suspended
      </span>
    );
  }
  if (customer.is_flagged) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Flagged
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Active
    </span>
  );
}

// ─── Customer Detail Sheet ────────────────────────────────────────────────────

function CustomerDetailSheet({
  customerId,
  open,
  onClose,
  onActionComplete,
}: {
  customerId: string | null;
  open: boolean;
  onClose: () => void;
  onActionComplete: () => void;
}) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Suspend dialog
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(false);

  // Flag inline state
  const [flagReason, setFlagReason] = useState("");
  const [flagging, setFlagging] = useState(false);
  const [showFlagInput, setShowFlagInput] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const data = await apiClient.get<CustomerDetail>(
        `/admin/customers/${customerId}`
      );
      setDetail(data);
    } catch {
      toast.error("Failed to load customer details");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // Fetch when sheet opens
  useMemo(() => {
    if (open && customerId) {
      setDetail(null);
      setShowFlagInput(false);
      setFlagReason("");
      fetchDetail();
    }
  }, [open, customerId]);

  const handleSuspend = async () => {
    if (!customerId || suspendReason.trim().length < 5) return;
    setSuspending(true);
    try {
      await patchCustomer(`/admin/customers/${customerId}/suspend`, {
        reason: suspendReason,
      });
      toast.success("Customer suspended");
      setSuspendOpen(false);
      setSuspendReason("");
      await fetchDetail();
      onActionComplete();
    } catch {
      toast.error("Failed to suspend customer");
    } finally {
      setSuspending(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!customerId) return;
    try {
      await patchCustomer(`/admin/customers/${customerId}/unsuspend`);
      toast.success("Customer unsuspended");
      await fetchDetail();
      onActionComplete();
    } catch {
      toast.error("Failed to unsuspend customer");
    }
  };

  const handleFlag = async () => {
    if (!customerId || flagReason.trim().length < 5) return;
    setFlagging(true);
    try {
      await patchCustomer(`/admin/customers/${customerId}/flag`, {
        reason: flagReason,
      });
      toast.success("Customer flagged for review");
      setShowFlagInput(false);
      setFlagReason("");
      await fetchDetail();
      onActionComplete();
    } catch {
      toast.error("Failed to flag customer");
    } finally {
      setFlagging(false);
    }
  };

  const isSuspended = detail?.accountStatus === "suspended";

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Customer Details</SheetTitle>
          </SheetHeader>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}

          {!loading && detail && (
            <div className="space-y-6 text-sm">
              {/* Profile */}
              <section className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1A3C5E]/10 flex items-center justify-center text-sm font-bold text-[#1A3C5E] shrink-0">
                    {(detail.profile.name ?? detail.profile.email)
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800">
                      {detail.profile.name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {detail.profile.email}
                    </p>
                  </div>
                  <AccountStatusBadge customer={detail.profile} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {detail.profile.phone && (
                    <div>
                      <p className="text-gray-400">Phone</p>
                      <p className="font-medium">{detail.profile.phone}</p>
                    </div>
                  )}
                  {detail.profile.date_of_birth && (
                    <div>
                      <p className="text-gray-400">Date of Birth</p>
                      <p className="font-medium">
                        {formatDate(detail.profile.date_of_birth)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400">Member since</p>
                    <p className="font-medium">
                      {detail.profile.created_at
                        ? formatDate(detail.profile.created_at)
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Suspension reason */}
                {isSuspended && detail.profile.suspension_reason && (
                  <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs">
                    <p className="font-semibold text-red-700 mb-1">
                      Suspension reason
                    </p>
                    <p className="text-red-600">
                      {detail.profile.suspension_reason}
                    </p>
                    {detail.profile.suspended_at && (
                      <p className="text-red-400 mt-1">
                        Since {formatDate(detail.profile.suspended_at)}
                      </p>
                    )}
                  </div>
                )}

                {/* Flag reason */}
                {detail.accountStatus === "flagged" &&
                  detail.profile.flag_reason && (
                    <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs">
                      <p className="font-semibold text-amber-700 mb-1">
                        Flag reason
                      </p>
                      <p className="text-amber-600">
                        {detail.profile.flag_reason}
                      </p>
                    </div>
                  )}
              </section>

              {/* Order summary */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <ShoppingBag size={12} />
                  Order Summary
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Orders", value: detail.orderSummary.totalOrders },
                    {
                      label: "Spent",
                      value: `₹${detail.orderSummary.totalSpent.toLocaleString("en-IN")}`,
                    },
                    {
                      label: "Last Order",
                      value: detail.orderSummary.lastOrderDate
                        ? formatDate(detail.orderSummary.lastOrderDate)
                        : "—",
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-center"
                    >
                      <p className="font-bold text-gray-800 text-sm">{value}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Tickets */}
              <section className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-2 text-gray-600">
                  <TicketCheck size={14} />
                  <span>Open support tickets</span>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-semibold",
                    detail.openTickets > 0
                      ? "bg-orange-100 text-orange-700"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {detail.openTickets}
                </span>
              </section>

              {/* Pending refunds */}
              {detail.pendingRefunds.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <RefreshCw size={12} />
                    Pending Refunds ({detail.pendingRefunds.length})
                  </h3>
                  <div className="space-y-1.5">
                    {detail.pendingRefunds.map((r) => (
                      <div
                        key={r.id}
                        className="flex justify-between items-center rounded-lg border border-gray-100 px-3 py-2 text-xs"
                      >
                        <span className="text-gray-600 truncate max-w-[60%]">
                          {r.reason}
                        </span>
                        <span className="font-semibold text-gray-800">
                          ₹{r.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Actions */}
              <section className="border-t pt-4 space-y-2">
                {isSuspended ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-green-500 text-green-700 hover:bg-green-50"
                    onClick={handleUnsuspend}
                  >
                    <ShieldCheck size={14} className="mr-2" />
                    Unsuspend Account
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => setSuspendOpen(true)}
                  >
                    <ShieldOff size={14} className="mr-2" />
                    Suspend Account
                  </Button>
                )}

                {showFlagInput ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full rounded-lg border border-gray-200 text-xs p-2.5 resize-none outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
                      rows={3}
                      placeholder="Describe the policy concern… (min 5 chars)"
                      value={flagReason}
                      onChange={(e) => setFlagReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowFlagInput(false);
                          setFlagReason("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={flagReason.trim().length < 5 || flagging}
                        onClick={handleFlag}
                      >
                        {flagging && (
                          <Loader2 size={12} className="animate-spin mr-1.5" />
                        )}
                        Confirm Flag
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowFlagInput(true)}
                  >
                    <Flag size={14} className="mr-2" />
                    {detail.accountStatus === "flagged"
                      ? "Re-Flag for Review"
                      : "Flag for Review"}
                  </Button>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Suspend confirmation dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldOff size={18} />
              Suspend {detail?.profile.name ?? "Customer"}?
            </DialogTitle>
            <DialogDescription>
              They will lose access immediately. You can reverse this at any
              time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-sm font-medium text-gray-700">
              Reason for suspension{" "}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-200 text-sm p-3 resize-none outline-none focus:ring-2 focus:ring-red-200 min-h-[80px]"
              placeholder="Describe the policy violation… (min 5 chars)"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={suspendReason.trim().length < 5 || suspending}
              onClick={handleSuspend}
            >
              {suspending && (
                <Loader2 size={14} className="animate-spin mr-2" />
              )}
              Suspend Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Row Actions dropdown ─────────────────────────────────────────────────────

function CustomerRowActions({
  customer,
  onViewDetails,
  onActionComplete,
}: {
  customer: Customer;
  onViewDetails: () => void;
  onActionComplete: () => void;
}) {
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(false);

  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagging, setFlagging] = useState(false);

  const isSuspended = customer.is_active === false;

  const handleSuspend = async () => {
    if (suspendReason.trim().length < 5) return;
    setSuspending(true);
    try {
      await patchCustomer(`/admin/customers/${customer.id}/suspend`, {
        reason: suspendReason,
      });
      toast.success(`${customer.name ?? customer.email} suspended`);
      setSuspendOpen(false);
      setSuspendReason("");
      onActionComplete();
    } catch {
      toast.error("Failed to suspend customer");
    } finally {
      setSuspending(false);
    }
  };

  const handleUnsuspend = async () => {
    try {
      await patchCustomer(`/admin/customers/${customer.id}/unsuspend`);
      toast.success(`${customer.name ?? customer.email} unsuspended`);
      onActionComplete();
    } catch {
      toast.error("Failed to unsuspend customer");
    }
  };

  const handleFlag = async () => {
    if (flagReason.trim().length < 5) return;
    setFlagging(true);
    try {
      await patchCustomer(`/admin/customers/${customer.id}/flag`, {
        reason: flagReason,
      });
      toast.success(`${customer.name ?? customer.email} flagged for review`);
      setFlagOpen(false);
      setFlagReason("");
      onActionComplete();
    } catch {
      toast.error("Failed to flag customer");
    } finally {
      setFlagging(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={16} className="text-gray-500" />
            <span className="sr-only">Actions</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
          >
            <Eye size={14} />
            View Details
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {isSuspended ? (
            <DropdownMenuItem
              className="gap-2 text-green-700 focus:text-green-800"
              onClick={(e) => {
                e.stopPropagation();
                handleUnsuspend();
              }}
            >
              <ShieldCheck size={14} />
              Unsuspend Account
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="gap-2 text-red-600 focus:text-red-700"
              onClick={(e) => {
                e.stopPropagation();
                setSuspendOpen(true);
              }}
            >
              <ShieldOff size={14} />
              Suspend Account
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            className="gap-2"
            onClick={(e) => {
              e.stopPropagation();
              setFlagOpen(true);
            }}
          >
            <Flag size={14} />
            Flag for Review
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Suspend dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldOff size={18} />
              Suspend {customer.name ?? customer.email}?
            </DialogTitle>
            <DialogDescription>
              They will lose access immediately. You can reverse this at any
              time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-sm font-medium text-gray-700">
              Reason for suspension{" "}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-200 text-sm p-3 resize-none outline-none focus:ring-2 focus:ring-red-200 min-h-[80px]"
              placeholder="Describe the policy violation… (min 5 chars)"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={suspendReason.trim().length < 5 || suspending}
              onClick={handleSuspend}
            >
              {suspending && (
                <Loader2 size={14} className="animate-spin mr-2" />
              )}
              Suspend Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag dialog */}
      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag size={18} />
              Flag {customer.name ?? customer.email} for Review
            </DialogTitle>
            <DialogDescription>
              The account stays active — this marks it for admin review only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-sm font-medium text-gray-700">
              Flag reason <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-200 text-sm p-3 resize-none outline-none focus:ring-2 focus:ring-[#1A3C5E]/20 min-h-[80px]"
              placeholder="Describe the policy concern… (min 5 chars)"
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={flagReason.trim().length < 5 || flagging}
              onClick={handleFlag}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {flagging && (
                <Loader2 size={14} className="animate-spin mr-2" />
              )}
              Flag for Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  // Detail sheet
  const [sheetCustomerId, setSheetCustomerId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const refetchCustomers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
  }, [queryClient]);

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
      render: (row) => <AccountStatusBadge customer={row} />,
    },
    {
      key: "id",
      label: "",
      align: "right",
      render: (row) => (
        <CustomerRowActions
          customer={row}
          onViewDetails={() => {
            setSheetCustomerId(row.id);
            setSheetOpen(true);
          }}
          onActionComplete={refetchCustomers}
        />
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
              {customers.filter((c) => c.is_active !== false && !c.is_flagged).length} active
            </span>
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-700">
              {customers.filter((c) => c.is_active === false).length} suspended
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700">
              {customers.filter((c) => c.is_flagged).length} flagged
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

      {/* Detail sheet */}
      <CustomerDetailSheet
        customerId={sheetCustomerId}
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setSheetCustomerId(null);
        }}
        onActionComplete={refetchCustomers}
      />
    </PageWrapper>
  );
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