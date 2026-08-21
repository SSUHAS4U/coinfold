"use client";

import { StatRow } from "@/components/app/StatRow";
import { useDashboardContext } from "@/components/app/DashboardContext";
import { CategoryDonut, MonthlyTrend } from "@/components/charts/SpendCharts";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Panel, PanelHeading } from "@/components/ui/Primitives";

/**
 * Analytics: both charts, full width, under the same filters as everything else.
 *
 * The filter bar is repeated here rather than being left behind on the
 * Transactions screen. A chart you cannot narrow is a poster, and a user who
 * filtered on another screen needs to see what is currently applied.
 */

export default function AnalyticsPage() {
  const { query, dispatch, summary, byCategory, monthly, facets, meta } = useDashboardContext();

  const selectedMonth =
    query.dateFrom && query.dateTo && query.dateFrom.slice(0, 7) === query.dateTo.slice(0, 7)
      ? query.dateFrom.slice(0, 7)
      : undefined;

  /** A trend click sets the date window to that whole month, or clears it. */
  const onMonthSelect = (month: string) => {
    const [year, m] = month.split("-").map(Number);
    const from = `${month}-01`;
    const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
    const to = `${month}-${String(last).padStart(2, "0")}`;
    dispatch(
      query.dateFrom === from && query.dateTo === to
        ? { type: "set", patch: { dateFrom: "", dateTo: "" } }
        : { type: "set", patch: { dateFrom: from, dateTo: to } },
    );
  };

  return (
    <div className="space-y-6">
      <Panel>
        <FilterBar
          query={query}
          facets={facets}
          matched={meta.total}
          onSearch={(search) => dispatch({ type: "set", patch: { search } })}
          onToggle={(key, value) => dispatch({ type: "toggle", key, value })}
          onSet={(patch) => dispatch({ type: "set", patch })}
          onReset={() => dispatch({ type: "reset" })}
        />
      </Panel>

      <Panel>
        <StatRow
          spend={summary.data?.total_spend ?? "0"}
          refunded={summary.data?.total_refunded ?? "0"}
          matched={summary.data?.matched ?? 0}
          failed={summary.data?.failed ?? 0}
          pending={summary.data?.pending ?? 0}
          coins={summary.data?.coins_earned ?? 0}
          loading={summary.loading && !summary.data}
        />
      </Panel>

      <Panel>
        <PanelHeading
          title="Month by month"
          hint="Click a month to filter every screen to it. Empty months are drawn as zero, not skipped."
        />
        <MonthlyTrend
          data={monthly.data}
          loading={monthly.loading && monthly.data.length === 0}
          onSelectMonth={onMonthSelect}
          selectedMonth={selectedMonth}
        />
      </Panel>

      <Panel>
        <PanelHeading
          title="Where it went"
          hint="Successful, positive payments only — a failed payment moved no money, and a refund is not spending."
        />
        <CategoryDonut
          data={byCategory.data}
          loading={byCategory.loading && byCategory.data.length === 0}
          selected={query.categories}
          onSelect={(slug) => dispatch({ type: "toggle", key: "categories", value: slug })}
        />
      </Panel>
    </div>
  );
}
