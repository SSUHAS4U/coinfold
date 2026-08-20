"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import {
  ApiError,
  api,
  type Balance,
  type CategorySpend,
  type Facets,
  type MonthlyPoint,
  type Reward,
  type Summary,
  type Transaction,
  type TxQuery,
} from "@/lib/api";

/**
 * One reducer owns the whole query. Everything the user can change — filters,
 * sort, page — is a single object, which is what makes the table and both
 * charts provably agree: they are handed the same value, not three copies that
 * can drift.
 *
 * No state library. The state here is one plain object plus four request
 * results; Redux or Zustand would add a dependency and a directory for no
 * behaviour this app needs. See docs/DECISIONS.md.
 */

export interface Query {
  search: string;
  categories: string[];
  statuses: string[];
  methods: string[];
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  includeAnomalous: boolean;
  sortBy: "date" | "amount";
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
}

export const INITIAL_QUERY: Query = {
  search: "",
  categories: [],
  statuses: [],
  methods: [],
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
  includeAnomalous: true,
  sortBy: "date",
  direction: "desc",
  page: 1,
  pageSize: 50,
};

type Action =
  | { type: "set"; patch: Partial<Query> }
  | { type: "toggle"; key: "categories" | "statuses" | "methods"; value: string }
  | { type: "sort"; key: "date" | "amount" }
  | { type: "page"; page: number }
  | { type: "reset" };

function reducer(state: Query, action: Action): Query {
  switch (action.type) {
    case "set":
      // Any filter change returns to page 1. Staying on page 40 of a result set
      // that now has 3 pages shows an empty table and reads as a bug.
      return { ...state, ...action.patch, page: action.patch.page ?? 1 };

    case "toggle": {
      const current = state[action.key];
      const next = current.includes(action.value)
        ? current.filter((v) => v !== action.value)
        : [...current, action.value];
      return { ...state, [action.key]: next, page: 1 };
    }

    case "sort":
      // Clicking the active column flips direction; a new column starts
      // descending, which is what a reader expects of dates and amounts alike.
      return state.sortBy === action.key
        ? { ...state, direction: state.direction === "asc" ? "desc" : "asc", page: 1 }
        : { ...state, sortBy: action.key, direction: "desc", page: 1 };

    case "page":
      return { ...state, page: action.page };

    case "reset":
      return { ...INITIAL_QUERY };
  }
}

function toApiQuery(q: Query): TxQuery {
  return {
    search: q.search,
    categories: q.categories,
    statuses: q.statuses,
    methods: q.methods,
    date_from: q.dateFrom,
    date_to: q.dateTo,
    amount_min: q.amountMin,
    amount_max: q.amountMax,
    include_anomalous: q.includeAnomalous,
    sort_by: q.sortBy,
    direction: q.direction,
    page: q.page,
    page_size: q.pageSize,
  };
}

/** True when anything narrows the result set, so empty states can say which kind. */
export function isFiltered(q: Query): boolean {
  return Boolean(
    q.search ||
      q.categories.length ||
      q.statuses.length ||
      q.methods.length ||
      q.dateFrom ||
      q.dateTo ||
      q.amountMin ||
      q.amountMax ||
      !q.includeAnomalous,
  );
}

interface Resource<T> {
  data: T;
  loading: boolean;
  error: ApiError | null;
}

export function useDashboard() {
  const [query, dispatch] = useReducer(reducer, INITIAL_QUERY);

  // The search box updates `query.search` on every keystroke for instant
  // feedback in the input, but the request waits until typing pauses. Without
  // the debounce, "domino" fires six requests and the last to arrive wins,
  // which is not necessarily the last one sent.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(query.search), 220);
    return () => window.clearTimeout(timer);
  }, [query.search]);

  const effective = useMemo(
    () => ({ ...query, search: debouncedSearch }),
    [query, debouncedSearch],
  );

  const [transactions, setTransactions] = useState<Resource<Transaction[]>>({
    data: [],
    loading: true,
    error: null,
  });
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [summary, setSummary] = useState<Resource<Summary | null>>({
    data: null,
    loading: true,
    error: null,
  });
  const [byCategory, setByCategory] = useState<Resource<CategorySpend[]>>({
    data: [],
    loading: true,
    error: null,
  });
  const [monthly, setMonthly] = useState<Resource<MonthlyPoint[]>>({
    data: [],
    loading: true,
    error: null,
  });

  const [facets, setFacets] = useState<Facets | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardsState, setRewardsState] = useState<{ loading: boolean; error: ApiError | null }>({
    loading: true,
    error: null,
  });

  // Bumped to force a refetch after a redeem, or on Retry.
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Supersede the previous request rather than racing it. This is what stops
    // a slow early response overwriting a fast later one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const apiQuery = toApiQuery(effective);

    setTransactions((s) => ({ ...s, loading: true }));
    setSummary((s) => ({ ...s, loading: true }));
    setByCategory((s) => ({ ...s, loading: true }));
    setMonthly((s) => ({ ...s, loading: true }));

    const settle = <T,>(
      promise: Promise<T>,
      apply: (value: T) => void,
      fail: (error: ApiError) => void,
    ) =>
      promise.then(apply).catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (cause instanceof ApiError) fail(cause);
        else throw cause;
      });

    void Promise.all([
      settle(
        api.transactions(apiQuery, controller.signal),
        (page) => {
          setTransactions({ data: page.rows, loading: false, error: null });
          setMeta({ total: page.total, totalPages: page.total_pages });
        },
        (error) => setTransactions({ data: [], loading: false, error }),
      ),
      settle(
        api.summary(apiQuery, controller.signal),
        (data) => setSummary({ data, loading: false, error: null }),
        (error) => setSummary({ data: null, loading: false, error }),
      ),
      settle(
        api.byCategory(apiQuery, controller.signal),
        (data) => setByCategory({ data, loading: false, error: null }),
        (error) => setByCategory({ data: [], loading: false, error }),
      ),
      settle(
        api.monthly(apiQuery, controller.signal),
        (data) => setMonthly({ data, loading: false, error: null }),
        (error) => setMonthly({ data: [], loading: false, error }),
      ),
    ]);

    return () => controller.abort();
  }, [effective, nonce]);

  // Facets, balance and the catalogue do not depend on the filters, so they are
  // fetched once rather than on every filter change.
  useEffect(() => {
    void api.facets().then(setFacets).catch(() => setFacets(null));
  }, []);

  useEffect(() => {
    setRewardsState({ loading: true, error: null });
    void Promise.all([api.balance(), api.catalogue()])
      .then(([b, r]) => {
        setBalance(b);
        setRewards(r);
        setRewardsState({ loading: false, error: null });
      })
      .catch((cause) =>
        setRewardsState({
          loading: false,
          error: cause instanceof ApiError ? cause : null,
        }),
      );
  }, [nonce]);

  /**
   * Applies a balance change from the optimistic redeem path, and re-derives
   * each reward's affordability from it so the catalogue's disabled states stay
   * consistent with the number on screen.
   */
  const setBalanceOptimistically = useCallback((next: number) => {
    setBalance((current) => (current ? { ...current, balance: next } : current));
    setRewards((current) =>
      current.map((reward) => ({
        ...reward,
        affordable: next >= reward.coin_cost,
        coins_short: Math.max(0, reward.coin_cost - next),
      })),
    );
  }, []);

  return {
    query,
    dispatch,
    filtered: isFiltered(query),
    transactions,
    meta,
    summary,
    byCategory,
    monthly,
    facets,
    balance,
    rewards,
    rewardsState,
    refresh,
    setBalanceOptimistically,
  };
}
