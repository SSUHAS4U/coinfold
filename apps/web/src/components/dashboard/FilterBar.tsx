"use client";

import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useId, useState } from "react";

import { Chip } from "@/components/ui/Primitives";
import type { Facets } from "@/lib/api";
import { METHOD_LABEL, STATUS_LABEL, count } from "@/lib/format";
import type { Query } from "@/hooks/useDashboard";

/**
 * Filters. Combinable, and every active one is visible as a removable chip, so
 * a user can never be looking at a filtered table without being able to see
 * why it is filtered — the most common way a dashboard confuses people.
 *
 * The advanced controls (dates, amounts) sit behind a disclosure. Search,
 * category and status carry most of the use and stay on the surface.
 */

interface Props {
  query: Query;
  facets: Facets | null;
  matched: number;
  onSearch: (value: string) => void;
  onToggle: (key: "categories" | "statuses" | "methods", value: string) => void;
  onSet: (patch: Partial<Query>) => void;
  onReset: () => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] tracking-[0.02em] text-text-faint">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-11 min-h-11 w-full rounded-[var(--r-control)] border border-border bg-surface-1 px-3 " +
  "text-[13px] text-text placeholder:text-text-faint transition-colors " +
  "duration-[var(--t-interaction)] hover:border-border-strong focus:border-accent " +
  "focus:outline-none";

export function FilterBar({
  query,
  facets,
  matched,
  onSearch,
  onToggle,
  onSet,
  onReset,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const searchId = useId();

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  for (const slug of query.categories) {
    const facet = facets?.categories.find((c) => c.slug === slug);
    activeChips.push({
      key: `cat-${slug}`,
      label: facet?.label ?? slug,
      clear: () => onToggle("categories", slug),
    });
  }
  for (const status of query.statuses) {
    activeChips.push({
      key: `st-${status}`,
      label: STATUS_LABEL[status] ?? status,
      clear: () => onToggle("statuses", status),
    });
  }
  for (const method of query.methods) {
    activeChips.push({
      key: `me-${method}`,
      label: METHOD_LABEL[method] ?? method,
      clear: () => onToggle("methods", method),
    });
  }
  if (query.dateFrom || query.dateTo) {
    activeChips.push({
      key: "dates",
      label: `${query.dateFrom || "start"} → ${query.dateTo || "today"}`,
      clear: () => onSet({ dateFrom: "", dateTo: "" }),
    });
  }
  if (query.amountMin || query.amountMax) {
    activeChips.push({
      key: "amounts",
      label: `₹${query.amountMin || "0"} – ₹${query.amountMax || "any"}`,
      clear: () => onSet({ amountMin: "", amountMax: "" }),
    });
  }
  if (!query.includeAnomalous) {
    activeChips.push({
      key: "anom",
      label: "Flagged rows hidden",
      clear: () => onSet({ includeAnomalous: true }),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-[260px]">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
          />
          <input
            id={searchId}
            type="search"
            value={query.search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search merchants"
            aria-label="Search merchants"
            className={`${inputClass} pl-9`}
          />
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
          className="inline-flex h-11 min-h-11 items-center gap-2 rounded-[var(--r-control)] border border-border px-3.5 text-[13px] text-text-dim transition-colors hover:border-border-strong hover:text-text"
        >
          <SlidersHorizontal size={14} aria-hidden />
          Filters
          <ChevronDown
            size={14}
            aria-hidden
            className="transition-transform duration-[var(--t-interaction)]"
            style={{ transform: advancedOpen ? "rotate(180deg)" : "none" }}
          />
        </button>

        <p className="tnum ml-auto shrink-0 text-[13px] text-text-faint">
          {count(matched)} {matched === 1 ? "transaction" : "transactions"}
        </p>
      </div>

      {/* Category chips — always visible; they carry the most use. */}
      {facets && facets.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {facets.categories.map((category) => (
            <Chip
              key={category.slug}
              label={category.label}
              hue={category.accent_hue}
              count={category.transactions}
              active={query.categories.includes(category.slug)}
              onClick={() => onToggle("categories", category.slug)}
            />
          ))}
        </div>
      )}

      {advancedOpen && (
        <div className="rise grid gap-4 rounded-[var(--r-card)] border border-border bg-surface-1 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Status">
            <div className="flex flex-wrap gap-2">
              {(facets?.statuses ?? []).map((status) => (
                <Chip
                  key={status}
                  label={STATUS_LABEL[status] ?? status}
                  active={query.statuses.includes(status)}
                  onClick={() => onToggle("statuses", status)}
                />
              ))}
            </div>
          </Field>

          <Field label="Payment method">
            <div className="flex flex-wrap gap-2">
              {(facets?.methods ?? []).map((method) => (
                <Chip
                  key={method}
                  label={METHOD_LABEL[method] ?? method}
                  active={query.methods.includes(method)}
                  onClick={() => onToggle("methods", method)}
                />
              ))}
            </div>
          </Field>

          <div className="space-y-3">
            <Field label="From date">
              <input
                type="date"
                value={query.dateFrom}
                min={facets?.date_min ?? undefined}
                max={query.dateTo || facets?.date_max || undefined}
                onChange={(event) => onSet({ dateFrom: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="To date">
              <input
                type="date"
                value={query.dateTo}
                min={query.dateFrom || facets?.date_min || undefined}
                max={facets?.date_max ?? undefined}
                onChange={(event) => onSet({ dateTo: event.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="space-y-3">
            <Field label="Min amount (₹)">
              <input
                type="number"
                inputMode="decimal"
                value={query.amountMin}
                placeholder="0"
                onChange={(event) => onSet({ amountMin: event.target.value })}
                className={`${inputClass} tnum`}
              />
            </Field>
            <Field label="Max amount (₹)">
              <input
                type="number"
                inputMode="decimal"
                value={query.amountMax}
                placeholder="any"
                onChange={(event) => onSet({ amountMax: event.target.value })}
                className={`${inputClass} tnum`}
              />
            </Field>

            <label className="flex cursor-pointer items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={!query.includeAnomalous}
                onChange={(event) => onSet({ includeAnomalous: !event.target.checked })}
                className="size-4 accent-[var(--accent)]"
              />
              <span className="text-[12px] text-text-dim">Hide rows flagged at import</span>
            </label>
          </div>
        </div>
      )}

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <Chip key={chip.key} label={chip.label} active onRemove={chip.clear} />
          ))}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 min-h-9 items-center gap-1.5 px-2 text-[13px] text-text-faint underline-offset-4 transition-colors hover:text-text hover:underline"
          >
            <X size={13} aria-hidden />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
