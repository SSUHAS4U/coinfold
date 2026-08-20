"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Coins, Inbox, Search } from "lucide-react";
import { memo, useCallback, type KeyboardEvent } from "react";

import { EmptyState, ErrorState, Skeleton, StatusPill } from "@/components/ui/Primitives";
import type { Transaction } from "@/lib/api";
import { categoryColor, METHOD_LABEL, money, shortDate, timeOf } from "@/lib/format";

/**
 * The transaction table. Hand-built, no component library — the brief forbids
 * one here and this is where the CSS is being read.
 *
 * Structure decisions:
 *
 *  - A real <table> with <thead>/<tbody>/<th scope>. A grid of divs would look
 *    identical and be unusable with a screen reader.
 *  - The header is sticky inside the table's OWN scroll container, so the page
 *    never scrolls sideways — asserted by the render tests at 360px.
 *  - 64px rows, one hairline per row, no zebra striping (Groww).
 *  - Two-line cells: merchant over category, amount over coins. Halves the
 *    column count for the same information, which is what lets the layout
 *    survive a 360px viewport.
 *  - Columns drop progressively as width shrinks rather than the table
 *    scrolling horizontally on a phone: date, method and status fold into the
 *    two cells that remain.
 *
 * Rows are keyboard-operable: each is focusable and opens on Enter or Space.
 */

export type SortKey = "date" | "amount";
export type SortDirection = "asc" | "desc";

interface Props {
  rows: Transaction[];
  loading: boolean;
  error?: { what: string; why?: string; action?: string; traceId?: string } | null;
  sortBy: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  onOpen: (row: Transaction) => void;
  onRetry?: () => void;
  onClearFilters?: () => void;
  /** True when filters are active, so the empty state can say which kind of empty. */
  filtered: boolean;
  pageSize: number;
}

function SortHeader({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group inline-flex h-11 min-h-11 items-center gap-1.5 text-[12px] tracking-[0.02em]",
        "transition-colors duration-[var(--t-interaction)]",
        active ? "text-text" : "text-text-faint hover:text-text-dim",
        align === "right" ? "flex-row-reverse" : "",
      ].join(" ")}
    >
      {label}
      <span
        aria-hidden
        className={[
          "transition-opacity duration-[var(--t-interaction)]",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-45",
        ].join(" ")}
      >
        {active && direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      </span>
    </button>
  );
}

/**
 * One row. Memoised because a page of 50 re-rendering on every keystroke in the
 * search box is the difference between a table that feels instant and one that
 * stutters.
 */
const Row = memo(function Row({
  row,
  onOpen,
}: {
  row: Transaction;
  onOpen: (row: Transaction) => void;
}) {
  const amount = Number(row.amount);
  const isRefund = amount < 0;

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen(row);
      }
    },
    [onOpen, row],
  );

  return (
    <tr
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={onKeyDown}
      aria-label={`${row.merchant}, ${money(row.amount)}, ${shortDate(row.occurred_at)}`}
      className={[
        "group h-[var(--row-h)] cursor-pointer border-b border-border",
        "transition-colors duration-[var(--t-interaction)] ease-[var(--ease)]",
        "hover:bg-surface-2 focus-visible:bg-surface-2",
        // The focus ring is drawn inset so it is not clipped by the scroll
        // container at the first and last row.
        "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
      ].join(" ")}
    >
      {/* Date — folds away below md; the time moves under the merchant. */}
      <td className="hidden whitespace-nowrap px-4 md:table-cell">
        <div className="tnum text-[13px] text-text">{shortDate(row.occurred_at)}</div>
        <div className="tnum mt-0.5 text-[12px] text-text-faint">{timeOf(row.occurred_at)}</div>
      </td>

      {/* Merchant + category. The primary cell, and the last one to give ground. */}
      <td className="px-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: categoryColor(row.accent_hue) }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[14px] font-medium text-text">{row.merchant}</span>
              {row.is_anomalous && (
                <AlertTriangle
                  size={13}
                  className="shrink-0 text-warning"
                  aria-label="Flagged during import"
                />
              )}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-text-faint">
              {row.category_label}
              <span className="md:hidden"> · {shortDate(row.occurred_at)}</span>
            </div>
          </div>
        </div>
      </td>

      {/* Method — the first column to go. */}
      <td className="hidden whitespace-nowrap px-4 text-[13px] text-text-dim lg:table-cell">
        {METHOD_LABEL[row.method] ?? row.method}
      </td>

      {/* Status — folds under the amount on phones. */}
      <td className="hidden whitespace-nowrap px-4 sm:table-cell">
        <StatusPill status={row.status} />
      </td>

      {/* Amount + coins. Right-aligned, tabular, and the only place a figure
          carries colour: refunds read as credits, so they get the success hue
          plus an explicit "refund" word rather than colour alone. */}
      <td className="px-4 text-right">
        <div
          className="tnum whitespace-nowrap text-[14px] font-medium"
          style={{ color: isRefund ? "var(--success)" : "var(--text)" }}
        >
          {money(row.amount)}
        </div>
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[12px] text-text-faint">
          <span className="sm:hidden">
            <StatusPill status={row.status} />
          </span>
          {isRefund ? (
            <span className="hidden sm:inline">refund</span>
          ) : row.coins_earned > 0 ? (
            <>
              <Coins size={11} aria-hidden style={{ color: "var(--accent)" }} />
              <span className="tnum">{row.coins_earned}</span>
            </>
          ) : (
            <span className="hidden sm:inline">—</span>
          )}
        </div>
      </td>
    </tr>
  );
});

