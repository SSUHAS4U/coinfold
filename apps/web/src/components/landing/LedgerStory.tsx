"use client";

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/useBrowserState";
import { categoryColor } from "@/lib/format";

/**
 * "The Ledger" — the landing story, told with the product itself.
 *
 * Four scenes, driven by one scroll-progress number taken from a pinned stage:
 *
 *   A  one real transaction, alone and enormous
 *   B  rows stack in behind it until it is a working table
 *   C  the table lifts away and the spend chart draws itself
 *   D  the chart coils into a coin, and the balance counts up
 *
 * Every figure is real. The rows are genuine transactions from the seeded
 * dataset; the chart is the actual month-by-month spend. Nothing here is a
 * decorative abstraction standing in for data that exists.
 *
 * Performance: only `opacity` and `transform` animate, both compositor
 * properties. Roughly 30 DOM nodes carry the whole story — the point of
 * showing the product rather than ten thousand particles is that it costs
 * almost nothing to render.
 */

// --- Real rows from the seeded dataset -------------------------------------
const ROWS = [
  { merchant: "Domino's", category: "Food & Dining", hue: 350, amount: "₹689.19", status: "paid" },
  { merchant: "IRCTC", category: "Travel", hue: 205, amount: "₹1,688.00", status: "paid" },
  { merchant: "Starbucks", category: "Food & Dining", hue: 350, amount: "₹192.73", status: "paid" },
  { merchant: "Cult.fit", category: "Health", hue: 105, amount: "₹5,367.76", status: "paid" },
  { merchant: "Myntra", category: "Shopping", hue: 330, amount: "₹8,750.59", status: "paid" },
  { merchant: "IndiGo", category: "Travel", hue: 205, amount: "₹3,092.42", status: "paid" },
  { merchant: "BYJU'S", category: "Education", hue: 25, amount: "₹34,802.00", status: "failed" },
  { merchant: "Zepto", category: "Groceries", hue: 62, amount: "₹4,034.02", status: "failed" },
  { merchant: "HDFC Ergo", category: "Insurance", hue: 265, amount: "₹17,303.47", status: "paid" },
  { merchant: "Rapido", category: "Travel", hue: 205, amount: "₹5,905.37", status: "paid" },
];

// --- The real monthly spend, in lakhs --------------------------------------
const MONTHS = [
  0.3, 46.5, 53.5, 50.4, 58.0, 46.1, 49.4, 46.8, 44.4, 56.4, 45.7, 51.3, 48.9, 22.7,
];

const TOTAL_TX = 10_000;
const TOTAL_COINS = 362_629;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/** Maps global progress into a 0..1 window. */
function scene(p: number, start: number, end: number) {
  return clamp01((p - start) / (end - start));
}

function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}

/** Builds a smooth cardinal-spline path through the monthly values. */
function trendPath(values: number[], w: number, h: number) {
  const max = Math.max(...values);
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - (v / max) * h * 0.82 - h * 0.09,
  ]);

  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
    // Catmull-Rom converted to cubic Bézier: smooth curves through every real
    // point, rather than a hand-drawn approximation of the data.
    d +=
      ` C ${x1 + (x2 - x0) / 6} ${y1 + (y2 - y0) / 6},` +
      ` ${x2 - (x3 - x1) / 6} ${y2 - (y3 - y1) / 6},` +
      ` ${x2} ${y2}`;
  }
  return { d, pts };
}

const CHART_W = 900;
const CHART_H = 300;
const { d: TREND_D, pts: TREND_PTS } = trendPath(MONTHS, CHART_W, CHART_H);
const TREND_AREA = `${TREND_D} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`;

