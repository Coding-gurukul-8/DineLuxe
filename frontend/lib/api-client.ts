import { getBrowserSupabase } from "./supabase-client";
import { ApiError, ApiResponse, ApiErrorResponse } from "@repo/shared";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "@/lib/auth-storage";

// ── Base URL ──────────────────────────────────────────────────────────────────
// Falls back to "/api/v1" (relative) when NEXT_PUBLIC_API_URL is undefined —
// safe for same-host deploys where the backend is reverse-proxied onto the
// same origin as the frontend (e.g. via Next.js rewrites or a single Nginx).
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim();
const API_BASE = normalizeApiBase(RAW_API_BASE);

function normalizeApiBase(base?: string): string {
  if (!base) return "/api/v1";
  const trimmed = base.replace(/\/+$/, "");
  if (trimmed.endsWith("/api/v1")) return trimmed;
  if (trimmed.endsWith("/api")) return `${trimmed}/v1`;
  return trimmed;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type RequestMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface NormalizedRequest {
  method: RequestMethod;
  path: string;
  body?: unknown;
}

// ── Supabase guard ────────────────────────────────────────────────────────────
function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url?.startsWith("https://") && key && key !== "anon-key" && key.length > 40
  );
}

// ── Body normalisation ────────────────────────────────────────────────────────
function normalizeBodyKeys(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const record = body as Record<string, unknown>;
  return {
    ...record,
    ...(record.branchId ? { branch_id: record.branchId } : {}),
    ...(record.peopleCount ? { people_count: record.peopleCount } : {}),
    ...(record.tableId ? { table_id: record.tableId } : {}),
  };
}

// ── Route normalisation ───────────────────────────────────────────────────────
// Maps frontend-friendly paths to the actual backend route shapes.
function normalizeRequest(
  method: RequestMethod,
  path: string,
  body?: unknown
): NormalizedRequest {
  const normalized: NormalizedRequest = {
    method,
    path,
    body: normalizeBodyKeys(body),
  };

  const branchTables = path.match(/^\/branch\/([^/?]+)\/tables(\?.*)?$/);
  if (method === "GET" && branchTables) {
    return {
      ...normalized,
      path: `/tables/branch/${branchTables[1]}${branchTables[2] ?? ""}`,
    };
  }

  const branchQueue = path.match(/^\/branch\/([^/?]+)\/queue$/);
  if (method === "GET" && branchQueue) {
    return { ...normalized, path: `/queue/branch/${branchQueue[1]}` };
  }

  const branchBookings = path.match(/^\/branch\/([^/?]+)\/bookings\/today$/);
  if (method === "GET" && branchBookings) {
    // /today suffix was silently returning ALL branch bookings; ?date=today
    // tells the controller to filter to the current day.
    return {
      ...normalized,
      path: `/bookings/branch/${branchBookings[1]}?date=today`,
    };
  }

  const branchActiveOrders = path.match(
    /^\/branch\/([^/?]+)\/orders\/active$/
  );
  if (method === "GET" && branchActiveOrders) {
    return {
      ...normalized,
      path: `/orders/branch/${branchActiveOrders[1]}/active`,
    };
  }

  const tableCurrentOrder = path.match(/^\/tables\/([^/?]+)\/current-order$/);
  if (method === "GET" && tableCurrentOrder) {
    return { ...normalized, path: `/orders/table/${tableCurrentOrder[1]}` };
  }

  const kitchenOrders = path.match(/^\/kitchen\/branch\/([^/?]+)\/orders$/);
  if (method === "GET" && kitchenOrders) {
    return {
      ...normalized,
      path: `/kitchen/branch/${kitchenOrders[1]}/tickets`,
    };
  }

  const kitchenStatus = path.match(/^\/orders\/([^/?]+)\/kitchen-status$/);
  if (method === "PATCH" && kitchenStatus) {
    return {
      ...normalized,
      path: `/kitchen/orders/${kitchenStatus[1]}/status`,
    };
  }

  const markArrived = path.match(/^\/queue\/([^/?]+)\/mark-arrived$/);
  if (method === "POST" && markArrived) {
    return {
      ...normalized,
      method: "PATCH",
      path: `/queue/${markArrived[1]}/arrive`,
    };
  }

  const markNoShow = path.match(/^\/queue\/([^/?]+)\/no-show$/);
  if (method === "POST" && markNoShow) {
    return {
      ...normalized,
      method: "PATCH",
      path: `/queue/${markNoShow[1]}/no-show`,
    };
  }

  const seatQueue = path.match(/^\/queue\/([^/?]+)\/seat$/);
  if (method === "POST" && seatQueue) {
    return {
      ...normalized,
      method: "PATCH",
      path: `/queue/${seatQueue[1]}/assign-table`,
    };
  }

  const seatBooking = path.match(/^\/booking\/([^/?]+)\/seat$/);
  if (method === "POST" && seatBooking) {
    return {
      ...normalized,
      method: "PATCH",
      path: `/bookings/${seatBooking[1]}/seat`,
    };
  }

  const orderPayment = path.match(/^\/orders\/([^/?]+)\/payment$/);
  if (method === "POST" && orderPayment && body && typeof body === "object") {
    const payment = body as Record<string, unknown>;
    return {
      ...normalized,
      path: "/payments/initiate",
      body: {
        order_id: orderPayment[1],
        payment_method:
          payment.method === "upi"
            ? "upi"
            : payment.method === "card"
              ? "card"
              : "cash",
      },
    };
  }

  return normalized;
}

