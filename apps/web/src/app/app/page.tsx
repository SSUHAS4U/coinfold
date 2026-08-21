"use client";

import { ArrowRight, ArrowUpRight, Coins } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { useDashboardContext } from "@/components/app/DashboardContext";
import { CoinDial } from "@/components/app/CoinDial";
import { CategoryDonut } from "@/components/charts/SpendCharts";
import { TransactionDrawer } from "@/components/dashboard/TransactionDrawer";
import { CategoryPill, Eyebrow, Skeleton, StatusDot, Surface, SurfaceHead } from "@/components/ui/Primitives";
import type { Transaction } from "@/lib/api";
import { count, money, moneyCompact, shortDate } from "@/lib/format";
import { inView, rise, riseStagger, springControl, tap } from "@/lib/motion";

/**
 * Overview — a financial cockpit, not a grid of six identical cards.
 *
 * The page has deliberate rhythm: one enormous number, then a dial, then a
 * timeline, then a quiet pointer onward. Different information takes different
 * shapes, which is what stops a dashboard reading as a template.
 *
 * Anything that needs *working with* — the full table, the filter panel — lives
 * on its own route. This screen is for reading, not operating.
 */

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function OverviewPage() {
  const { summary, byCategory, transactions, query, dispatch, balance, rewardsState } =
    useDashboardContext();
  const [openRow, setOpenRow] = useState<Transaction | null>(null);

  const recent = transactions.data.slice(0, 6);
  const loadingSummary = summary.loading && !summary.data;
  const topCategory = byCategory.data[0];

  return (
    <div className="space-y-8">
      {/* ---- The headline: one number, given the room to be the point --- */}
      <motion.section initial="hidden" animate="visible" variants={rise} aria-label="Total spend">
        <Eyebrow>{greeting()} — your money, at a glance</Eyebrow>

        <div className="mt-4 flex flex-wrap items-end gap-x-12 gap-y-6">
          <div>
            {loadingSummary ? (
              <Skeleton className="h-[68px] w-[320px]" />
            ) : (
              <p className="figure text-[clamp(2.6rem,6vw,4.2rem)] leading-[0.95] text-ink">
                {money(summary.data?.total_spend ?? "0")}
              </p>
            )}
            <p className="mt-3 text-[14px] text-ink-dim">
              tracked across{" "}
              <span className="tnum text-ink">{count(summary.data?.matched ?? 0)}</span>{" "}
              payments
            </p>
          </div>

          {/* Secondary figures: present, subordinate, separated by hairlines. */}
          <dl className="flex flex-wrap gap-x-10 gap-y-5">
            {[
              ["Refunded", moneyCompact(Math.abs(Number(summary.data?.total_refunded ?? 0)))],
              ["Failed", count(summary.data?.failed ?? 0)],
              ["Pending", count(summary.data?.pending ?? 0)],
              ["Top category", topCategory?.category_label ?? "—"],
            ].map(([label, value], index) => (
              <motion.div
                key={label}
                custom={index}
                variants={riseStagger}
                initial="hidden"
                animate="visible"
                className="border-l border-[var(--line)] pl-5"
              >
                <dt className="text-[12px] text-ink-faint">{label}</dt>
                <dd className="tnum mt-1.5 text-[17px] font-semibold tracking-[-0.02em] text-ink">
                  {loadingSummary ? <Skeleton className="h-5 w-16" /> : value}
                </dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </motion.section>

      {/* ---- Coins + category split ------------------------------------- */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Surface className="flex flex-col">
          <SurfaceHead
            title="Your coins"
            hint="One for every ₹100 on a successful payment."
            action={
              <motion.span whileTap={tap} transition={springControl}>
                <Link
                  href="/app/rewards"
                  className="inline-flex h-9 min-h-9 items-center gap-1.5 rounded-[var(--r-pill)] bg-[var(--gold-soft)] px-3 text-[12.5px] font-medium text-[var(--gold)] transition-[filter] hover:brightness-95"
                >
                  Spend
                  <ArrowUpRight size={13} aria-hidden />
                </Link>
              </motion.span>
            }
          />
          <div className="flex flex-1 items-center justify-center py-2">
            <CoinDial
              balance={balance?.balance ?? 0}
              earned={balance?.lifetime_earned ?? 0}
              spent={balance?.lifetime_spent ?? 0}
              loading={rewardsState.loading && !balance}
            />
          </div>
        </Surface>

        <Surface>
          <SurfaceHead
            title="Where it went"
            hint="Click a slice and every screen filters with it."
            action={
              <Link
                href="/app/analytics"
                className="inline-flex h-9 min-h-9 items-center gap-1.5 rounded-[var(--r-pill)] px-3 text-[12.5px] text-ink-dim transition-colors hover:bg-[var(--content-active)] hover:text-ink"
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
        </Surface>
      </div>

      {/* ---- Activity timeline ------------------------------------------ */}
      <Surface>
        <SurfaceHead
          title="Latest payments"
          action={
            <Link
              href="/app/transactions"
              className="inline-flex h-9 min-h-9 items-center gap-1.5 rounded-[var(--r-pill)] px-3 text-[12.5px] text-ink-dim transition-colors hover:bg-[var(--content-active)] hover:text-ink"
            >
              All {count(summary.data?.matched ?? 10000)}
              <ArrowRight size={13} aria-hidden />
            </Link>
          }
        />

        {transactions.loading && recent.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-ink-faint">
            No payments match the filters currently applied.
          </p>
        ) : (
          /* A connecting rail runs behind the markers, so the list reads as a
             sequence in time rather than as unrelated rows. */
          <ol className="relative">
            <span
              aria-hidden
              className="absolute bottom-6 left-[17px] top-6 w-px bg-[var(--line)]"
            />
            {recent.map((row, index) => {
              const isRefund = Number(row.amount) < 0;
              return (
                <motion.li
                  key={row.id}
                  custom={index}
                  variants={riseStagger}
                  initial="hidden"
                  whileInView="visible"
                  viewport={inView}
                >
                  <motion.button
                    type="button"
                    onClick={() => setOpenRow(row)}
                    whileTap={tap}
                    transition={springControl}
                    className="relative flex min-h-11 w-full items-center gap-4 rounded-[var(--r-control)] px-2 py-3 text-left transition-colors hover:bg-[var(--content-hover)]"
                  >
                    <span
                      aria-hidden
                      className="grid size-[34px] shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--content)] text-[12px] font-semibold text-ink-dim"
                    >
                      {row.merchant.slice(0, 1)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">
                        {row.merchant}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <CategoryPill label={row.category_label} hue={row.accent_hue} />
                        <span className="text-[12px] text-ink-faint">
                          {shortDate(row.occurred_at)}
                        </span>
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      <span
                        className="figure block text-[14.5px]"
                        style={{ color: isRefund ? "var(--up)" : "var(--ink)" }}
                      >
                        {money(row.amount)}
                      </span>
                      <span className="mt-1 flex items-center justify-end gap-2">
                        <StatusDot status={row.status} />
                        {row.coins_earned > 0 && (
                          <span
                            className="tnum inline-flex items-center gap-1 text-[12px]"
                            style={{ color: "var(--gold)" }}
                          >
                            <Coins size={11} aria-hidden />+{row.coins_earned}
                          </span>
                        )}
                      </span>
                    </span>
                  </motion.button>
                </motion.li>
              );
            })}
          </ol>
        )}
      </Surface>

      <TransactionDrawer row={openRow} onClose={() => setOpenRow(null)} />
    </div>
  );
}
