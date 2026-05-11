import { getBrowserSupabase } from "./supabase-client";
import { ApiError, ApiResponse, ApiErrorResponse } from "@repo/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || "/api/v1";

type RequestMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface NormalizedRequest {
  method: RequestMethod;
  path: string;
  body?: unknown;
}

function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url?.startsWith("https://") && key && key !== "anon-key" && key.length > 40);
}

function normalizeBodyKeys(body: unknown) {
  if (!body || typeof body !== "object") return body;
  const record = body as Record<string, unknown>;

  return {
    ...record,
    ...(record.branchId ? { branch_id: record.branchId } : {}),
    ...(record.peopleCount ? { people_count: record.peopleCount } : {}),
    ...(record.tableId ? { table_id: record.tableId } : {}),
  };
}

function normalizeRequest(method: RequestMethod, path: string, body?: unknown): NormalizedRequest {
  const normalized: NormalizedRequest = { method, path, body: normalizeBodyKeys(body) };

  const branchTables = path.match(/^\/branch\/([^/?]+)\/tables(\?.*)?$/);
  if (method === "GET" && branchTables) {
    return { ...normalized, path: `/tables/branch/${branchTables[1]}${branchTables[2] ?? ""}` };
  }

  const branchQueue = path.match(/^\/branch\/([^/?]+)\/queue$/);
  if (method === "GET" && branchQueue) {
    return { ...normalized, path: `/queue/branch/${branchQueue[1]}` };
  }

  const branchBookings = path.match(/^\/branch\/([^/?]+)\/bookings\/today$/);
  if (method === "GET" && branchBookings) {
    return { ...normalized, path: `/bookings/branch/${branchBookings[1]}` };
  }

  const branchActiveOrders = path.match(/^\/branch\/([^/?]+)\/orders\/active$/);
  if (method === "GET" && branchActiveOrders) {
    return { ...normalized, path: `/orders/branch/${branchActiveOrders[1]}/active` };
  }

  const tableCurrentOrder = path.match(/^\/tables\/([^/?]+)\/current-order$/);
  if (method === "GET" && tableCurrentOrder) {
    return { ...normalized, path: `/orders/table/${tableCurrentOrder[1]}` };
  }

  const kitchenOrders = path.match(/^\/kitchen\/branch\/([^/?]+)\/orders$/);
  if (method === "GET" && kitchenOrders) {
    return { ...normalized, path: `/kitchen/branch/${kitchenOrders[1]}/tickets` };
  }

  const kitchenStatus = path.match(/^\/orders\/([^/?]+)\/kitchen-status$/);
  if (method === "PATCH" && kitchenStatus) {
    return { ...normalized, path: `/kitchen/orders/${kitchenStatus[1]}/status` };
  }

  const markArrived = path.match(/^\/queue\/([^/?]+)\/mark-arrived$/);
  if (method === "POST" && markArrived) {
    return { ...normalized, method: "PATCH", path: `/queue/${markArrived[1]}/arrive` };
  }

  const markNoShow = path.match(/^\/queue\/([^/?]+)\/no-show$/);
  if (method === "POST" && markNoShow) {
    return { ...normalized, method: "PATCH", path: `/queue/${markNoShow[1]}/no-show` };
  }

  const seatQueue = path.match(/^\/queue\/([^/?]+)\/seat$/);
  if (method === "POST" && seatQueue) {
    return { ...normalized, method: "PATCH", path: `/queue/${seatQueue[1]}/assign-table` };
  }

  const seatBooking = path.match(/^\/booking\/([^/?]+)\/seat$/);
  if (method === "POST" && seatBooking) {
    return { ...normalized, method: "PATCH", path: `/bookings/${seatBooking[1]}/seat` };
  }

  const orderPayment = path.match(/^\/orders\/([^/?]+)\/payment$/);
  if (method === "POST" && orderPayment && body && typeof body === "object") {
    const payment = body as Record<string, unknown>;
    return {
      ...normalized,
      path: "/payments/initiate",
      body: {
        order_id: orderPayment[1],
        payment_method: payment.method === "upi" ? "upi" : payment.method === "card" ? "card" : "cash",
      },
    };
  }

  return normalized;
}
 
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = { "Content-Type": "application/json" };

  if (!isSupabaseConfigured()) {
    return headers;
  }

  const supabase = await getBrowserSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return headers;
}
 
async function request<T>(method: RequestMethod, path: string, body?: unknown): Promise<T> {
  const normalized = normalizeRequest(method, path, body);
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${normalized.path}`, {
    method: normalized.method,
    headers,
    ...(normalized.body ? { body: JSON.stringify(normalized.body) } : {}),
  });
 
  if (!res.ok) {
    const errBody: ApiErrorResponse = await res.json().catch(() => ({
      success: false,
      error: { code: "UNKNOWN", message: "Unknown error occurred" },
    }));
    throw new ApiError(
      res.status,
      errBody.error?.code ?? "UNKNOWN",
      errBody.error?.message ?? "Request failed",
      errBody.error?.field
    );
  }
 
  if (res.status === 204) return undefined as unknown as T;
  const json: ApiResponse<T> = await res.json();
  return json.data;
}
 
export const apiClient = {
  get:    <T>(path: string)              => request<T>("GET",    path),
  post:   <T>(path: string, body: unknown) => request<T>("POST",   path, body),
  patch:  <T>(path: string, body: unknown) => request<T>("PATCH",  path, body),
  put:    <T>(path: string, body: unknown) => request<T>("PUT",    path, body),
  delete: <T>(path: string)              => request<T>("DELETE", path),
};
