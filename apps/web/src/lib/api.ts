/**
 * Typed API client.
 *
 * The backend returns a diagnosed fault on every failure — id, what, why and a
 * concrete action. This client preserves all of it as an `ApiError`, so the UI
 * can show the user what to do instead of "Something went wrong".
 *
 * Token refresh is handled here and nowhere else: a 401 triggers one refresh
 * attempt, and concurrent 401s share that single attempt rather than each
 * firing their own.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

export interface FaultBody {
  id: string;
  what: string;
  why: string;
  action: string;
  trace_id?: string;
  context?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fault: FaultBody;

  constructor(status: number, fault: FaultBody) {
    super(fault.what);
    this.name = "ApiError";
    this.status = status;
    this.fault = fault;
  }
}

/** A failure before the server was even reached — offline, DNS, cold start. */
function networkFault(cause: unknown): ApiError {
  return new ApiError(0, {
    id: "NETWORK_UNREACHABLE",
    what: "Could not reach the Coinfold server.",
    why:
      "The request never completed. The server may be waking from sleep — a " +
      "free hosting tier idles after 15 minutes and takes around 30 seconds " +
      "to come back.",
    action: "Wait about thirty seconds and press Retry.",
    context: { cause: String(cause) },
  });
}

// --- Tokens ----------------------------------------------------------------
// sessionStorage, not localStorage: the token dies with the tab rather than
// persisting on a shared machine.

const ACCESS = "coinfold.access";
const REFRESH = "coinfold.refresh";

export const tokens = {
  get access() {
    return typeof window === "undefined" ? null : sessionStorage.getItem(ACCESS);
  },
  get refresh() {
    return typeof window === "undefined" ? null : sessionStorage.getItem(REFRESH);
  },
  set(access: string, refresh: string) {
    sessionStorage.setItem(ACCESS, access);
    sessionStorage.setItem(REFRESH, refresh);
  },
  clear() {
    sessionStorage.removeItem(ACCESS);
    sessionStorage.removeItem(REFRESH);
  },
};

