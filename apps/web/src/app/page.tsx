"use client";

import { ArrowRight, Coins } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * The landing page: a scroll-driven data story.
 *
 * The scroll does not move decoration around — it animates the product's own
 * real figures, taken from the seeded dataset. 10,000 transactions, ₹2.28
 * crore of spend across 14 months, 362,629 coins. Motion that carries data
 * beats motion that decorates (SpaceX note).
 *
 * Mechanism: one pinned stage, one scroll listener, one rAF. Progress through
 * the pinned region drives every chapter, so nothing can drift out of sync the
 * way parallel timers do. Under prefers-reduced-motion the whole thing settles
 * to its final state and stops listening.
 *
 * Design rules held here (docs/UI_SPEC.md):
 *  - nothing is in a box except ONE element — the coin readout
 *  - two type sizes in the hero and no third
 *  - nav is plain text, no pills, no underline
 *  - monochrome plus a single accent
 */

const TOTAL_TX = 10_000;
const TOTAL_COINS = 362_629;
const MONTHS = 14;

/** The real category split from the seeded data, largest first. */
const CATEGORIES: { label: string; share: number; hue: number }[] = [
  { label: "Travel", share: 1.0, hue: 196 },
  { label: "Shopping", share: 0.94, hue: 292 },
  { label: "Education", share: 0.86, hue: 266 },
  { label: "Utilities", share: 0.72, hue: 48 },
  { label: "Insurance", share: 0.63, hue: 232 },
  { label: "Health", share: 0.58, hue: 158 },
  { label: "Groceries", share: 0.5, hue: 95 },
  { label: "Entertainment", share: 0.44, hue: 330 },
  { label: "Food & Dining", share: 0.38, hue: 12 },
  { label: "Fuel", share: 0.33, hue: 32 },
];

