"use client";

import { Coins } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { count } from "@/lib/format";

/**
 * The coin balance. This is the ONE framed element on the screen.
 *
 * Per the SpaceX note: because it is the only bordered thing, it reads as live
 * instrumentation rather than decoration. Everything else on the dashboard was
 * deliberately left unboxed to make that true. If a second framed element ever
 * appears, this stops working.
 *
 * The figure counts to its new value rather than snapping, so a redeem is
 * visibly a *change* rather than a different number appearing. Motion carrying
 * data, not decorating it.
 */

function useCountUp(target: number, duration = 700) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    const start = performance.now();
    const delta = target - from;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // Ease-out cubic: fast then settling, which reads as a value arriving
      // rather than a linear meter filling.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + delta * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}

export function CoinHud({
  balance,
  lifetimeEarned,
  loading,
}: {
  balance: number | null;
  lifetimeEarned: number | null;
  loading: boolean;
}) {
  const value = useCountUp(balance ?? 0);

  return (
    <div className="flex items-center gap-3 rounded-[var(--r-card)] border border-border-strong bg-surface-1 px-4 py-2.5 shadow-[var(--shadow-2),var(--highlight)]">
      <Coins size={17} aria-hidden style={{ color: "var(--accent)" }} />

      <div className="min-w-0">
        <p className="text-[11px] leading-none tracking-[0.02em] text-text-faint">Coin balance</p>
        <p
          className="tnum mt-1 text-[19px] font-semibold leading-none tracking-[-0.01em] text-text"
          aria-live="polite"
        >
          {loading && balance === null ? "—" : count(value)}
        </p>
      </div>

      {lifetimeEarned !== null && (
        <div className="ml-2 hidden border-l border-border pl-3 sm:block">
          <p className="text-[11px] leading-none tracking-[0.02em] text-text-faint">Earned</p>
          <p className="tnum mt-1 text-[13px] leading-none text-text-dim">
            {count(lifetimeEarned)}
          </p>
        </div>
      )}
    </div>
  );
}
