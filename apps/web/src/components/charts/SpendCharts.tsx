"use client";

import { ChartPie, LineChart as LineIcon } from "lucide-react";
import { memo, useMemo } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState, Skeleton } from "@/components/ui/Primitives";
import type { CategorySpend, MonthlyPoint } from "@/lib/api";
import { categoryColor, money, moneyCompact, monthLabel } from "@/lib/format";

/**
 * Both charts are click-to-filter, and both are driven by the same filter state
 * as the table. That is what makes the cross-filtering two-way: the table's
 * filters reshape the charts, and a click on a chart adds a filter the table
 * then honours.
 *
 * Colour comes from `accent_hue` on each row, so a category is the same colour
 * in the ring, the trend, the filter chip and the table dot.
 */

function ChartTooltip({
  active,
  payload,
  labelFormatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; payload?: Record<string, unknown> }[];
  labelFormatter?: (entry: Record<string, unknown>) => string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const datum = (entry.payload ?? {}) as Record<string, unknown>;

  return (
    <div className="rounded-[var(--r-control)] border border-border-strong bg-surface-2 px-3 py-2 shadow-[var(--shadow-2)]">
      <p className="text-[12px] text-text-dim">
        {labelFormatter ? labelFormatter(datum) : (entry.name ?? "")}
      </p>
      <p className="tnum mt-0.5 text-[14px] font-medium text-text">{money(entry.value ?? 0)}</p>
      {typeof datum.transactions === "number" && (
        <p className="tnum mt-0.5 text-[12px] text-text-faint">
          {datum.transactions.toLocaleString("en-IN")} transactions
        </p>
      )}
    </div>
  );
}

export const CategoryDonut = memo(function CategoryDonut({
  data,
  loading,
  selected,
  onSelect,
}: {
  data: CategorySpend[];
  loading: boolean;
  selected: string[];
  onSelect: (slug: string) => void;
}) {
  const total = useMemo(
    () => data.reduce((sum, d) => sum + Number(d.total), 0),
    [data],
  );

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center gap-8">
        <Skeleton className="size-[180px] rounded-full" />
        <div className="hidden space-y-3 sm:block">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-32" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<ChartPie size={18} aria-hidden />}
        title="Nothing to chart"
        detail="Spend is counted from successful, positive payments only. The current filters leave none, so there is no breakdown to draw."
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row">
      <div className="relative size-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey={(d: CategorySpend) => Number(d.total)}
              nameKey="category_label"
              innerRadius={72}
              outerRadius={104}
              paddingAngle={2}
              stroke="none"
              // Motion carries data here: the ring draws in once on mount and
              // does not re-animate on filter change, so a change reads as a
              // change rather than a restart.
              isAnimationActive={false}
              onClick={(entry) => {
                const slug = (entry as unknown as CategorySpend)?.category_slug;
                if (slug) onSelect(slug);
              }}
            >
              {data.map((d) => {
                const dimmed = selected.length > 0 && !selected.includes(d.category_slug);
                return (
                  <Cell
                    key={d.category_slug}
                    fill={categoryColor(d.accent_hue)}
                    opacity={dimmed ? 0.22 : 1}
                    className="cursor-pointer transition-opacity duration-[var(--t-state)]"
                  />
                );
              })}
            </Pie>
            <Tooltip
              content={<ChartTooltip labelFormatter={(d) => String(d.category_label ?? "")} />}
              cursor={false}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* The hole is not empty: it carries the total the ring adds up to. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] tracking-[0.02em] text-text-faint">Total spend</p>
            <p className="tnum mt-1 text-[19px] font-semibold tracking-[-0.01em] text-text">
              {moneyCompact(total)}
            </p>
          </div>
        </div>
      </div>

      {/* Legend rows: name left, value right, share beneath. No card per row. */}
      <ul className="w-full min-w-0 space-y-0">
        {data.map((d) => {
          const share = total > 0 ? (Number(d.total) / total) * 100 : 0;
          const isSelected = selected.includes(d.category_slug);
          return (
            <li key={d.category_slug}>
              <button
                type="button"
                onClick={() => onSelect(d.category_slug)}
                aria-pressed={isSelected}
                className={[
                  "flex w-full items-center gap-3 border-b border-border py-2.5 text-left",
                  "transition-colors duration-[var(--t-interaction)]",
                  isSelected ? "text-text" : "text-text-dim hover:text-text",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: categoryColor(d.accent_hue) }}
                />
                <span className="min-w-0 flex-1 truncate text-[13px]">{d.category_label}</span>
                <span className="tnum shrink-0 text-[13px] text-text">
                  {moneyCompact(d.total)}
                </span>
                <span className="tnum w-11 shrink-0 text-right text-[12px] text-text-faint">
                  {share.toFixed(1)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

export const MonthlyTrend = memo(function MonthlyTrend({
  data,
  loading,
  onSelectMonth,
  selectedMonth,
}: {
  data: MonthlyPoint[];
  loading: boolean;
  onSelectMonth: (month: string) => void;
  selectedMonth?: string;
}) {
  if (loading) return <Skeleton className="h-[260px] w-full" />;

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<LineIcon size={18} aria-hidden />}
        title="No months to plot"
        detail="The current filters match no successful payments, so the trend has nothing to draw."
      />
    );
  }

  const points = data.map((d) => ({ ...d, value: Number(d.total) }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
          // Recharts 3 removed CategoricalChartState from mouse handlers; the
          // handler now receives `activeLabel`, which here IS the month because
          // `month` is the XAxis dataKey.
          onClick={(state) => {
            const month = state?.activeLabel;
            if (typeof month === "string" && month) onSelectMonth(month);
          }}
        >
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="month"
            tickFormatter={monthLabel}
            tick={{ fill: "var(--text-faint)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v) => moneyCompact(v as number)}
            tick={{ fill: "var(--text-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            content={<ChartTooltip labelFormatter={(d) => monthLabel(String(d.month ?? ""))} />}
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#trend-fill)"
            // A dot on every one of 14 points is noise; the active dot on hover
            // is the affordance that matters.
            dot={false}
            activeDot={{
              r: 4,
              fill: "var(--accent)",
              stroke: "var(--bg)",
              strokeWidth: 2,
              className: "cursor-pointer",
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {selectedMonth && (
        <p className="mt-2 text-[12px] text-text-faint">
          Filtered to {monthLabel(selectedMonth)}. Click the month again to clear.
        </p>
      )}
    </div>
  );
});