// ── Auth headers ──────────────────────────────────────────────────────────────
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = { "Content-Type": "application/json" };

  const accessToken = getAccessToken();
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
    return headers;
  }

  if (!isSupabaseConfigured()) return headers;

  const supabase = await getBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return headers;
}

// ── Token refresh ─────────────────────────────────────────────────────────────
// Returns true when a new token pair was stored; false on any failure.
// On failure it clears all stored tokens and redirects to /auth/login using
// window.location.href (not the Next.js router) to perform a hard navigation
// that fully breaks any in-progress render loop and clears React state.
async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthTokens();
    window.location.href = "/auth/login";
    return false;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Network failure — do not log out; the retry logic in request() will
    // surface the original error to the caller.
    return false;
  }

  if (!res.ok) {
    clearAuthTokens();
    window.location.href = "/auth/login";
    return false;
  }

  const json: ApiResponse<{ accessToken: string; refreshToken: string }> =
    await res.json();

  if (!json?.data?.accessToken || !json?.data?.refreshToken) {
    clearAuthTokens();
    window.location.href = "/auth/login";
    return false;
  }

  setAuthTokens({
    accessToken: json.data.accessToken,
    refreshToken: json.data.refreshToken,
  });
  return true;
}

// ── Core request ──────────────────────────────────────────────────────────────
async function request<T>(
  method: RequestMethod,
  path: string,
  body?: unknown,
  allowRetry = true
): Promise<T> {
  const normalized = normalizeRequest(method, path, body);
  const headers = await getAuthHeaders();

  const res = await fetch(`${API_BASE}${normalized.path}`, {
    method: normalized.method,
    headers,
    ...(normalized.body !== undefined
      ? { body: JSON.stringify(normalized.body) }
      : {}),
  });

  if (!res.ok) {
    // Attempt a single token refresh on 401, but never on auth routes to
    // avoid an infinite refresh loop.
    if (
      res.status === 401 &&
      allowRetry &&
      !normalized.path.startsWith("/auth/")
    ) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return request<T>(method, path, body, false);
      }
      // tryRefreshToken already redirected — return a never-settling promise
      // so the caller's UI does not flash an error before the navigation fires.
      return new Promise<T>(() => {});
    }

    const errBody: ApiErrorResponse = await res.json().catch(() => ({
      success: false as const,
      error: { code: "UNKNOWN", message: "Unknown error occurred" },
    }));
    throw new ApiError(
      res.status,
      errBody.error?.code ?? "UNKNOWN",
      errBody.error?.message ?? "Request failed",
      errBody.error?.field
    );
  }

  // 204 No Content — return undefined cast to T (caller should not use value).
  if (res.status === 204) return undefined as unknown as T;

  const json: ApiResponse<T> = await res.json();
  return json.data;
}

// ── FormData request ──────────────────────────────────────────────────────────
// Sends a multipart/form-data body. The Content-Type header is intentionally
// omitted so the browser can set it automatically with the correct boundary.
async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  const accessToken = getAccessToken();
  const headers: HeadersInit = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errBody: ApiErrorResponse = await res.json().catch(() => ({
      success: false as const,
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

// ── Public API client ─────────────────────────────────────────────────────────
export const apiClient = {
  /** HTTP GET — no request body. */
  get: <T>(path: string) => request<T>("GET", path),

  /** HTTP POST with a JSON body. */
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),

  /** HTTP PATCH with a JSON body. */
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),

  /** HTTP PUT with a JSON body. */
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),

  /** HTTP DELETE — no request body. */
  delete: <T>(path: string) => request<T>("DELETE", path),

  /**
   * HTTP POST with a FormData body (multipart/form-data).
   * The Content-Type header is deliberately omitted so the browser appends the
   * correct multipart boundary. Use this for file uploads and mixed payloads.
   */
  postForm: <T>(path: string, formData: FormData) =>
    requestForm<T>(path, formData),
};