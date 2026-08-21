"use client";

import { AlertCircle, X } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { categoryColor, STATUS_LABEL } from "@/lib/format";
import { inView, rise, springControl, tap } from "@/lib/motion";

/* ---------------------------------------------------------------------------
 * Surface — the CONTENT layer. Objects resting on the canvas.
 *
 * Deliberately not blurred. Blur is reserved for things that float ABOVE the
 * interface; if a panel sitting in the page flow also blurs, "above" stops
 * meaning anything.
 * ------------------------------------------------------------------------- */

export function Surface({
  children,
  className = "",
  padded = true,
  reveal = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  /** Rises into place when scrolled to. Off for anything above the fold. */
  reveal?: boolean;
}) {
  return (
    <motion.section
      variants={reveal ? rise : undefined}
      initial={reveal ? "hidden" : false}
      whileInView={reveal ? "visible" : undefined}
      viewport={inView}
      className={[
        "rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--content)]",
        "shadow-[var(--shadow-rest)]",
        padded ? "p-6 sm:p-7" : "",
        className,
      ].join(" ")}
    >
      {children}
    </motion.section>
  );
}

export function SurfaceHead({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
        {hint && <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">{hint}</p>}
      </div>
      {action}
    </header>
  );
}

/* ---------------------------------------------------------------------------
 * Eyebrow — small uppercase metadata. Used sparingly, above a big number.
 * ------------------------------------------------------------------------- */

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-ink-faint">
      {children}
    </p>
  );
}

/* ---------------------------------------------------------------------------
 * FilterToken — a compact, removable filter chip.
 *
 * Replaces a row of dropdowns. Every active filter is visible as a token, so a
 * user can never be looking at a narrowed table without being able to see why
 * it is narrowed — the most common way a data view confuses people.
 * ------------------------------------------------------------------------- */

export function FilterToken({
  label,
  hue,
  active,
  count,
  onClick,
  onRemove,
}: {
  label: string;
  hue?: number;
  active?: boolean;
  count?: number;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  return (
    <motion.span
      layout
      transition={springControl}
      className={[
        "group inline-flex items-center rounded-[var(--r-pill)] border text-[13px]",
        "transition-colors duration-[var(--t-hover)]",
        active
          ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-ink"
          : "border-[var(--line)] bg-[var(--content)] text-ink-dim hover:border-[var(--line-strong)] hover:text-ink",
      ].join(" ")}
    >
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={onClick ? tap : undefined}
        transition={springControl}
        aria-pressed={onClick ? Boolean(active) : undefined}
        // The height lives on the BUTTON: with it only on the wrapper the chip
        // looked 36px while the real click target was 20px.
        className={[
          "inline-flex h-11 min-h-11 items-center gap-2 pl-3.5 outline-none sm:h-9 sm:min-h-9",
          onRemove ? "pr-2" : "pr-3.5",
        ].join(" ")}
      >
        {hue !== undefined && (
          // A 6px dot identifies the category without colouring the control.
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: categoryColor(hue) }}
          />
        )}
        <span className="truncate">{label}</span>
        {count !== undefined && (
          <span className="tnum text-ink-faint">{count.toLocaleString("en-IN")}</span>
        )}
      </motion.button>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} filter`}
          className="mr-1.5 grid size-6 place-items-center rounded-full text-ink-faint transition-colors hover:bg-[var(--content-active)] hover:text-ink"
        >
          <X size={12} aria-hidden />
        </button>
      )}
    </motion.span>
  );
}

/* ---------------------------------------------------------------------------
 * StatusDot
 *
 * Colour is never the only carrier: each status also has its own word and its
 * own glyph shape, so it survives a colour-blind reader and greyscale alike.
 * ------------------------------------------------------------------------- */

const STATUS_STYLE: Record<string, { color: string; glyph: string }> = {
  SUCCESS: { color: "var(--up)", glyph: "●" },
  PENDING: { color: "var(--hold)", glyph: "◐" },
  FAILED: { color: "var(--down)", glyph: "✕" },
};

export function StatusDot({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? { color: "var(--ink-faint)", glyph: "○" };
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]"
      style={{ color: style.color }}
    >
      <span aria-hidden className="text-[9px] leading-none">
        {style.glyph}
      </span>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * CategoryPill — a category as a tinted pill, for table rows.
 * ------------------------------------------------------------------------- */

export function CategoryPill({ label, hue }: { label: string; hue: number }) {
  const tint = categoryColor(hue);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2 py-0.5 text-[12px]"
      style={{
        color: tint,
        background: `color-mix(in oklab, ${tint} 11%, transparent)`,
      }}
    >
      <span aria-hidden className="size-1 rounded-full" style={{ background: tint }} />
      {label}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * Skeleton — sized at final dimensions so nothing reflows when data lands.
 * ------------------------------------------------------------------------- */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/* ---------------------------------------------------------------------------
 * EmptyState — says WHY it is empty, and offers the way out.
 * ------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  detail,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-[var(--canvas-sunk)] text-ink-faint">
        {icon}
      </div>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      <p className="max-w-[44ch] text-[13px] leading-relaxed text-ink-faint">{detail}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * ErrorState — renders the backend's own diagnosis.
 *
 * The API answers what/why/action for every failure, so the UI shows that
 * rather than inventing a generic apology. `why` sits behind a disclosure
 * because it is for whoever is debugging, not for someone paying a bill.
 * ------------------------------------------------------------------------- */

export function ErrorState({
  what,
  why,
  action,
  traceId,
  onRetry,
}: {
  what: string;
  why?: string;
  action?: string;
  traceId?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div
        className="grid size-12 place-items-center rounded-full"
        style={{
          background: "color-mix(in oklab, var(--down) 10%, transparent)",
          color: "var(--down)",
        }}
      >
        <AlertCircle size={20} aria-hidden />
      </div>

      <p className="text-[15px] font-medium text-ink">{what}</p>
      {action && <p className="max-w-[46ch] text-[13px] leading-relaxed text-ink-dim">{action}</p>}

      {onRetry && (
        <motion.button
          type="button"
          onClick={onRetry}
          whileTap={tap}
          transition={springControl}
          className="mt-1 h-11 min-h-11 rounded-[var(--r-control)] border border-[var(--line-strong)] bg-[var(--content)] px-4 text-[13px] text-ink shadow-[var(--shadow-rest)] transition-colors hover:bg-[var(--content-hover)]"
        >
          Retry
        </motion.button>
      )}

      {why && (
        <details className="mt-2 max-w-[54ch] text-left">
          <summary className="cursor-pointer list-none text-[12px] text-ink-faint underline-offset-4 hover:underline">
            Technical detail
          </summary>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{why}</p>
          {traceId && <p className="mt-2 font-mono text-[11px] text-ink-faint">trace {traceId}</p>}
        </details>
      )}
    </div>
  );
}
