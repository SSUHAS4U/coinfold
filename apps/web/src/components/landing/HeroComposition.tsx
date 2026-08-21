"use client";

import { Coins, TrendingUp } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import Image from "next/image";
import { useRef } from "react";

import { usePrefersReducedMotion } from "@/hooks/useBrowserState";
import { categoryColor } from "@/lib/format";
import { springPanel, springTravel } from "@/lib/motion";

/**
 * The hero composition: the product, in pieces, floating.
 *
 * Rather than a screenshot of a dashboard or a photograph with type on it,
 * this is the app's own surfaces — a photo card, a transaction row, the coin
 * dial, a sparkline — arranged at different depths and drifting against the
 * pointer. It is immediately visual, it is unmistakably THIS product, and it
 * cannot be mistaken for a stock template.
 *
 * The depth is real: each card has its own `depth` factor, so the ones that
 * read as nearer move further. That parallax is what makes a flat stack of
 * divs read as a space rather than a collage.
 *
 * Pointer tracking is spring-smoothed so the cards trail the cursor slightly
 * instead of snapping to it, and it is disabled entirely under reduced motion,
 * where the composition simply sits still.
 */

const SPARK = [46.5, 53.5, 50.4, 58.0, 46.1, 49.4, 46.8, 44.4, 56.4, 45.7, 51.3, 48.9];

function sparkPath(values: number[], w: number, h: number) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h * 0.8 - h * 0.1;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

const SPARK_D = sparkPath(SPARK, 150, 44);

/** One floating card. `depth` drives both parallax and entrance delay. */
function Floating({
  children,
  className = "",
  depth,
  rotate,
  delay,
  x,
  y,
  reduced,
}: {
  children: React.ReactNode;
  className?: string;
  depth: number;
  rotate: number;
  delay: number;
  x: ReturnType<typeof useSpring>;
  y: ReturnType<typeof useSpring>;
  reduced: boolean;
}) {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- depth is a constant per call site
  const tx = useTransform(x, (v) => v * depth);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const ty = useTransform(y, (v) => v * depth);

  return (
    <motion.div
      className={`absolute ${className}`}
      style={reduced ? { rotate } : { x: tx, y: ty, rotate }}
      initial={{ opacity: 0, y: 28, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springPanel, delay }}
    >
      {children}
    </motion.div>
  );
}

export function HeroComposition() {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  // Trailing, not tracking: the spring is what stops it feeling glued to the
  // cursor like a cheap tilt effect.
  const x = useSpring(rawX, { stiffness: 90, damping: 22, mass: 0.7 });
  const y = useSpring(rawY, { stiffness: 90, damping: 22, mass: 0.7 });

  const onPointerMove = (event: React.PointerEvent) => {
    if (reduced) return;
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    // Normalised to roughly -1..1, then scaled to a small travel. Big parallax
    // reads as a gimmick; this is meant to be felt, not noticed.
    rawX.set(((event.clientX - box.left) / box.width - 0.5) * 26);
    rawY.set(((event.clientY - box.top) / box.height - 0.5) * 26);
  };

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        rawX.set(0);
        rawY.set(0);
      }}
      className="relative mx-auto aspect-[4/3.4] w-full max-w-[560px] lg:max-w-none"
    >
      {/* A soft brand glow behind the stack, so the cards sit in light rather
          than on flat grey. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 size-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-[80px]"
        style={{ backgroundImage: "var(--accent-gradient)" }}
      />

      {/* --- Back: a category photograph --------------------------------- */}
      <Floating
        depth={0.35}
        rotate={-5}
        delay={0.05}
        x={x}
        y={y}
        reduced={reduced}
        className="left-0 top-[4%] w-[62%]"
      >
        <div className="overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--content)] shadow-[var(--shadow-float)]">
          <div className="relative aspect-[4/3]">
            <Image
              src="/img/cat-travel.jpg"
              alt=""
              fill
              priority
              sizes="340px"
              className="object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-2/3"
              style={{
                background:
                  "linear-gradient(180deg, transparent, rgb(10 10 16 / 0.72))",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3.5">
              <span className="text-[13.5px] font-semibold text-white">Travel</span>
              <span className="figure text-[15px] text-white">₹53.8L</span>
            </div>
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[3px]"
              style={{ background: categoryColor(205) }}
            />
          </div>
        </div>
      </Floating>

      {/* --- Middle: a real transaction row ------------------------------ */}
      <Floating
        depth={0.7}
        rotate={2}
        delay={0.14}
        x={x}
        y={y}
        reduced={reduced}
        className="right-0 top-[26%] w-[74%]"
      >
        <div className="flex items-center gap-3.5 rounded-[var(--r-inner)] border border-[var(--line)] bg-[var(--content)] px-4 py-3.5 shadow-[var(--shadow-float)]">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white"
            style={{ background: categoryColor(350) }}
          >
            D
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium text-ink">Domino&apos;s</span>
            <span className="block text-[12px] text-ink-faint">Food &amp; Dining · 15 Jul</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="figure block text-[15px] text-ink">₹689.19</span>
            <span
              className="tnum inline-flex items-center gap-1 text-[11.5px]"
              style={{ color: "var(--gold)" }}
            >
              <Coins size={10} aria-hidden />
              +6
            </span>
          </span>
        </div>
      </Floating>

      {/* --- Front left: the coin dial ----------------------------------- */}
      <Floating
        depth={1.15}
        rotate={-3}
        delay={0.22}
        x={x}
        y={y}
        reduced={reduced}
        className="bottom-[6%] left-[4%] w-[52%]"
      >
        <div className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--content)] p-4 shadow-[var(--shadow-float)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.11em] text-ink-faint">
            Coin balance
          </p>
          <p className="figure mt-2 flex items-center gap-2 text-[26px] leading-none text-ink">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-full text-[13px] font-semibold text-white"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--gold-bright), var(--gold))",
              }}
            >
              ₹
            </span>
            3,62,629
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--canvas-sunk)]">
            <motion.span
              className="block h-full rounded-full"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--gold-bright), var(--gold))",
              }}
              initial={{ width: "0%" }}
              animate={{ width: "74%" }}
              transition={{ ...springTravel, delay: 0.5 }}
            />
          </div>
        </div>
      </Floating>

      {/* --- Front right: the trend -------------------------------------- */}
      <Floating
        depth={0.95}
        rotate={4}
        delay={0.3}
        x={x}
        y={y}
        reduced={reduced}
        className="bottom-[16%] right-[2%] w-[46%]"
      >
        <div className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--content)] p-4 shadow-[var(--shadow-float)]">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.11em] text-ink-faint">
            <TrendingUp size={12} aria-hidden />
            14 months
          </p>
          <svg viewBox="0 0 150 44" className="mt-2.5 w-full" aria-hidden>
            <defs>
              <linearGradient id="hero-spark" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent-2)" />
              </linearGradient>
            </defs>
            <motion.path
              d={SPARK_D}
              fill="none"
              stroke="url(#hero-spark)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              initial={{ strokeDashoffset: reduced ? 0 : 1 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: reduced ? 0 : 1.1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <p className="figure mt-1 text-[15px] text-ink">₹6.2Cr</p>
        </div>
      </Floating>
    </div>
  );
}