// Shared across concurrent 401s so a page issuing six requests refreshes once.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const token = tokens.refresh;
  if (!token) return false;

  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: token }),
      });
      if (!res.ok) return false;
      const body = await res.json();
      tokens.set(body.access_token, body.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so every awaiting caller sees this result.
      setTimeout(() => (refreshInFlight = null), 0);
    }
  })();

  return refreshInFlight;
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Internal: stops a refreshed request from recursing forever. */
  retried?: boolean;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(opts.params ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const access = tokens.access;
  if (access) headers.Authorization = `Bearer ${access}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (cause) {
    // An aborted request is the caller superseding it, not a failure to report.
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw networkFault(cause);
  }

  if (res.status === 401 && !opts.retried && tokens.refresh) {
    if (await refreshTokens()) {
      return request<T>(path, { ...opts, retried: true });
    }
    tokens.clear();
  }

  if (!res.ok) {
    let fault: FaultBody;
    try {
      fault = (await res.json()).error;
    } catch {
      fault = {
        id: "RESPONSE_UNPARSEABLE",
        what: "The server sent a reply this app could not read.",
        why: `HTTP ${res.status} with a body that was not the expected JSON fault shape.`,
        action: "Press Retry. If it repeats, check the API logs for this trace id.",
        trace_id: res.headers.get("X-Trace-Id") ?? undefined,
      };
    }
    throw new ApiError(res.status, fault);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// --- Domain types -----------------------------------------------------------

export interface Transaction {
  id: number;
  source_id: string;
  occurred_at: string;
  merchant: string;
  category_slug: string;
  category_label: string;
  accent_hue: number;
  amount: string;
  currency: string;
  status: "SUCCESS" | "PENDING" | "FAILED";
  method: "CREDIT_CARD" | "DEBIT_CARD" | "UPI" | "NETBANKING";
  is_anomalous: boolean;
  coins_earned: number;
}

export interface Anomaly {
  kind: string;
  original_value: string | null;
  resolution: string;
}

export interface TransactionDetail extends Transaction {
  source_row_index: number;
  anomalies: Anomaly[];
}

export interface Page<T> {
  rows: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface Summary {
  matched: number;
  total_spend: string;
  total_refunded: string;
  failed: number;
  pending: number;
  coins_earned: number;
  anomalous: number;
}

export interface CategorySpend {
  category_slug: string;
  category_label: string;
  accent_hue: number;
  total: string;
  transactions: number;
}

export interface MonthlyPoint {
  month: string;
  total: string;
  transactions: number;
}

export interface Facets {
  categories: { slug: string; label: string; accent_hue: number; transactions: number }[];
  statuses: string[];
  methods: string[];
  amount_min: string | null;
  amount_max: string | null;
  date_min: string | null;
  date_max: string | null;
  total: number;
}

export interface Balance {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

export interface Reward {
  id: number;
  slug: string;
  title: string;
  description: string;
  coin_cost: number;
  rupee_value: string;
  stock: number | null;
  affordable: boolean;
  coins_short: number;
  in_stock: boolean;
}

export interface Redemption {
  id: number;
  slug: string;
  title: string;
  coin_cost: number;
  rupee_value: string;
  status: string;
  voucher_code: string;
  created_at: string;
  balance: number;
  replayed: boolean;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
}

// --- Query shape ------------------------------------------------------------

export interface TxQuery {
  search?: string;
  categories?: string[];
  statuses?: string[];
  methods?: string[];
  date_from?: string;
  date_to?: string;
  amount_min?: string;
  amount_max?: string;
  include_anomalous?: boolean;
  sort_by?: "date" | "amount";
  direction?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

/** Flattens a query into the comma-separated form the API expects. */
export function toParams(q: TxQuery): Record<string, string | number | boolean | undefined> {
  return {
    search: q.search || undefined,
    categories: q.categories?.length ? q.categories.join(",") : undefined,
    statuses: q.statuses?.length ? q.statuses.join(",") : undefined,
    methods: q.methods?.length ? q.methods.join(",") : undefined,
    date_from: q.date_from || undefined,
    date_to: q.date_to || undefined,
    amount_min: q.amount_min || undefined,
    amount_max: q.amount_max || undefined,
    include_anomalous: q.include_anomalous === false ? false : undefined,
    sort_by: q.sort_by,
    direction: q.direction,
    page: q.page,
    page_size: q.page_size,
  };
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User; tokens: { access_token: string; refresh_token: string } }>(
      "/api/auth/login",
      { method: "POST", body: { email, password } },
    ),

  register: (email: string, display_name: string, password: string) =>
    request<{ user: User; tokens: { access_token: string; refresh_token: string } }>(
      "/api/auth/register",
      { method: "POST", body: { email, display_name, password } },
    ),

  me: () => request<User>("/api/auth/me"),

  transactions: (q: TxQuery, signal?: AbortSignal) =>
    request<Page<Transaction>>("/api/transactions", { params: toParams(q), signal }),

  transaction: (id: number) => request<TransactionDetail>(`/api/transactions/${id}`),

  summary: (q: TxQuery, signal?: AbortSignal) =>
    request<Summary>("/api/transactions/summary", { params: toParams(q), signal }),

  facets: () => request<Facets>("/api/transactions/facets"),

  byCategory: (q: TxQuery, signal?: AbortSignal) =>
    request<CategorySpend[]>("/api/analytics/by-category", { params: toParams(q), signal }),

  monthly: (q: TxQuery, signal?: AbortSignal) =>
    request<MonthlyPoint[]>("/api/analytics/monthly", { params: toParams(q), signal }),

  balance: () => request<Balance>("/api/rewards/balance"),

  catalogue: () => request<Reward[]>("/api/rewards/catalogue"),

  redeem: (reward_id: number, idempotency_key: string) =>
    request<Redemption>("/api/rewards/redeem", {
      method: "POST",
      body: { reward_id, idempotency_key },
    }),

  redemptions: () =>
    request<Omit<Redemption, "balance" | "replayed">[]>("/api/rewards/redemptions"),
};
