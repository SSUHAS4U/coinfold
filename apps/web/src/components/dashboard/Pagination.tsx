"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { count } from "@/lib/format";

/**
 * Offset pagination with a jump-to-page window.
 *
 * Offset rather than keyset because the table exposes a total count and lets
 * the user jump to an arbitrary page, both of which keyset cannot do. At 10,000
 * rows the deepest possible OFFSET is 9,950, which Postgres serves from the
 * sort index in under a millisecond. At ten million rows this decision would
 * flip. See docs/DECISIONS.md.
 */

interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

/** A window of pages around the current one, with ellipses for the gaps. */
function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const items: (number | "gap")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(totalPages - 1, page + 1);

  if (from > 2) items.push("gap");
  for (let i = from; i <= to; i += 1) items.push(i);
  if (to < totalPages - 1) items.push("gap");

  items.push(totalPages);
  return items;
}

const stepClass =
  "grid size-11 min-h-11 place-items-center rounded-[var(--r-control)] border border-border " +
  "text-text-dim transition-colors duration-[var(--t-interaction)] " +
  "hover:border-border-strong hover:text-text " +
  "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-border " +
  "disabled:hover:text-text-dim";

export function Pagination({ page, totalPages, total, pageSize, onPage, onPageSize }: Props) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Transaction pages"
      className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-1 pt-4"
    >
      <p className="tnum text-[13px] text-text-faint">
        {total === 0 ? "No rows" : `${count(first)}–${count(last)} of ${count(total)}`}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={stepClass}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>

        {pageWindow(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <span
              key={`gap-${index}`}
              aria-hidden
              className="grid size-11 place-items-center text-text-faint"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPage(item)}
              aria-label={`Page ${item}`}
              aria-current={item === page ? "page" : undefined}
              className={[
                "tnum grid size-11 min-h-11 place-items-center rounded-[var(--r-control)]",
                "text-[13px] transition-colors duration-[var(--t-interaction)]",
                item === page
                  ? "border border-border-strong bg-surface-3 text-text"
                  : "border border-transparent text-text-dim hover:bg-surface-2 hover:text-text",
              ].join(" ")}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className={stepClass}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>

      <label className="flex items-center gap-2 text-[13px] text-text-faint">
        Rows
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
          aria-label="Rows per page"
          className="tnum h-11 min-h-11 rounded-[var(--r-control)] border border-border bg-surface-1 px-2 text-[13px] text-text transition-colors hover:border-border-strong focus:border-accent focus:outline-none"
        >
          {[25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}
