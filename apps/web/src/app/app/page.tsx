"use client";

import { LogOut, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CategoryDonut, MonthlyTrend } from "@/components/charts/SpendCharts";
import { CoinHud } from "@/components/dashboard/CoinHud";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Pagination } from "@/components/dashboard/Pagination";
import { TransactionDrawer } from "@/components/dashboard/TransactionDrawer";
import { RewardsPanel } from "@/components/rewards/RewardsPanel";
import { TransactionTable } from "@/components/table/TransactionTable";
import { Panel, PanelHeading, Skeleton } from "@/components/ui/Primitives";
import { useDashboard } from "@/hooks/useDashboard";
import { type Transaction, tokens } from "@/lib/api";
import { count, money, moneyCompact } from "@/lib/format";

/**
 * The dashboard.
 *
 * Layout follows the density rule: the conclusion first (what was spent, what
 * was earned), then the evidence (charts), then the detail (table). The one
 * framed element is the coin HUD, so the eye lands there.
 */

function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("light");
    document.documentElement.classList.toggle("light", next);
    localStorage.setItem("coinfold.theme", next ? "light" : "dark");
    setLight(next);
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      className="grid size-11 min-h-11 place-items-center rounded-[var(--r-control)] border border-border text-text-dim transition-colors duration-[var(--t-interaction)] hover:border-border-strong hover:text-text"
    >
      {light ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
    </button>
  );
}

/**
 * The stat row. Figures sit directly on the canvas with hairline separators —
 * no card per stat, which is the fastest way a stat row becomes visual noise.
 */
