"use client";

import { motion } from "motion/react";

import { usePrefersReducedMotion } from "@/hooks/useBrowserState";
import { count } from "@/lib/format";
import { easeEnter, springTravel } from "@/lib/motion";
import { useCountUp } from "@/hooks/useCountUp";

/**
 * The coin balance, as a dial.
 *
 * A bare "Balance: 362,629" in a card says nothing about proportion. The ring
 * shows what fraction of everything ever earned is still unspent, so the
 * number arrives with its own context — which is the whole difference between
 * a statistic and a fact.
 *
 * The ring is drawn with `pathLength={1}`, so the dash maths is normalised
 * regardless of the circle's real circumference and the fill is linear in the
 * value. It animates once on mount and then tracks the balance, so a redeem
 * visibly *moves* the dial rather than swapping one number for another.
 */

const SIZE = 168;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;

export function CoinDial({
  balance,
  earned,
  spent,
  loading,
}: {
  balance: number;
  earned: number;
  spent: number;
  loading: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const display = useCountUp(balance, reduced);

  // Guard the divide: a brand-new account has earned nothing yet.
  const remaining = earned > 0 ? Math.max(0, Math.min(1, balance / earned)) : 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} aria-hidden className="-rotate-90">
          <defs>
            <linearGradient id="dial-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--gold-bright)" />
              <stop offset="100%" stopColor="var(--gold)" />
            </linearGradient>
          </defs>

          {/* Track: what has already been spent occupies the remainder. */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--canvas-sunk)"
            strokeWidth={STROKE}
          />

          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="url(#dial-fill)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            initial={{ strokeDashoffset: reduced ? 1 - remaining : 1 }}
            animate={{ strokeDashoffset: 1 - remaining }}
            transition={reduced ? { duration: 0 } : { ...easeEnter, duration: 0.9 }}
          />
        </svg>

        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            {loading ? (
              <span className="text-[22px] text-ink-faint">—</span>
            ) : (
              <motion.p
                key="balance"
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springTravel}
                className="figure text-[30px] leading-none text-ink"
              >
                {count(display)}
              </motion.p>
            )}
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.11em] text-ink-faint">
              coins
            </p>
          </div>
        </div>
      </div>

      <dl className="w-full space-y-3">
        {[
          ["Earned", earned, "var(--gold)"],
          ["Spent", spent, "var(--ink-dim)"],
        ].map(([label, value, colour]) => (
          <div
            key={label as string}
            className="flex items-baseline justify-between border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0"
          >
            <dt className="text-[13px] text-ink-dim">{label as string}</dt>
            <dd className="tnum text-[15px] font-semibold" style={{ color: colour as string }}>
              {loading ? "—" : count(value as number)}
            </dd>
          </div>
        ))}
        <p className="pt-1 text-[12px] leading-relaxed text-ink-faint">
          {earned > 0
            ? `${Math.round(remaining * 100)}% of everything you have earned is still unspent.`
            : "Coins appear here as soon as a payment succeeds."}
        </p>
      </dl>
    </div>
  );
}