function LedgerRow({
  row,
  lead,
}: {
  row: (typeof ROWS)[number];
  lead?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center gap-4 rounded-[var(--r-inner)] bg-[var(--content)] px-5",
        lead ? "h-[92px] shadow-[var(--shadow-lift)]" : "h-[60px] shadow-[var(--shadow-rest)]",
        "border border-[var(--line)]",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={lead ? "size-2.5 shrink-0 rounded-full" : "size-2 shrink-0 rounded-full"}
        style={{ background: categoryColor(row.hue) }}
      />
      <span className="min-w-0 flex-1">
        <span
          className={[
            "block truncate font-medium text-ink",
            lead ? "text-[19px] tracking-[-0.02em]" : "text-[14px]",
          ].join(" ")}
        >
          {row.merchant}
        </span>
        <span className={lead ? "block text-[13px] text-ink-faint" : "block text-[12px] text-ink-faint"}>
          {row.category}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className={[
            "figure block text-ink",
            lead ? "text-[22px]" : "text-[14px]",
          ].join(" ")}
        >
          {row.amount}
        </span>
        <span
          className="block text-[11px]"
          style={{ color: row.status === "failed" ? "var(--down)" : "var(--up)" }}
        >
          {row.status === "failed" ? "✕ failed" : "● paid"}
        </span>
      </span>
    </div>
  );
}

