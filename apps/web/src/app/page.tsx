"use client";

import { ArrowRight, Coins } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Grain, Logo, ScrollRail, Wash } from "@/components/landing/Atmosphere";
import { ParticleField } from "@/components/landing/ParticleField";
import { PhotoBackdrop, type Chapter } from "@/components/landing/PhotoBackdrop";

/**
 * The landing page: a scroll-driven data story.
 *
 * The hero visual is not a stock photograph or a gradient blob — it is
 * 10,000 canvas particles, one per transaction in the sample dataset, each
 * carrying its real category colour. Scrolling reorganises them: scattered
 * field, then a stream, then sorted into ten bands whose thickness is each
 * category's genuine share of spend, then collapsed into a coin.
 *
 * Motion that carries data beats motion that decorates (SpaceX note). The
 * artwork here IS the dataset, which is also why it cannot look like anyone
 * else's landing page.
 *
 * Mechanism: one pinned stage, one scroll listener, one rAF. Progress through
 * the pinned region drives both the copy and the canvas from a single value,
 * so they cannot drift apart the way parallel timers do.
 */

const TOTAL_TX = 10_000;
const TOTAL_COINS = 362_629;
const MONTHS = 14;

const LEGEND: { label: string; hue: number }[] = [
  { label: "Travel", hue: 196 },
  { label: "Shopping", hue: 292 },
  { label: "Utilities", hue: 48 },
  { label: "Food & Dining", hue: 12 },
  { label: "Health", hue: 158 },
  { label: "Education", hue: 266 },
  { label: "Entertainment", hue: 330 },
  { label: "Groceries", hue: 95 },
  { label: "Fuel", hue: 32 },
  { label: "Insurance", hue: 232 },
];

