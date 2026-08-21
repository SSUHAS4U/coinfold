"use client";

import { useState } from "react";

import { useDashboardContext } from "@/components/app/DashboardContext";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Pagination } from "@/components/dashboard/Pagination";
import { TransactionDrawer } from "@/components/dashboard/TransactionDrawer";
import { TransactionTable } from "@/components/table/TransactionTable";
import { Panel } from "@/components/ui/Primitives";
import type { Transaction } from "@/lib/api";

/**
 * Transactions: the working screen.
 *
 * It gets the whole viewport, which is the point of splitting it out. The
 * table can show more rows before scrolling, and the filter panel has room to
 * open without shoving everything else down the page.
 */

export default function TransactionsPage() {
  const { query, dispatch, filtered, transactions, meta, facets } = useDashboardContext();
  const [openRow, setOpenRow] = useState<Transaction | null>(null);

  return (
    <>
      <Panel padded={false}>
        <div className="p-6 pb-0">
          <FilterBar
            query={query}
            facets={facets}
            matched={meta.total}
            onSearch={(search) => dispatch({ type: "set", patch: { search } })}
            onToggle={(key, value) => dispatch({ type: "toggle", key, value })}
            onSet={(patch) => dispatch({ type: "set", patch })}
            onReset={() => dispatch({ type: "reset" })}
          />
        </div>

        <div className="mt-5">
          <TransactionTable
            rows={transactions.data}
            loading={transactions.loading}
            error={
              transactions.error
                ? {
                    what: transactions.error.fault.what,
                    why: transactions.error.fault.why,
                    action: transactions.error.fault.action,
                    traceId: transactions.error.fault.trace_id,
                  }
                : null
            }
            sortBy={query.sortBy}
            direction={query.direction}
            onSort={(key) => dispatch({ type: "sort", key })}
            onOpen={setOpenRow}
            onClearFilters={() => dispatch({ type: "reset" })}
            filtered={filtered}
            pageSize={query.pageSize}
          />
        </div>

        <div className="px-6 pb-6">
          <Pagination
            page={query.page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={query.pageSize}
            onPage={(page) => dispatch({ type: "page", page })}
            onPageSize={(pageSize) => dispatch({ type: "set", patch: { pageSize } })}
          />
        </div>
      </Panel>

      <TransactionDrawer row={openRow} onClose={() => setOpenRow(null)} />
    </>
  );
}