export function LedgerStory() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [p, setProgress] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const stage = stageRef.current;
      if (!stage) return;
      const { top, height } = stage.getBoundingClientRect();
      const travel = height - window.innerHeight;
      setProgress(travel <= 0 ? 0 : clamp01(-top / travel));
    };

    const onScroll = () => {
      // One layout read per frame. Measuring on every wheel event is what
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

  // --- Scene windows -------------------------------------------------------
  const sA = 1 - scene(p, 0.1, 0.2); // lead row: present, then hands over
  const sB = Math.min(scene(p, 0.14, 0.3), 1 - scene(p, 0.42, 0.5)); // the stack
  const sC = Math.min(scene(p, 0.48, 0.58), 1 - scene(p, 0.72, 0.8)); // the chart
  const sD = scene(p, 0.78, 0.88); // the coin

  const stackIn = scene(p, 0.14, 0.4);
  const draw = easeOut(scene(p, 0.5, 0.74));
  const txCount = Math.round(easeOut(scene(p, 0.16, 0.4)) * TOTAL_TX);
  const coinCount = Math.round(easeOut(scene(p, 0.78, 0.96)) * TOTAL_COINS);

  /** Pinned scenes stack; with motion disabled they flow down the page. */
  const layer = (visible: number) =>
    reduced
      ? { className: "relative", style: undefined }
      : {
          className: "absolute inset-0 flex flex-col items-center justify-center",
          style: {
            opacity: visible,
            pointerEvents: (visible < 0.5 ? "none" : undefined) as "none" | undefined,
          },
        };

  return (
    <div ref={stageRef} style={{ height: reduced ? "auto" : "620vh" }}>
      <div
        className={
          reduced
            ? "relative space-y-32 px-5 py-28 sm:px-8"
            : "sticky top-0 flex h-dvh items-center overflow-hidden px-5 sm:px-8"
        }
      >
        <div className="relative mx-auto h-full w-full max-w-[1080px]">
          {/* ---- A: one transaction, alone ------------------------------ */}
          <section {...layer(sA)}>
            <div
              className="w-full max-w-[520px]"
              style={
                reduced
                  ? undefined
                  : { transform: `scale(${1 - (1 - sA) * 0.12}) translateY(${(1 - sA) * -24}px)` }
              }
            >
              <LedgerRow row={ROWS[0]} lead />
            </div>
            <h1 className="mt-10 max-w-[16ch] text-center text-[clamp(2.4rem,6vw,4.4rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink">
              Your money has a story.
            </h1>
            <p className="mt-5 max-w-[46ch] text-center text-[16px] leading-relaxed text-ink-dim">
              Coinfold turns every payment into something you can actually read.
            </p>
          </section>

          {/* ---- B: the stack becomes a table --------------------------- */}
          <section {...layer(sB)}>
            <div className="mb-8 text-center">
              <p className="figure text-[clamp(2.6rem,8vw,5.5rem)] leading-none text-ink">
                {txCount.toLocaleString("en-IN")}
              </p>
              <p className="mt-3 text-[15px] text-ink-dim">
                payments, sorted and searchable in Postgres
              </p>
            </div>

            <div className="w-full max-w-[620px] space-y-2">
              {ROWS.slice(0, 7).map((row, index) => {
                // Each row arrives slightly after the one above it, so the
                // stack assembles rather than appearing all at once.
                const local = clamp01(stackIn * 4 - index * 0.42);
                return (
                  <div
                    key={row.merchant + index}
                    style={
                      reduced
                        ? undefined
                        : {
                            opacity: local,
                            transform: `translateY(${(1 - local) * 26}px) scale(${0.97 + local * 0.03})`,
                          }
                    }
                  >
                    <LedgerRow row={row} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---- C: the chart draws itself ------------------------------ */}
          <section {...layer(sC)}>
            <div className="w-full max-w-[880px]">
              <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-ink-faint">
                Fourteen months
              </p>
              <h2 className="mt-3 max-w-[18ch] text-[clamp(1.9rem,4.4vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
                Then it draws its own conclusion.
              </h2>

              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="mt-8 w-full"
                aria-hidden
                preserveAspectRatio="none"
                style={{ height: "clamp(180px, 30vh, 300px)" }}
              >
                <defs>
                  <linearGradient id="ledger-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="ledger-line" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--accent)" />
                    <stop offset="100%" stopColor="var(--accent-2)" />
                  </linearGradient>
                </defs>

                {/* The fill follows the line rather than leading it. */}
                <path d={TREND_AREA} fill="url(#ledger-fill)" style={{ opacity: draw }} />

                {/* pathLength normalises the dash maths to 1 regardless of the
                    path's real length, so the draw is linear in progress. */}
                <path
                  d={TREND_D}
                  fill="none"
                  stroke="url(#ledger-line)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={reduced ? 0 : 1 - draw}
                />

                {/* The head of the line, riding the real geometry. */}
                {!reduced && draw > 0.02 && draw < 0.999 && (
                  <circle
                    r="6"
                    fill="var(--accent-2)"
                    stroke="var(--content)"
                    strokeWidth="3"
                    cx={TREND_PTS[Math.min(TREND_PTS.length - 1, Math.floor(draw * (TREND_PTS.length - 1)))][0]}
                    cy={TREND_PTS[Math.min(TREND_PTS.length - 1, Math.floor(draw * (TREND_PTS.length - 1)))][1]}
                  />
                )}
              </svg>

              <p className="mt-5 max-w-[44ch] text-[15px] leading-relaxed text-ink-dim">
                Ten categories, month by month. Click a slice and the table below it filters —
                they read the same query, so they can never disagree.
              </p>
            </div>
          </section>

          {/* ---- D: the coin -------------------------------------------- */}
          <section {...layer(sD)}>
            <div className="text-center">
              <svg
                viewBox="0 0 120 120"
                aria-hidden
                className="mx-auto"
                style={{
                  width: "clamp(96px, 15vw, 148px)",
                  transform: reduced ? undefined : `scale(${0.82 + easeOut(sD) * 0.18})`,
                }}
              >
                <defs>
                  <linearGradient id="coin-face" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--gold-bright)" />
                    <stop offset="100%" stopColor="var(--gold)" />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r="52" fill="url(#coin-face)" />
                <circle
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke="rgb(255 255 255 / 0.4)"
                  strokeWidth="1.5"
                />
                <text
                  x="60"
                  y="60"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize="44"
                  fontWeight="600"
                  fontFamily="var(--font-inter), sans-serif"
                >
                  ₹
                </text>
              </svg>

              <p className="figure mt-8 text-[clamp(2.6rem,8vw,5.5rem)] leading-none text-ink">
                {coinCount.toLocaleString("en-IN")}
              </p>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.13em] text-ink-faint">
                Coins earned
              </p>
              <p className="mx-auto mt-6 max-w-[42ch] text-[15px] leading-relaxed text-ink-dim">
                One for every ₹100 paid. The balance is a ledger, not a counter — every coin
                traces back to the payment that earned it.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
