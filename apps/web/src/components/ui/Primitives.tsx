"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { categoryColor, STATUS_LABEL } from "@/lib/format";

/* ---------------------------------------------------------------------------
 * Panel — the only boxed container in the app.
 *
 * Per the Linear/SpaceX notes, a border appears where two *kinds* of thing
 * meet, never around every block. `framed` marks the single element per screen
 * allowed to read as instrumentation.
 * ------------------------------------------------------------------------- */

export function Panel({
  children,
  className = "",
  framed,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  framed?: boolean;
  padded?: boolean;
}) {
  return (
    <section
      className={[
        "rounded-[var(--r-card)] bg-surface-1",
        framed ? "border border-border-strong shadow-[var(--shadow-2)]" : "border border-border",
        "shadow-[var(--highlight)]",
        padded ? "p-6" : "",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

export function PanelHeading({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-text">{title}</h2>
        {hint && <p className="mt-1 text-[13px] text-text-faint">{hint}</p>}
      </div>
      {action}
    </header>
  );
}

/* ---------------------------------------------------------------------------
 * Chip — a filter token. Removable ones carry an X; toggles do not.
 * ------------------------------------------------------------------------- */

export function Chip({
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
  const tint = hue !== undefined ? categoryColor(hue) : "var(--accent)";

  return (
    <span
      className={[
        "group inline-flex h-9 min-h-9 items-center gap-2 rounded-[var(--r-pill)] border pl-3",
        onRemove ? "pr-1.5" : "pr-3",
        "text-[13px] transition-colors duration-[var(--t-interaction)] ease-[var(--ease)]",
        active
          ? "border-border-strong bg-surface-3 text-text"
          : "border-border bg-surface-1 text-text-dim hover:border-border-strong hover:text-text",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 outline-none"
        aria-pressed={onClick ? Boolean(active) : undefined}
      >
        {hue !== undefined && (
          // A 6px dot, not a coloured background: colour identifies the
          // category without colouring the whole control.
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: tint }}
          />
        )}
        <span className="truncate">{label}</span>
        {count !== undefined && (
          <span className="tnum text-text-faint">{count.toLocaleString("en-IN")}</span>
        )}
      </button>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} filter`}
          className="grid size-6 place-items-center rounded-full text-text-faint transition-colors hover:bg-surface-3 hover:text-text"
        >
          <X size={13} aria-hidden />
        </button>
      )}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * StatusPill
 *
 * Colour is never the only carrier: each status also has a distinct word and a
 * distinct glyph shape, so it survives a colour-blind reader and a greyscale
 * print alike.
 * ------------------------------------------------------------------------- */

const STATUS_STYLE: Record<string, { color: string; glyph: string }> = {
  SUCCESS: { color: "var(--success)", glyph: "●" },
  PENDING: { color: "var(--warning)", glyph: "◐" },
  FAILED: { color: "var(--danger)", glyph: "✕" },
};

export function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? { color: "var(--text-faint)", glyph: "○" };

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]"
      style={{ color: style.color }}
    >
      <span aria-hidden className="text-[10px] leading-none">
        {style.glyph}
      </span>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * Skeleton — sized at the final dimensions so nothing reflows when data lands.
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
      <div className="grid size-11 place-items-center rounded-full border border-border text-text-faint">
        {icon}
      </div>
      <p className="text-[15px] font-medium text-text">{title}</p>
      <p className="max-w-[42ch] text-[13px] leading-relaxed text-text-faint">{detail}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * ErrorState — renders the backend's own diagnosis.
 *
 * The API already answers what/why/action for every failure, so the UI shows
 * that rather than inventing a generic apology. `why` sits behind a disclosure
 * because it is for whoever is debugging, not for the person paying a bill.
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
        className="grid size-11 place-items-center rounded-full border"
        style={{
          borderColor: "color-mix(in oklab, var(--danger) 35%, transparent)",
          color: "var(--danger)",
        }}
      >
        <X size={18} aria-hidden />
      </div>

      <p className="text-[15px] font-medium text-text">{what}</p>
      {action && <p className="max-w-[46ch] text-[13px] leading-relaxed text-text-dim">{action}</p>}

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 h-9 min-h-9 rounded-[var(--r-control)] border border-border px-4 text-[13px] text-text transition-colors hover:border-border-strong hover:bg-surface-2"
        >
          Retry
        </button>
      )}

      {why && (
        <details className="mt-2 max-w-[52ch] text-left">
          <summary className="cursor-pointer list-none text-[12px] text-text-faint underline-offset-4 hover:underline">
            Technical detail
          </summary>
          <p className="mt-2 text-[12px] leading-relaxed text-text-faint">{why}</p>
          {traceId && (
            <p className="mt-2 font-mono text-[11px] text-text-faint">trace {traceId}</p>
          )}
        </details>
      )}
    </div>
  );
}
