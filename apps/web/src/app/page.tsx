"use client";

import { ArrowRight, Coins } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Grain, Logo, ScrollRail } from "@/components/landing/Atmosphere";
import { StoryBackdrop, type StoryChapter } from "@/components/landing/StoryBackdrop";
import { usePrefersReducedMotion } from "@/hooks/useBrowserState";

/**
 * The landing page: a scroll-driven photographic story.
 *
 * Four chapters, four full-bleed photographs. Scrolling pushes each image in,
 * drifts it against the scroll, and cross-fades to the next, while the copy
 * over it counts the product's real figures up. Images and copy are driven by
 * ONE progress number taken from the pinned stage, so they cannot desync.
 *
 * Under prefers-reduced-motion the stage un-pins and every chapter lays out in
 * full, statically. Nothing is hidden behind an animation that never runs.
 */

const TOTAL_TX = 10_000;
const TOTAL_COINS = 362_629;
const MONTHS = 14;

const CHAPTERS: StoryChapter[] = [
  { src: "/img/story-1-coin.jpg", at: 0.0, position: "62% 50%", copySide: "left" },
  { src: "/img/story-2-city.jpg", at: 0.34, position: "50% 42%", copySide: "left" },
  { src: "/img/story-3-flow.jpg", at: 0.64, position: "center", copySide: "right" },
  { src: "/img/story-4-coins.jpg", at: 0.92, position: "center", copySide: "center" },
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
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    // With motion disabled there is nothing to track: the stage un-pins and
    // every chapter is laid out in full below.
    if (reduced) return;

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
      // One measurement per frame. Reading layout on every wheel event is what
      // makes scroll-driven pages stutter.
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
  }, [reduced]);

  const p = reduced ? 1 : progress;

  const c1 = 1 - chapter(p, 0.1, 0.24);
  const c2 = Math.min(chapter(p, 0.24, 0.34), 1 - chapter(p, 0.46, 0.56));
  const c3 = Math.min(chapter(p, 0.54, 0.64), 1 - chapter(p, 0.76, 0.86));
  const c4 = chapter(p, 0.84, 0.93);

  const txCount = Math.round(easeOut(chapter(p, 0.24, 0.44)) * TOTAL_TX);
  const coinCount = Math.round(easeOut(chapter(p, 0.84, 0.98)) * TOTAL_COINS);

  /** Pinned chapters stack; reduced-motion chapters flow down the page. */
  const layer = (visible: number, align: string) =>
    reduced
      ? { className: `relative ${align}`, style: undefined }
      : {
          className: `absolute inset-0 flex flex-col justify-center ${align}`,
          style: {
            opacity: visible,
            transform: `translateY(${(1 - visible) * 26}px)`,
            pointerEvents: (visible < 0.5 ? "none" : undefined) as "none" | undefined,
          },
        };

  return (
    <div className="relative min-h-dvh bg-bg">
      <Grain />
      {!reduced && <ScrollRail progress={p} />}

      <header className="fixed inset-x-0 top-0 z-30">
        <nav className="mx-auto flex max-w-[1200px] items-center gap-6 px-5 py-5 sm:px-8">
          <span className="mr-auto inline-flex items-center gap-2.5 text-white">
            <Logo size={20} />
            <span className="text-[13px] font-medium uppercase tracking-[0.16em]">Coinfold</span>
          </span>
          <Link
            href="/login"
            className="text-[12px] uppercase tracking-[0.14em] text-white/65 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 min-h-9 items-center rounded-[var(--r-pill)] bg-white px-4 text-[12px] font-medium uppercase tracking-[0.12em] text-[#08090a] transition-transform hover:scale-[1.03]"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* ---- The pinned stage ------------------------------------------- */}
      <div ref={stageRef} style={{ height: reduced ? "auto" : "560vh" }}>
        <div
          className={
            reduced
              ? "relative space-y-32 overflow-x-clip px-5 py-32 sm:px-8"
              : "sticky top-0 h-dvh overflow-hidden px-5 sm:px-8"
          }
        >
          <StoryBackdrop chapters={CHAPTERS} progress={p} reduced={reduced} />

          <div className="relative mx-auto h-full w-full max-w-[1200px]">
            {/* Chapter 1 — the claim */}
            <section {...layer(c1, "")}>
              <p className="text-[12px] uppercase tracking-[0.24em] text-white/55">
                Credit-card bills, without the amnesia
              </p>
              <h1 className="mt-5 max-w-[15ch] text-[clamp(2.7rem,8.5vw,6.4rem)] font-semibold uppercase leading-[0.93] tracking-[-0.04em] text-white">
                Pay the bill. Keep the change.
              </h1>
              <p className="mt-7 max-w-[44ch] text-[15px] leading-relaxed text-white/70">
                Every ₹100 you pay earns a coin. Every rupee you spend is sorted, searchable and
                charted — across {TOTAL_TX.toLocaleString("en-IN")} real transactions.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="inline-flex h-12 min-h-12 items-center gap-2 rounded-[var(--r-control)] bg-accent px-6 text-[15px] font-medium text-on-accent transition-[filter] hover:brightness-110"
                >
                  Create an account
                  <ArrowRight size={16} aria-hidden />
                </Link>
                <Link
                  href="/login"
                  className="text-[13px] text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  Use the demo account
                </Link>
              </div>
            </section>

            {/* Chapter 2 — the volume */}
            <section {...layer(c2, "")}>
              <p className="text-[12px] uppercase tracking-[0.24em] text-white/55">
                Every row, sorted on the server
              </p>
              <p className="tnum mt-4 text-[clamp(3.2rem,12vw,8.5rem)] font-semibold leading-[0.9] tracking-[-0.04em] text-white">
                {txCount.toLocaleString("en-IN")}
              </p>
              <p className="mt-5 max-w-[42ch] text-[15px] leading-relaxed text-white/70">
                transactions across {MONTHS} months. Filtered, sorted and paginated in Postgres —
                never shipped to your browser in one lump.
              </p>
            </section>

            {/* Chapter 3 — the sort. Copy on the right. */}
            <section {...layer(c3, "items-end text-right")}>
              <div className="max-w-[34ch]">
                <p className="text-[12px] uppercase tracking-[0.24em] text-white/55">
                  Where the money actually went
                </p>
                <h2 className="mt-4 text-[clamp(2rem,5.5vw,3.6rem)] font-semibold uppercase leading-[0.97] tracking-[-0.03em] text-white">
                  Ten categories. One glance.
                </h2>
                <p className="mt-5 text-[15px] leading-relaxed text-white/70">
                  Click a slice and the table below it filters. Filter the table and the charts
                  reshape. They read the same query, so they can never disagree.
                </p>
              </div>
            </section>

            {/* Chapter 4 — the payoff. Centred. */}
            <section {...layer(c4, "items-center text-center")}>
              <p className="text-[12px] uppercase tracking-[0.24em] text-white/55">
                And the change you kept
              </p>
              <p className="tnum mt-4 text-[clamp(3rem,11vw,7.5rem)] font-semibold leading-[0.9] tracking-[-0.04em] text-white">
                {coinCount.toLocaleString("en-IN")}
              </p>
              <p className="mt-2 inline-flex items-center gap-2 text-[13px] uppercase tracking-[0.18em] text-accent">
                <Coins size={15} aria-hidden />
                coins earned
              </p>
              <p className="mx-auto mt-6 max-w-[42ch] text-[15px] leading-relaxed text-white/70">
                Redeemable against vouchers and statement cashback. The balance is a ledger, not a
                counter — every coin traces back to the payment that earned it.
              </p>
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

          <div className="mt-16 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="inline-flex h-12 min-h-12 items-center gap-2 rounded-[var(--r-control)] bg-accent px-6 text-[15px] font-medium text-on-accent transition-[filter] hover:brightness-110"
            >
              Create an account
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              href="/login"
              className="text-[13px] text-text-dim underline-offset-4 transition-colors hover:text-text hover:underline"
            >
              Sign in with the demo account
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-border px-5 py-8 sm:px-8">
        <p className="mx-auto max-w-[1200px] text-[12px] text-text-faint">
          Coinfold — built as a take-home exercise. Every figure comes from the supplied
          10,000-row sample dataset. Photography under the Pexels Licence.
        </p>
      </footer>
    </div>
  );
}