const BACKDROPS: Chapter[] = [
  { src: "/img/coin-hero.jpg", alt: "", at: 0.0, position: "60% 45%" },
  { src: "/img/card-tap.jpg", alt: "", at: 0.26, position: "center" },
  { src: "/img/market-night.jpg", alt: "", at: 0.52, position: "center" },
  { src: "/img/coin-stack.jpg", alt: "", at: 0.8, position: "center" },
];

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

  const heroOut = chapter(p, 0, 0.16);
  const rowsIn = chapter(p, 0.14, 0.34);
  const barsIn = chapter(p, 0.38, 0.6);
  const coinsIn = chapter(p, 0.64, 0.86);

  const txCount = Math.round(easeOut(rowsIn) * TOTAL_TX);
  const coinCount = Math.round(easeOut(coinsIn) * TOTAL_COINS);

  const chapterClass = reduced
    ? "relative"
    : "absolute inset-0 flex flex-col justify-center";

  return (
    <div className="relative min-h-dvh bg-bg">
      <Grain />
      {!reduced && <ScrollRail progress={p} />}

      {/* Nav: plain text with the mark. No pills, no active underline. */}
      <header className="fixed inset-x-0 top-0 z-30">
        <nav className="mx-auto flex max-w-[1200px] items-center gap-6 px-5 py-5 sm:px-8">
          <span className="mr-auto inline-flex items-center gap-2.5 text-text">
            <Logo size={20} />
            <span className="text-[13px] font-medium uppercase tracking-[0.16em]">Coinfold</span>
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
      <div ref={stageRef} style={{ height: reduced ? "auto" : "500vh" }}>
        <div
          className={
            reduced
              // overflow-x-clip: the chapter scrims use negative insets, and
              // without the pinned stage's overflow-hidden to contain them they
              // extend past the viewport and scroll the page sideways.
              ? "relative space-y-28 overflow-x-clip px-5 py-28 sm:px-8"
              : "sticky top-0 h-dvh overflow-hidden px-5 sm:px-8"
          }
        >
          {/* Photography carries the atmosphere. */}
          <PhotoBackdrop chapters={BACKDROPS} progress={p} reduced={reduced} />
          <Wash />
          {/* The dataset, laid over the photograph as texture: it still
              performs the sort-into-categories moment, but it no longer has
              to carry the whole composition on its own. */}
          <div className="absolute inset-0 opacity-70 mix-blend-screen">
            <ParticleField progress={p} reduced={reduced} />
          </div>

          <div className="relative mx-auto h-full w-full max-w-[1200px]">
            {/* Chapter 1 — the claim */}
            <section
              className={chapterClass}
              style={
                reduced
                  ? undefined
                  : {
                      opacity: 1 - heroOut,
                      transform: `translateY(${heroOut * -40}px)`,
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
                charted. Each speck behind this text is one of{" "}
                {TOTAL_TX.toLocaleString("en-IN")} real transactions — keep scrolling and they
                sort themselves.
              </p>
            </section>

            {/* Chapter 2 — the volume */}
            <section
              className={chapterClass}
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
                transactions across {MONTHS} months, filtered and sorted in Postgres — never
                shipped to your browser in one lump.
              </p>
            </section>

            {/* Chapter 3 — the sort. The canvas does the drawing; the copy
                only names what the reader is already watching happen. */}
            <section
              className={chapterClass}
              style={
                reduced
                  ? undefined
                  : {
                      opacity: barsIn > 0 && coinsIn < 1 ? Math.min(barsIn * 2, 1 - coinsIn) : 0,
                      pointerEvents: "none",
                    }
              }
            >
              <div className="relative ml-auto max-w-[30ch] text-right">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-x-10 -inset-y-8"
                  style={{
                    background:
                      "radial-gradient(ellipse 70% 60% at 70% 50%, var(--bg) 45%, transparent 100%)",
                  }}
                />
                <div className="relative">
                <p className="text-[12px] uppercase tracking-[0.22em] text-text-faint">
                  Where the money actually went
                </p>
                <h2 className="mt-4 text-[clamp(1.8rem,5vw,3.2rem)] font-semibold uppercase leading-[0.98] tracking-[-0.03em] text-text">
                  Ten categories,
                  <br />
                  sorting themselves
                </h2>
                <ul className="mt-6 flex flex-wrap justify-end gap-x-4 gap-y-1.5">
                  {LEGEND.map((item) => (
                    <li
                      key={item.label}
                      className="inline-flex items-center gap-1.5 text-[11px] text-text-dim"
                    >
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full"
                        style={{ background: `oklch(72% 0.13 ${item.hue})` }}
                      />
                      {item.label}
                    </li>
                  ))}
                </ul>
                </div>
              </div>
            </section>

            {/* Chapter 4 — the payoff. THE one framed element in the design. */}
            <section
              className={
                reduced ? "relative" : "absolute inset-0 flex flex-col items-center justify-center"
              }
              style={reduced ? undefined : { opacity: coinsIn, pointerEvents: "none" }}
            >
              <div className="relative text-center">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-x-16 -inset-y-10"
                  style={{
                    background:
                      "radial-gradient(ellipse 60% 55% at 50% 62%, var(--bg) 40%, transparent 100%)",
                  }}
                />
                <p className="relative text-[12px] uppercase tracking-[0.22em] text-text-faint">
                  And the change you kept
                </p>

                <div
                  className="relative mx-auto mt-6 inline-flex items-center gap-4 rounded-[var(--r-card)] border border-border-strong bg-surface-1/80 px-7 py-5 shadow-[var(--shadow-2),var(--highlight)] backdrop-blur-md"
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

                <p className="relative mx-auto mt-6 max-w-[42ch] text-[15px] leading-relaxed text-text-dim">
                  Redeemable against vouchers and statement cashback. The balance is a ledger, not
                  a counter — every coin traces back to the payment that earned it.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ---- Below the story: a real page ------------------------------- */}
      <section className="relative border-t border-border px-5 py-24 sm:px-8">
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
                body: "40 duplicate ids, 200 missing categories, 148 refunds and one 999999999 sentinel. Each is kept, flagged, and explained in the row's own detail panel.",
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

      <footer className="relative border-t border-border px-5 py-8 sm:px-8">
        <p className="mx-auto max-w-[1200px] text-[12px] text-text-faint">
          Coinfold — built as a take-home exercise. Every figure comes from the supplied
          10,000-row sample dataset.
        </p>
      </footer>
    </div>
  );
}
