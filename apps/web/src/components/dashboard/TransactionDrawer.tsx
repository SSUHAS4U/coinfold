"use client";

import { Coins, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import { Overlay } from "@/components/ui/Overlay";
import { ErrorState, Skeleton, StatusDot } from "@/components/ui/Primitives";
import { ApiError, api, type Transaction, type TransactionDetail } from "@/lib/api";
import { METHOD_LABEL, categoryColor, longDateTime, money } from "@/lib/format";

/**
 * Row detail, in a drawer.
 *
 * A drawer rather than a modal because the table stays visible behind it: the
 * user is scanning a list, and losing their place to read one row is a worse
 * trade than the narrower column.
 *
 * The drawer opens instantly using the row already in hand, then fills in the
 * fields only the detail endpoint knows. Waiting on a request before showing
 * anything would make every row click feel slow for no reason.
 */

function Line({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-3">
      <dt className="shrink-0 text-[13px] text-ink-faint">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] text-ink">{children}</dd>
    </div>
  );
}

export function TransactionDrawer({
  row,
  onClose,
}: {
  row: Transaction | null;
  onClose: () => void;
}) {
  // Detail and error both carry the row they belong to, so "is this loading"
  // and "is this stale" are DERIVED rather than stored. That removes the
  // synchronous setState-in-effect the previous version needed to reset them,
  // and makes it impossible to render one row's repairs under another's name.
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [error, setError] = useState<{ forId: number; error: ApiError } | null>(null);

  const fresh = row !== null && detail?.id === row.id ? detail : null;
  const freshError = row !== null && error?.forId === row.id ? error.error : null;
  const loading = row !== null && fresh === null && freshError === null;

  useEffect(() => {
    if (!row) return;

    let cancelled = false;
    const id = row.id;

    api
      .transaction(id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((cause) => {
        if (!cancelled && cause instanceof ApiError) setError({ forId: id, error: cause });
      });

    return () => {
      cancelled = true;
    };
  }, [row]);

  if (!row) return null;

  const amount = Number(row.amount);
  const isRefund = amount < 0;

  return (
    <Overlay
      open
      onClose={onClose}
      placement="right"
      title={row.merchant}
      description={longDateTime(row.occurred_at)}
    >
      {freshError ? (
        <ErrorState
          what={freshError.fault.what}
          why={freshError.fault.why}
          action={freshError.fault.action}
          traceId={freshError.fault.trace_id}
        />
      ) : (
        <div className="space-y-6">
          {/* The amount, given the room to be the thing you look at first.
              Semibold sans at 34px, not mono — mono is for aligned columns
              (Groww decision 13). */}
          <div>
            <p className="text-[12px] tracking-[0.02em] text-ink-faint">
              {isRefund ? "Refunded to you" : "Amount paid"}
            </p>
            <p
              className="tnum mt-1 text-[34px] font-semibold leading-[1.15] tracking-[-0.02em]"
              style={{ color: isRefund ? "var(--up)" : "var(--ink)" }}
            >
              {money(row.amount)}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <StatusDot status={row.status} />
              {row.coins_earned > 0 && (
                <span className="tnum inline-flex items-center gap-1.5 text-[13px] text-ink-dim">
                  <Coins size={13} aria-hidden style={{ color: "var(--accent)" }} />
                  {row.coins_earned} coins earned
                </span>
              )}
            </div>
          </div>

          <dl>
            <Line label="Merchant">{row.merchant}</Line>
            <Line label="Category">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ background: categoryColor(row.accent_hue) }}
                />
                {row.category_label}
              </span>
            </Line>
            <Line label="Paid with">{METHOD_LABEL[row.method] ?? row.method}</Line>
            <Line label="When">{longDateTime(row.occurred_at)}</Line>
            <Line label="Reference">
              <code className="font-mono text-[12px] text-ink-dim">{row.source_id}</code>
            </Line>
            {fresh && (
              <Line label="Source row">
                <code className="tnum font-mono text-[12px] text-ink-dim">
                  #{fresh.source_row_index}
                </code>
              </Line>
            )}
          </dl>

          {/* Ingest provenance. This is the fault-capture record surfaced to the
              user: if the loader repaired this row, it says exactly what the
              original value was and what rule was applied. Nothing was changed
              silently. */}
          <div>
            <h3 className="flex items-center gap-2 text-[13px] font-medium text-ink">
              <Wrench size={13} aria-hidden className="text-ink-faint" />
              Import history
            </h3>

            {loading ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : fresh && fresh.anomalies.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {fresh.anomalies.map((anomaly, index) => (
                  <li
                    key={`${anomaly.kind}-${index}`}
                    className="rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--content-hover)] px-3 py-2.5"
                  >
                    <p className="font-mono text-[11px] tracking-[0.02em] text-[var(--hold)]">
                      {anomaly.kind}
                    </p>
                    {anomaly.original_value && (
                      <p className="mt-1 break-all font-mono text-[12px] text-ink-dim">
                        was: {anomaly.original_value}
                      </p>
                    )}
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
                      {anomaly.resolution}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                This row loaded exactly as supplied. No values were changed.
              </p>
            )}
          </div>
        </div>
      )}
    </Overlay>
  );
}
