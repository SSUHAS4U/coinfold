"use client";

import { ArrowRight, Coins, Fingerprint, Layers, Search, ShieldCheck, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { Mark } from "@/components/brand/Mark";
import { FloatingNav } from "@/components/landing/FloatingNav";
import { CinematicHero } from "@/components/landing/CinematicHero";
import { PhotoCard } from "@/components/ui/PhotoCard";
import { categoryColor, moneyCompact } from "@/lib/format";
import { inView, rise, riseStagger, springControl, tap } from "@/lib/motion";

/**
 * The landing page.
 *
 * The scroll story does the persuading; everything below it is the honest
 * detail a reviewer wants. Deliberately NOT a grid of twenty identical cards —
 * the sections below have different shapes because they carry different kinds
 * of information.
 */

const CATEGORIES = [
  { slug: "education", label: "Education", hue: 25, total: 24_000_000, share: "38.5%" },
  { slug: "insurance", label: "Insurance", hue: 265, total: 11_000_000, share: "18.1%" },
  { slug: "shopping", label: "Shopping", hue: 330, total: 10_000_000, share: "16.2%" },
  { slug: "travel", label: "Travel", hue: 205, total: 5_380_000, share: "8.7%" },
  { slug: "health", label: "Health", hue: 105, total: 3_200_000, share: "5.1%" },
  { slug: "groceries", label: "Groceries", hue: 62, total: 2_610_000, share: "4.2%" },
  { slug: "fuel", label: "Fuel", hue: 8, total: 1_730_000, share: "2.8%" },
  { slug: "utilities", label: "Utilities", hue: 235, total: 1_650_000, share: "2.7%" },
] as const;

const STEPS = [
  {
    step: "01",
    title: "You pay",
    body: "Settle a card bill the way you already do. Nothing changes about the payment itself.",
    image: "/img/story-pay.jpg",
  },
  {
    step: "02",
    title: "We sort it",
    body: "Every transaction is normalised, categorised and charted the moment it lands.",
    image: "/img/story-review.jpg",
  },
  {
    step: "03",
    title: "You keep the change",
    body: "One coin per ₹100, redeemable against vouchers and statement cashback.",
    image: "/img/story-reward.jpg",
  },
] as const;

const CAPABILITIES = [
  {
    icon: Layers,
    title: "Five timestamp formats, one timeline",
    body: "The feed mixes ISO, epoch milliseconds, day-first slashes and bare dates. All 10,000 rows are normalised at ingest, and every repair is recorded against the row it changed.",
  },
  {
    icon: Search,
    title: "Ten thousand rows, fifty at a time",
    body: "Filtering, sorting and pagination happen in Postgres. Your browser holds one page, never the whole table, so search stays instant at any size.",
  },
  {
    icon: Coins,
    title: "Coins are a ledger, not a counter",
    body: "An append-only entry per payment. A balance is the sum of things that happened, so it can always explain itself.",
  },
  {
    icon: ShieldCheck,
    title: "Redeems fail closed",
    body: "The balance is re-read under a row lock at redeem time, and every attempt carries an idempotency key. A dropped response never charges you twice.",
  },
  {
    icon: Fingerprint,
    title: "Nothing is silently dropped",
    body: "40 duplicate ids, 200 missing categories, 148 refunds and one sentinel amount. Each is kept, flagged, and explained on the row itself.",
  },
  {
    icon: Sparkles,
    title: "Errors that name the fix",
    body: "Every failure returns what happened, why it happened, and the one thing to do next — down to which screen to open.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh bg-[var(--canvas)]">
      <FloatingNav />

      {/* ---- The cinematic hero: four photographic bands --------------- */}
      <CinematicHero />

      {/* ---- How it works: three beats, not a card grid ----------------- */}
      <section id="how" className="relative px-5 py-28 sm:px-8">
        <div className="mx-auto max-w-[1080px]">
          <motion.div variants={rise} initial="hidden" whileInView="visible" viewport={inView}>
            <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-ink-faint">
              How it works
            </p>
            <h2 className="display mt-5 max-w-[20ch] text-[clamp(2.4rem,5.4vw,4rem)] text-ink">
              Pay the bill. Keep the change.
            </h2>
          </motion.div>

          <ol className="mt-14 grid gap-8 sm:grid-cols-3">
            {STEPS.map((item, index) => (
              <motion.li
                key={item.step}
                custom={index}
                variants={riseStagger}
                initial="hidden"
                whileInView="visible"
                viewport={inView}
              >
                <PhotoCard
                  src={item.image}
                  alt=""
                  eyebrow={item.step}
                  title={item.title}
                  aspect="5 / 4"
                >
                  <p className="text-[13.5px] leading-relaxed text-ink-dim">{item.body}</p>
                </PhotoCard>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Where the money goes: photography carrying real figures ---- */}
      <section className="relative px-5 pb-28 sm:px-8">
        <div className="mx-auto max-w-[1080px]">
          <motion.div variants={rise} initial="hidden" whileInView="visible" viewport={inView}>
            <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-ink-faint">
              Where it goes
            </p>
            <h2 className="display mt-5 max-w-[22ch] text-[clamp(2.4rem,5.4vw,4rem)] text-ink">
              Ten categories, and the real figure behind each one.
            </h2>
          </motion.div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((category, index) => (
              <motion.div
                key={category.slug}
                custom={index}
                variants={riseStagger}
                initial="hidden"
                whileInView="visible"
                viewport={inView}
              >
                <PhotoCard
                  src={`/img/cat-${category.slug}.jpg`}
                  alt=""
                  title={category.label}
                  value={moneyCompact(category.total)}
                  meta={`${category.share} of spend`}
                  tint={categoryColor(category.hue)}
                  aspect="4 / 3"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- The data: an editorial statement, then the detail ---------- */}
      <section id="data" className="relative px-5 pb-28 sm:px-8">
        <div className="mx-auto max-w-[1080px]">
          <motion.div
            variants={rise}
            initial="hidden"
            whileInView="visible"
            viewport={inView}
            className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--content)] p-8 shadow-[var(--shadow-rest)] sm:p-12"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-ink-faint">
              Built for the messy data
            </p>
            <p className="display mt-7 max-w-[24ch] text-[clamp(2rem,4.4vw,3.2rem)] text-ink">
              The supplied dataset was deliberately broken.{" "}
              <span className="ink-accent">Every defect is handled and disclosed.</span>
            </p>

            <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
              {[
                ["5", "timestamp formats"],
                ["40", "duplicate ids"],
                ["200", "categories recovered"],
                ["148", "refunds preserved"],
              ].map(([value, label], index) => (
                <motion.div
                  key={label}
                  custom={index}
                  variants={riseStagger}
                  initial="hidden"
                  whileInView="visible"
                  viewport={inView}
                >
                  <dt className="figure text-[clamp(1.8rem,4vw,2.6rem)] leading-none text-ink">
                    {value}
                  </dt>
                  <dd className="mt-2 text-[12.5px] text-ink-faint">{label}</dd>
                </motion.div>
              ))}
            </dl>
          </motion.div>

          <ul className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.li
                  key={item.title}
                  custom={index}
                  variants={riseStagger}
                  initial="hidden"
                  whileInView="visible"
                  viewport={inView}
                >
                  <span className="grid size-10 place-items-center rounded-[var(--r-control)] bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icon size={18} aria-hidden strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.015em] text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-dim">{item.body}</p>
                </motion.li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---- Close ------------------------------------------------------ */}
      <section className="relative px-5 pb-28 sm:px-8">
        <motion.div
          variants={rise}
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          className="mx-auto max-w-[1080px] overflow-hidden rounded-[var(--r-card)] p-10 text-center shadow-[var(--shadow-lift)] sm:p-16"
          style={{ backgroundImage: "var(--accent-gradient)" }}
        >
          <h2 className="display mx-auto max-w-[18ch] text-[clamp(2.3rem,5vw,3.6rem)] text-white">
            See where your money went.
          </h2>
          <p className="mx-auto mt-5 max-w-[44ch] text-[15px] leading-relaxed text-white/80">
            The demo account holds the full 10,000-row statement. No card, no setup.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <motion.span whileTap={tap} transition={springControl}>
              <Link
                href="/signup"
                className="inline-flex h-13 items-center gap-2 rounded-[var(--r-control)] bg-white px-7 text-[15px] font-medium text-[#16161d] shadow-[var(--shadow-rest)] transition-[filter] hover:brightness-[0.97]"
              >
                Create an account
                <ArrowRight size={16} aria-hidden />
              </Link>
            </motion.span>
            <Link
              href="/login"
              className="inline-flex h-13 items-center rounded-[var(--r-control)] border border-white/30 px-6 text-[15px] font-medium text-white transition-colors hover:bg-white/10"
            >
              Use the demo account
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ---- Footer ----------------------------------------------------- */}
      <footer className="relative border-t border-[var(--line)] px-5 py-14 sm:px-8">
        <div className="mx-auto grid max-w-[1080px] gap-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2.5 text-ink">
              <Mark size={22} id="footer" />
              <span className="text-[15px] font-semibold tracking-[-0.02em]">Coinfold</span>
            </span>
            <p className="mt-4 max-w-[34ch] text-[13px] leading-relaxed text-ink-faint">
              Credit-card bills, without the amnesia. Built as a take-home exercise on a supplied
              10,000-row dataset.
            </p>
          </div>

          {[
            ["Product", [["Overview", "/app"], ["Transactions", "/app/transactions"], ["Analytics", "/app/analytics"], ["Rewards", "/app/rewards"]]],
            ["Account", [["Sign in", "/login"], ["Create account", "/signup"]]],
            ["Source", [["GitHub", "https://github.com/SSUHAS4U/coinfold"]]],
          ].map(([heading, links]) => (
            <div key={heading as string}>
              <h3 className="text-[11px] font-medium uppercase tracking-[0.13em] text-ink-faint">
                {heading as string}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {(links as [string, string][]).map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-[13.5px] text-ink-dim underline-offset-4 transition-colors hover:text-ink hover:underline"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-12 max-w-[1080px] border-t border-[var(--line)] pt-6 text-[12px] text-ink-faint">
          Every figure on this page comes from the supplied dataset. Nothing is illustrative.
        </p>
      </footer>
    </div>
  );
}