function StatRow({
  spend,
  refunded,
  matched,
  failed,
  pending,
  coins,
  loading,
}: {
  spend: string;
  refunded: string;
  matched: number;
  failed: number;
  pending: number;
  coins: number;
  loading: boolean;
}) {
  const stats: { label: string; value: string; tone?: string }[] = [
    { label: "Total spent", value: money(spend) },
    { label: "Refunded", value: moneyCompact(refunded), tone: "var(--success)" },
    { label: "Transactions", value: count(matched) },
    { label: "Failed", value: count(failed), tone: failed > 0 ? "var(--danger)" : undefined },
    { label: "Pending", value: count(pending), tone: pending > 0 ? "var(--warning)" : undefined },
    { label: "Coins earned", value: count(coins), tone: "var(--accent)" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={index > 0 ? "lg:border-l lg:border-border lg:pl-6" : undefined}
        >
          <dt className="text-[12px] tracking-[0.02em] text-text-faint">{stat.label}</dt>
          <dd>
            {loading ? (
              <Skeleton className="mt-1.5 h-7 w-24" />
            ) : (
              <span
                className="tnum mt-1 block truncate text-[22px] font-semibold tracking-[-0.02em]"
                style={{ color: stat.tone ?? "var(--text)" }}
              >
                {stat.value}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [authorised, setAuthorised] = useState<boolean | null>(null);
  const [openRow, setOpenRow] = useState<Transaction | null>(null);

  // Guard on the client: the token lives in sessionStorage, so the server has
  // no way to know whether this request is authenticated.
  useEffect(() => {
    if (tokens.access) {
      setAuthorised(true);
    } else {
      setAuthorised(false);
      router.replace("/login");
    }
  }, [router]);

  const {
    query,
    dispatch,
    filtered,
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
  } = useDashboard();

  const signOut = useCallback(() => {
    tokens.clear();
    router.replace("/login");
  }, [router]);

  /** A chart click toggles the same category filter the chips drive. */
  const onCategorySelect = useCallback(
    (slug: string) => dispatch({ type: "toggle", key: "categories", value: slug }),
    [dispatch],
  );

  /** A trend click sets the date window to that whole month, or clears it. */
  const onMonthSelect = useCallback(
    (month: string) => {
      const [year, m] = month.split("-").map(Number);
      const from = `${month}-01`;
      const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
      const to = `${month}-${String(last).padStart(2, "0")}`;
      dispatch(
        query.dateFrom === from && query.dateTo === to
          ? { type: "set", patch: { dateFrom: "", dateTo: "" } }
          : { type: "set", patch: { dateFrom: from, dateTo: to } },
      );
    },
    [dispatch, query.dateFrom, query.dateTo],
  );

  const selectedMonth =
    query.dateFrom && query.dateTo && query.dateFrom.slice(0, 7) === query.dateTo.slice(0, 7)
      ? query.dateFrom.slice(0, 7)
      : undefined;

  if (authorised !== true) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <p className="text-[13px] text-text-faint">
          {authorised === null ? "Checking your session…" : "Redirecting to sign in…"}
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <a href="/" className="mr-auto text-[15px] font-semibold tracking-[-0.01em] text-text">
            coinfold
          </a>

          <CoinHud
            balance={balance?.balance ?? null}
            lifetimeEarned={balance?.lifetime_earned ?? null}
            loading={rewardsState.loading}
          />

          <ThemeToggle />

          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="grid size-11 min-h-11 place-items-center rounded-[var(--r-control)] border border-border text-text-dim transition-colors duration-[var(--t-interaction)] hover:border-border-strong hover:text-text"
          >
            <LogOut size={16} aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 sm:px-6">
        {/* Conclusion first */}
        <section aria-label="Summary">
          <StatRow
            spend={summary.data?.total_spend ?? "0"}
            refunded={summary.data?.total_refunded ?? "0"}
            matched={summary.data?.matched ?? 0}
            failed={summary.data?.failed ?? 0}
            pending={summary.data?.pending ?? 0}
            coins={summary.data?.coins_earned ?? 0}
            loading={summary.loading && !summary.data}
          />
        </section>

        {/* Evidence */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <Panel>
            <PanelHeading
              title="Where it went"
              hint="Click a slice or a row to filter everything below."
            />
            <CategoryDonut
              data={byCategory.data}
              loading={byCategory.loading && byCategory.data.length === 0}
              selected={query.categories}
              onSelect={onCategorySelect}
            />
          </Panel>

          <Panel>
            <PanelHeading title="Month by month" hint="Click a month to filter to it." />
            <MonthlyTrend
              data={monthly.data}
              loading={monthly.loading && monthly.data.length === 0}
              onSelectMonth={onMonthSelect}
              selectedMonth={selectedMonth}
            />
          </Panel>
        </div>

        {/* Rewards */}
        <Panel>
          <PanelHeading
            title="Rewards"
            hint="One coin for every ₹100 on a successful payment, capped at 100 per transaction."
          />
          <RewardsPanel
            balance={balance}
            rewards={rewards}
            loading={rewardsState.loading}
            error={rewardsState.error}
            onBalanceChange={setBalanceOptimistically}
            onRedeemed={refresh}
            onRetry={refresh}
          />
        </Panel>

        {/* Detail */}
        <Panel padded={false}>
          <div className="space-y-5 p-6 pb-0">
            <PanelHeading
              title="Transactions"
              hint="All 10,000 rows, filtered and sorted on the server."
            />
            <FilterBar
              query={query}
              facets={facets}
              matched={meta.total}
              onSearch={(search) => dispatch({ type: "set", patch: { search } })}
              onToggle={(key, value) => dispatch({ type: "toggle", key, value })}
              onSet={(patch) => dispatch({ type: "set", patch })}
              onReset={() => dispatch({ type: "reset" })}
            />
          </div>

          <div className="mt-5">
            <TransactionTable
              rows={transactions.data}
              loading={transactions.loading}
              error={
                transactions.error
                  ? {
                      what: transactions.error.fault.what,
                      why: transactions.error.fault.why,
                      action: transactions.error.fault.action,
                      traceId: transactions.error.fault.trace_id,
                    }
                  : null
              }
              sortBy={query.sortBy}
              direction={query.direction}
              onSort={(key) => dispatch({ type: "sort", key })}
              onOpen={setOpenRow}
              onRetry={refresh}
              onClearFilters={() => dispatch({ type: "reset" })}
              filtered={filtered}
              pageSize={query.pageSize}
            />
          </div>

          <div className="px-6 pb-6">
            <Pagination
              page={query.page}
              totalPages={meta.totalPages}
              total={meta.total}
              pageSize={query.pageSize}
              onPage={(page) => dispatch({ type: "page", page })}
              onPageSize={(pageSize) => dispatch({ type: "set", patch: { pageSize } })}
            />
          </div>
        </Panel>
      </main>

      <TransactionDrawer row={openRow} onClose={() => setOpenRow(null)} />
    </div>
  );
}
