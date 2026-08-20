/**
 * Formatting. One place, so a rupee figure looks identical everywhere.
 *
 * Indian digit grouping is 2,2,3 (₹12,84,302), not the 3,3,3 that a default
 * `toLocaleString()` would produce. `en-IN` handles it; hand-rolling it is how
 * an Indian fintech app ends up quietly displaying Western grouping.
 */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const plain = new Intl.NumberFormat("en-IN");

/** An unknown value renders as an em dash. A zero is a claim; a dash is not. */
export const EMPTY = "—";

export function money(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? inr.format(n) : EMPTY;
}

/** For axis ticks and tight spaces: ₹12.8L rather than ₹12,84,302.55. */
export function moneyCompact(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? inrCompact.format(n) : EMPTY;
}

export function count(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? EMPTY
    : plain.format(value);
}

/**
 * Dates render in IST regardless of where the browser is.
 *
 * The feed's naive timestamps were anchored to IST at ingest, so displaying
 * them in the viewer's local zone would shift them back off the day they
 * belong to — a transaction made at 00:30 IST would show as the previous
 * evening for a European reviewer.
 */
const IST = "Asia/Kolkata";

const dateShort = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: IST,
});

const dateTimeLong = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: IST,
});

const timeOnly = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: IST,
});

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? EMPTY : dateShort.format(d);
}

export function timeOf(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? EMPTY : timeOnly.format(d);
}

export function longDateTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? EMPTY : dateTimeLong.format(d);
}

/** "2026-03" -> "Mar 2026", for the monthly trend axis. */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/**
 * A category's colour, derived from the hue the database assigns it.
 *
 * Deriving rather than hardcoding is what guarantees a category is the same
 * colour in the pie, the trend, the filter chip and the table row — the thing
 * that makes cross-filtering legible.
 */
export function categoryColor(hue: number, opts?: { muted?: boolean }): string {
  const l = opts?.muted ? "38%" : "var(--cat-l)";
  const c = opts?.muted ? "0.06" : "var(--cat-c)";
  return `oklch(${l} ${c} ${hue})`;
}

export const STATUS_LABEL: Record<string, string> = {
  SUCCESS: "Paid",
  PENDING: "Pending",
  FAILED: "Failed",
};

export const METHOD_LABEL: Record<string, string> = {
  CREDIT_CARD: "Credit card",
  DEBIT_CARD: "Debit card",
  UPI: "UPI",
  NETBANKING: "Netbanking",
};
