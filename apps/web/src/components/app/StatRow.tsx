"use client";

import { Skeleton } from "@/components/ui/Primitives";
import { count, money, moneyCompact } from "@/lib/format";

/**
 * The headline figures.
 *
 * Values sit directly on the surface with hairline separators — no card per
 * stat, which is the fastest way a stat row turns into visual noise.
 *
 * `onDark` pins the ink for the photographic banner, which is dark in BOTH
 * themes. Following --text there would render near-black on a dark photograph
 * in light mode, which is exactly the bug this flag exists to prevent.
 */

export function StatRow({
  spend,
  refunded,
  matched,
  failed,
  pending,
  coins,
  loading,
  onDark,
}: {
  spend: string;
  refunded: string;
  matched: number;
  failed: number;
  pending: number;
  coins: number;
  loading: boolean;
  onDark?: boolean;
}) {
  const ink = onDark ? "#F2F4F7" : "var(--text)";
  const inkDim = onDark ? "rgb(242 244 247 / 0.62)" : "var(--text-faint)";

  const stats: { label: string; value: string; compact?: string; tone?: string }[] = [
    { label: "Total spent", value: money(spend), compact: moneyCompact(spend) },
    {
      // The label carries the direction, so the figure is a magnitude.
      // "Refunded −₹10.3L" reads as money lost, which is backwards.
      label: "Refunded",
      value: moneyCompact(Math.abs(Number(refunded) || 0)),
      tone: onDark ? "#3DD68C" : "var(--success)",
    },
    { label: "Transactions", value: count(matched) },
    {
      label: "Failed",
      value: count(failed),
      tone: failed > 0 ? (onDark ? "#F0654E" : "var(--danger)") : undefined,
    },
    {
      label: "Pending",
      value: count(pending),
      tone: pending > 0 ? (onDark ? "#F5B544" : "var(--warning)") : undefined,
    },
    { label: "Coins earned", value: count(coins), tone: onDark ? "#5BE9B9" : "var(--accent)" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={index > 0 ? "lg:border-l lg:pl-6" : undefined}
          style={
            index > 0
              ? { borderColor: onDark ? "rgb(242 244 247 / 0.16)" : "var(--border)" }
              : undefined
          }
        >
          <dt className="text-[12px] tracking-[0.02em]" style={{ color: inkDim }}>
            {stat.label}
          </dt>
          <dd>
            {loading ? (
              <Skeleton className="mt-1.5 h-7 w-24" />
            ) : (
              <span
                className="tnum mt-1 block truncate text-[22px] font-semibold tracking-[-0.02em]"
                style={{ color: stat.tone ?? ink }}
                title={stat.value}
              >
                {/* The full figure does not fit a 360px column and truncated to
                    "₹6,20,42,66…", which is worse than useless — a partial
                    number reads as a real one. */}
                {stat.compact ? (
                  <>
                    <span className="sm:hidden">{stat.compact}</span>
                    <span className="hidden sm:inline">{stat.value}</span>
                  </>
                ) : (
                  stat.value
                )}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