export function TransactionTable({
  rows,
  loading,
  error,
  sortBy,
  direction,
  onSort,
  onOpen,
  onRetry,
  onClearFilters,
  filtered,
  pageSize,
}: Props) {
  if (error) {
    return (
      <ErrorState
        what={error.what}
        why={error.why}
        action={error.action}
        traceId={error.traceId}
        onRetry={onRetry}
      />
    );
  }

  // Skeletons are laid out at the real row height so the table does not
  // reflow — and the same number as the page size, so the scroll container
  // does not resize when data lands.
  if (loading && rows.length === 0) {
    return (
      <div className="px-4 py-2" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading transactions</span>
        {Array.from({ length: Math.min(pageSize, 12) }).map((_, i) => (
          <div key={i} className="flex h-[var(--row-h)] items-center gap-3 border-b border-border">
            <Skeleton className="size-1.5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-3.5 w-24" />
              <Skeleton className="ml-auto h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return filtered ? (
      <EmptyState
        icon={<Search size={18} aria-hidden />}
        title="No transactions match these filters"
        detail="Every filter is combined with AND, so narrow ranges can exclude everything. Widen a range or clear one filter to bring rows back."
        action={
          onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="h-9 min-h-9 rounded-[var(--r-control)] border border-border px-4 text-[13px] text-text transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              Clear all filters
            </button>
          )
        }
      />
    ) : (
      <EmptyState
        icon={<Inbox size={18} aria-hidden />}
        title="No transactions yet"
        detail="Once payments are made they appear here, newest first, with the coins each one earned."
      />
    );
  }

  return (
    <div
      className="scroll-area relative max-h-[calc(100vh-260px)] min-h-[280px] overflow-y-auto overflow-x-hidden"
      // aria-busy marks the stale-while-refetching state: rows stay on screen
      // and dim slightly rather than being replaced by skeletons, so the user
      // never loses their place while typing in the search box.
      aria-busy={loading || undefined}
    >
      <table
        className={[
          "w-full border-collapse text-left transition-opacity duration-[var(--t-state)]",
          loading ? "opacity-55" : "opacity-100",
        ].join(" ")}
      >
        <thead className="sticky top-0 z-10 bg-bg">
          <tr className="border-b border-border">
            {/* aria-sort is what tells a screen reader the table is sorted and
                which way. Without it the arrow glyph is visual-only. */}
            <th
              scope="col"
              className="hidden px-4 md:table-cell"
              aria-sort={
                sortBy === "date" ? (direction === "asc" ? "ascending" : "descending") : "none"
              }
            >
              <SortHeader
                label="Date"
                active={sortBy === "date"}
                direction={direction}
                onClick={() => onSort("date")}
              />
            </th>
            <th
              scope="col"
              className="px-4 text-[12px] font-normal tracking-[0.02em] text-text-faint"
            >
              Merchant
            </th>
            <th
              scope="col"
              className="hidden px-4 text-[12px] font-normal tracking-[0.02em] text-text-faint lg:table-cell"
            >
              Method
            </th>
            <th
              scope="col"
              className="hidden px-4 text-[12px] font-normal tracking-[0.02em] text-text-faint sm:table-cell"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-4 text-right"
              aria-sort={
                sortBy === "amount" ? (direction === "asc" ? "ascending" : "descending") : "none"
              }
            >
              <SortHeader
                label="Amount"
                active={sortBy === "amount"}
                direction={direction}
                onClick={() => onSort("amount")}
                align="right"
              />
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <Row key={row.id} row={row} onOpen={onOpen} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
