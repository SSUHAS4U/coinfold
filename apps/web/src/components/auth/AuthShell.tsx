"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Mark } from "@/components/brand/Mark";
import { GradedPhoto } from "@/components/ui/GradedPhoto";
import { easeEnter, rise, riseStagger } from "@/lib/motion";

/**
 * Shared frame for sign-in and sign-up.
 *
 * The left half is a designed field, not a photograph. Stock imagery reads as
 * website filler, and a financial product's visual language should come from
 * its own forms and figures rather than someone else's photo shoot.
 *
 * The composition is the accent gradient, one very large sentence, and three
 * real numbers. The ledger grid behind it sits at the threshold of visibility,
 * so it registers as depth rather than as a pattern.
 *
 * Hidden below `lg`: on a phone it would push the form under the fold, and a
 * sign-in you have to scroll to is worse than no picture at all. Ink on this
 * half is pinned white because the field is saturated in BOTH themes.
 */

export function AuthShell({
  image,
  eyebrow,
  headline,
  blurb,
  stats,
  children,
}: {
  /** Photograph behind the accent field. */
  image: string;
  eyebrow: string;
  headline: ReactNode;
  blurb: string;
  stats: [string, string][];
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh bg-[var(--canvas)] lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-[#2b2a6b] lg:block">
        <GradedPhoto src={image} priority sizes="55vw" strength={0.85} />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgb(20 18 60 / 0.35) 0%, transparent 40%, rgb(20 18 60 / 0.65) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(255 255 255 / 0.6) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.6) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(ellipse 80% 70% at 30% 40%, #000 20%, transparent 75%)",
          }}
        />
        <div
          aria-hidden
          className="absolute -left-[10%] -top-[20%] size-[60%] rounded-full opacity-40 blur-[100px]"
          style={{ background: "rgb(255 255 255 / 0.5)" }}
        />

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Link href="/" className="inline-flex items-center gap-2.5 text-white">
            <span className="grid size-8 place-items-center rounded-[10px] bg-white/20 backdrop-blur-sm">
              <Mark size={20} id="auth" />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Coinfold</span>
          </Link>

          <motion.div initial="hidden" animate="visible" variants={rise}>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">
              {eyebrow}
            </p>
            <h2 className="mt-5 max-w-[16ch] text-[clamp(2.1rem,3.2vw,3.1rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white">
              {headline}
            </h2>
            <p className="mt-6 max-w-[40ch] text-[15px] leading-relaxed text-white/75">{blurb}</p>

            <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-6">
              {stats.map(([value, label], index) => (
                <motion.div
                  key={label}
                  custom={index}
                  variants={riseStagger}
                  initial="hidden"
                  animate="visible"
                >
                  <dt className="figure text-[26px] leading-none text-white">{value}</dt>
                  <dd className="mt-1.5 text-[12px] text-white/65">{label}</dd>
                </motion.div>
              ))}
            </dl>
          </motion.div>
        </div>
      </aside>

      <div className="relative flex items-center justify-center px-5 py-12 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={easeEnter}
          className="w-full max-w-[400px]"
        >
          <Link href="/" className="mb-9 inline-flex items-center gap-2.5 text-ink lg:hidden">
            <Mark size={22} id="auth-mobile" />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Coinfold</span>
          </Link>
          {children}
        </motion.div>
      </div>
    </main>
  );
}

export const authInputClass =
  "h-12 min-h-12 w-full rounded-[var(--r-control)] border border-[var(--line-strong)] " +
  "bg-[var(--content)] px-3.5 text-[14.5px] text-ink placeholder:text-ink-faint " +
  "shadow-[var(--shadow-rest)] transition-[border-color,box-shadow] duration-[var(--t-hover)] " +
  "hover:border-[color-mix(in_oklab,var(--accent)_40%,var(--line-strong))] " +
  "focus:border-[var(--accent)] focus:outline-none " +
  "focus:shadow-[0_0_0_4px_var(--accent-soft)]";

export function AuthField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-2 block text-[12px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export function AuthError({ what, action }: { what: string; action: string }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[var(--r-control)] border px-3.5 py-3"
      style={{
        borderColor: "color-mix(in oklab, var(--down) 30%, transparent)",
        background: "color-mix(in oklab, var(--down) 7%, transparent)",
      }}
    >
      <p className="text-[13px] font-medium" style={{ color: "var(--down)" }}>
        {what}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{action}</p>
    </motion.div>
  );
}