/** Maps a global progress value into a 0..1 range for one chapter. */
function chapter(progress: number, start: number, end: number): number {
  return Math.max(0, Math.min(1, (progress - start) / (end - start)));
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

export default function LandingPage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      setReduced(true);
      setProgress(1);
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = 0;
      const stage = stageRef.current;
      if (!stage) return;
      const { top, height } = stage.getBoundingClientRect();
      const travel = height - window.innerHeight;
      setProgress(travel <= 0 ? 0 : Math.max(0, Math.min(1, -top / travel)));
    };

    const onScroll = () => {
      // Coalesce to one measurement per frame. Reading layout on every wheel
      // event is what makes scroll-driven pages stutter.
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const p = reduced ? 1 : progress;

  const heroOut = chapter(p, 0, 0.18);
  const rowsIn = chapter(p, 0.14, 0.36);
  const barsIn = chapter(p, 0.38, 0.62);
  const coinsIn = chapter(p, 0.64, 0.88);

  const txCount = Math.round(easeOut(rowsIn) * TOTAL_TX);
  const coinCount = Math.round(easeOut(coinsIn) * TOTAL_COINS);

  return (
    <div className="min-h-dvh bg-bg">
      {/* Nav: plain text, no pills, no active underline (SpaceX). */}
      <header className="fixed inset-x-0 top-0 z-30">
        <nav className="mx-auto flex max-w-[1200px] items-center gap-6 px-5 py-5 sm:px-8">
          <span className="mr-auto text-[13px] font-medium uppercase tracking-[0.16em] text-text">
            Coinfold
          </span>
          <Link
            href="/login"
            className="text-[12px] uppercase tracking-[0.14em] text-text-dim transition-colors duration-[var(--t-interaction)] hover:text-text"
          >
            Sign in
          </Link>
          <Link
            href="/app"
            className="text-[12px] uppercase tracking-[0.14em] text-text-dim transition-colors duration-[var(--t-interaction)] hover:text-text"
          >
            Dashboard
          </Link>
        </nav>
      </header>

      {/* ---- The pinned stage ------------------------------------------- */}
      <div ref={stageRef} style={{ height: reduced ? "auto" : "460vh" }}>
        <div
          className={
            reduced
              ? "space-y-24 px-5 py-28 sm:px-8"
              : "sticky top-0 flex h-dvh items-center overflow-hidden px-5 sm:px-8"
          }
        >
          <div className="relative mx-auto w-full max-w-[1200px]">
            {/* Chapter 1 — the claim. Two type sizes, nothing boxed. */}
            <section
              className={reduced ? "" : "absolute inset-x-0 top-1/2 -translate-y-1/2"}
              style={
                reduced
                  ? undefined
                  : {
                      opacity: 1 - heroOut,
                      transform: `translateY(calc(-50% - ${heroOut * 40}px))`,
                      pointerEvents: heroOut > 0.9 ? "none" : undefined,
                    }
              }
            >
              <p className="text-[12px] uppercase tracking-[0.22em] text-text-faint">
                Credit-card bills, without the amnesia
              </p>
              <h1 className="mt-5 text-[clamp(2.6rem,10vw,7rem)] font-semibold uppercase leading-[0.92] tracking-[-0.04em] text-text">
                Pay the bill.
                <br />
                Keep the change.
              </h1>
              <p className="mt-7 max-w-[46ch] text-[15px] leading-relaxed text-text-dim">
                Every ₹100 you pay earns a coin. Every rupee you spend is sorted, searchable and
                charted. Scroll to see it on {TOTAL_TX.toLocaleString("en-IN")} real transactions.
              </p>
            </section>

            {/* Chapter 2 — the volume. Rows assemble as the number counts. */}
            <section
              className={reduced ? "" : "absolute inset-x-0 top-1/2 -translate-y-1/2"}
              style={
                reduced
                  ? undefined
                  : {
                      opacity: rowsIn > 0 && barsIn < 1 ? Math.min(rowsIn * 2, 1 - barsIn) : 0,
                      pointerEvents: "none",
                    }
              }
            >
              <p className="text-[12px] uppercase tracking-[0.22em] text-text-faint">
                Every row, on the server
              </p>
              <p className="tnum mt-4 text-[clamp(3rem,13vw,9rem)] font-semibold leading-[0.9] tracking-[-0.04em] text-text">
                {txCount.toLocaleString("en-IN")}
              </p>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-text-dim">
                transactions across {MONTHS} months, filtered and sorted in Postgres — never shipped
                to your browser in one lump.
              </p>

              {/* Rows assembling, one after another. */}
              <ul className="mt-9 max-w-[540px] space-y-0">
                {["Domino's", "BPCL", "MakeMyTrip", "Croma", "1mg"].map((merchant, index) => {
                  const local = Math.max(0, Math.min(1, rowsIn * 5 - index * 0.55));
                  return (
                    <li
                      key={merchant}
                      className="flex items-center justify-between border-b border-border py-2.5"
                      style={{
                        opacity: local,
                        transform: `translateY(${(1 - local) * 10}px)`,
                      }}
                    >
                      <span className="text-[13px] text-text-dim">{merchant}</span>
                      <span className="tnum text-[13px] text-text-faint">
                        ₹{(689 + index * 431).toLocaleString("en-IN")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Chapter 3 — where it went. Bars grow to their real share. */}
            <section
              className={reduced ? "" : "absolute inset-x-0 top-1/2 -translate-y-1/2"}
              style={
                reduced
                  ? undefined
                  : {
                      opacity: barsIn > 0 && coinsIn < 1 ? Math.min(barsIn * 2, 1 - coinsIn) : 0,
                      pointerEvents: "none",
                    }
              }
            >
              <p className="text-[12px] uppercase tracking-[0.22em] text-text-faint">
                Where the money actually went
              </p>
              <h2 className="mt-4 text-[clamp(2rem,6vw,3.6rem)] font-semibold uppercase leading-[0.95] tracking-[-0.03em] text-text">
                Ten categories.
                <br />
                One glance.
              </h2>

              <ul className="mt-8 max-w-[620px] space-y-2.5">
                {CATEGORIES.map((category, index) => {
                  const local = Math.max(0, Math.min(1, barsIn * 3 - index * 0.16));
                  return (
                    <li key={category.label} className="flex items-center gap-4">
                      <span className="w-[104px] shrink-0 text-right text-[12px] text-text-faint">
                        {category.label}
                      </span>
                      <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${easeOut(local) * category.share * 100}%`,
                            background: `oklch(72% 0.13 ${category.hue})`,
                          }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Chapter 4 — the payoff. THE one framed element in the design. */}
            <section
              className={
                reduced ? "" : "absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center"
              }
              style={reduced ? undefined : { opacity: coinsIn, pointerEvents: "none" }}
            >
              <div className="text-center">
                <p className="text-[12px] uppercase tracking-[0.22em] text-text-faint">
                  And the change you kept
                </p>

                <div
                  className="mx-auto mt-6 inline-flex items-center gap-4 rounded-[var(--r-card)] border border-border-strong bg-surface-1 px-7 py-5 shadow-[var(--shadow-2),var(--highlight)]"
                  style={{ transform: `scale(${0.96 + easeOut(coinsIn) * 0.04})` }}
                >
                  <Coins size={26} aria-hidden style={{ color: "var(--accent)" }} />
                  <div className="text-left">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint">
                      Coins earned
                    </p>
                    <p className="tnum mt-1 text-[clamp(2rem,7vw,3.4rem)] font-semibold leading-none tracking-[-0.03em] text-text">
                      {coinCount.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                <p className="mx-auto mt-6 max-w-[42ch] text-[15px] leading-relaxed text-text-dim">
                  Redeemable against vouchers and statement cashback. The balance is a ledger, not a
                  counter — every coin can be traced to the payment that earned it.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ---- Below the story: a real page ------------------------------- */}
      <section className="border-t border-border px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="max-w-[18ch] text-[clamp(1.8rem,5vw,3rem)] font-semibold uppercase leading-[0.98] tracking-[-0.03em] text-text">
            Built for the messy data, not the demo data
          </h2>

          <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Five timestamp formats",
                body: "The feed mixes ISO, epoch milliseconds, day-first slashes and bare dates. All 10,000 rows are normalised at ingest, and every repair is recorded against the row it changed.",
              },
              {
                title: "Nothing is silently dropped",
                body: "40 duplicate ids, 200 missing categories, 148 refunds and one 999999999 sentinel. Each is kept, flagged, and explained in the row's detail panel.",
              },
              {
                title: "Coins are a ledger",
                body: "An append-only entry per payment, so a balance is always the sum of things that happened — never a number someone incremented.",
              },
              {
                title: "Redeems fail closed",
                body: "The balance is re-read under a row lock at redeem time. Retries carry an idempotency key, so a dropped response never charges twice.",
              },
              {
                title: "Server-side everything",
                body: "Filtering, sorting and pagination happen in Postgres. The browser holds 50 rows, not 10,000.",
              },
              {
                title: "Errors that name the fix",
                body: "Every failure returns what happened, why, and the one thing to do next — down to which screen to open.",
              },
            ].map((item) => (
              <li key={item.title} className="border-t border-border pt-5">
                <h3 className="text-[15px] font-medium text-text">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-text-dim">{item.body}</p>
              </li>
            ))}
          </ul>

          {/* One CTA. The only saturated element on the page. */}
          <div className="mt-16 flex flex-wrap items-center gap-4">
            <Link
              href="/app"
              className="inline-flex h-12 min-h-12 items-center gap-2 rounded-[var(--r-control)] bg-accent px-6 text-[15px] font-medium text-on-accent transition-[filter] duration-[var(--t-interaction)] hover:brightness-110"
            >
              Open the dashboard
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              href="/login"
              className="text-[13px] text-text-dim underline-offset-4 transition-colors hover:text-text hover:underline"
            >
              Use the demo account
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-8 sm:px-8">
        <p className="mx-auto max-w-[1200px] text-[12px] text-text-faint">
          Coinfold — built as a take-home exercise. Figures come from the supplied 10,000-row sample
          dataset.
        </p>
      </footer>
    </div>
  );
}
