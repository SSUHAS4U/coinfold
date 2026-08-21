"use client";

import { ArrowRight, Coins, Receipt } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StatRow } from "@/components/app/StatRow";
import { useDashboardContext } from "@/components/app/DashboardContext";
import { CategoryDonut } from "@/components/charts/SpendCharts";
import { TransactionDrawer } from "@/components/dashboard/TransactionDrawer";
import { StillBanner } from "@/components/landing/Banner";
import { Panel, PanelHeading, Skeleton, StatusPill } from "@/components/ui/Primitives";
import type { Transaction } from "@/lib/api";
import { categoryColor, count, money, shortDate } from "@/lib/format";

/**
 * Overview: the conclusion, not the evidence.
 *
 * Headline figures, the category split, the five most recent payments, and
 * where the coins stand. Anything that needs working with — the full table,
 * the filters — lives on its own route, which is what stops this screen
 * becoming the dumping ground it was before.
 */

export default function OverviewPage() {
  const { summary, byCategory, transactions, query, dispatch, balance, rewardsState } =
    useDashboardContext();
  const [openRow, setOpenRow] = useState<Transaction | null>(null);

  const recent = transactions.data.slice(0, 5);

  return (
    <div className="space-y-7">
      {/* Headline figures on a photographic banner. */}
      <section
        aria-label="Summary"
        className="relative overflow-hidden rounded-[var(--r-card)] border border-border p-6 sm:p-8"
      >
        <StillBanner src="/img/app-banner.jpg" overlay={0.74} />
        <div className="relative">
          <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">This statement</p>
          <h2 className="mt-2 text-[clamp(1.5rem,3vw,2.1rem)] font-semibold tracking-[-0.02em] text-white">
            Where your money went
          </h2>
        </div>
        <div className="relative mt-7">
          <StatRow
            spend={summary.data?.total_spend ?? "0"}
            refunded={summary.data?.total_refunded ?? "0"}
            matched={summary.data?.matched ?? 0}
            failed={summary.data?.failed ?? 0}
            pending={summary.data?.pending ?? 0}
            coins={summary.data?.coins_earned ?? 0}
            loading={summary.loading && !summary.data}
            onDark
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Category split */}
        <Panel>
          <PanelHeading
            title="Where it went"
            hint="Click a slice to filter every screen."
            action={
              <Link
                href="/app/analytics"
                className="inline-flex h-9 min-h-9 items-center gap-1.5 rounded-[var(--r-control)] border border-border px-3 text-[12.5px] text-text-dim transition-colors hover:border-border-strong hover:text-text"
              >
                Analytics
                <ArrowRight size={13} aria-hidden />
              </Link>
            }
          />
          <CategoryDonut
            data={byCategory.data}
            loading={byCategory.loading && byCategory.data.length === 0}
            selected={query.categories}
            onSelect={(slug) => dispatch({ type: "toggle", key: "categories", value: slug })}
          />
        </Panel>

        <div className="space-y-6">
          {/* Coins */}
          <Panel>
            <PanelHeading
              title="Your coins"
              action={
                <Link
                  href="/app/rewards"
                  className="inline-flex h-9 min-h-9 items-center gap-1.5 rounded-[var(--r-control)] border border-border px-3 text-[12.5px] text-text-dim transition-colors hover:border-border-strong hover:text-text"
                >
                  Spend them
                  <ArrowRight size={13} aria-hidden />
                </Link>
              }
            />
            {rewardsState.loading && !balance ? (
              <Skeleton className="h-[92px] w-full" />
            ) : (
              <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
                <div>
                  <p className="text-[12px] tracking-[0.02em] text-text-faint">Balance</p>
                  <p className="tnum mt-1 inline-flex items-center gap-2 text-[34px] font-semibold leading-none tracking-[-0.02em] text-text">
                    <Coins size={22} aria-hidden style={{ color: "var(--accent)" }} />
                    {count(balance?.balance ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] tracking-[0.02em] text-text-faint">Earned</p>
                  <p className="tnum mt-1 text-[17px] font-medium text-text-dim">
                    {count(balance?.lifetime_earned ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] tracking-[0.02em] text-text-faint">Spent</p>
                  <p className="tnum mt-1 text-[17px] font-medium text-text-dim">
                    {count(balance?.lifetime_spent ?? 0)}
                  </p>
                </div>
              </div>
            )}
          </Panel>

          {/* Recent activity */}
          <Panel>
            <PanelHeading
              title="Latest payments"
              action={
                <Link
                  href="/app/transactions"
                  className="inline-flex h-9 min-h-9 items-center gap-1.5 rounded-[var(--r-control)] border border-border px-3 text-[12.5px] text-text-dim transition-colors hover:border-border-strong hover:text-text"
                >
                  All 10,000
                  <ArrowRight size={13} aria-hidden />
                </Link>
              }
            />

            {transactions.loading && recent.length === 0 ? (
              <div className="space-y-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-border py-3">
                    <Skeleton className="size-1.5 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-text-faint">
                No payments match the current filters.
              </p>
            ) : (
              <ul className="space-y-0">
                {recent.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setOpenRow(row)}
                      className="flex min-h-11 w-full items-center gap-3 border-b border-border py-3 text-left transition-colors hover:bg-surface-2"
                    >
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: categoryColor(row.accent_hue) }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-text">
                          {row.merchant}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-text-faint">
                          {row.category_label} · {shortDate(row.occurred_at)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className="tnum block text-[13.5px] font-medium"
                          style={{
                            color:
                              Number(row.amount) < 0 ? "var(--success)" : "var(--text)",
                          }}
                        >
                          {money(row.amount)}
                        </span>
                        <span className="mt-0.5 block">
                          <StatusPill status={row.status} />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* A quiet pointer to the thing this screen deliberately does not hold. */}
      <Link
        href="/app/transactions"
        className="flex min-h-11 items-center gap-3 rounded-[var(--r-card)] border border-border bg-surface-1 px-5 py-4 text-[13.5px] text-text-dim transition-colors hover:border-border-strong hover:text-text"
      >
        <Receipt size={16} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1">
          Search, filter and sort all {count(summary.data?.matched ?? 10000)} transactions
        </span>
        <ArrowRight size={15} aria-hidden className="shrink-0" />
      </Link>

      <TransactionDrawer row={openRow} onClose={() => setOpenRow(null)} />
    </div>
  );
}
