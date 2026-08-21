"use client";

import { Coins, Gift, History, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { useDashboardContext } from "@/components/app/DashboardContext";
import { RewardsPanel } from "@/components/rewards/RewardsPanel";
import { EmptyState, Panel, PanelHeading, Skeleton } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { count, longDateTime, money } from "@/lib/format";

/**
 * Rewards: the catalogue, and what has already been redeemed.
 *
 * Redemption history was missing entirely before — the API had served it since
 * the beginning and nothing displayed it, so a user could spend coins and have
 * no way to find the voucher code again.
 */

type Redemption = Awaited<ReturnType<typeof api.redemptions>>[number];

export default function RewardsPage() {
  const { balance, rewards, rewardsState, refresh, setBalanceOptimistically } =
    useDashboardContext();

  // `null` means "not loaded yet", which removes the need for a separate
  // loading flag set synchronously inside the effect.
  const [history, setHistory] = useState<Redemption[] | null>(null);
  const [nonce, setNonce] = useState(0);
  const historyLoading = history === null;

  const reverse = async (id: number) => {
    await api.reverseRedemption(id);
    setNonce((n) => n + 1);
    refresh();
  };

  useEffect(() => {
    let cancelled = false;
    api
      .redemptions()
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return (
    <div className="space-y-6">
      {/* Balance, given its own space rather than only living in the top bar. */}
      <Panel>
        <div className="flex flex-wrap items-end gap-x-12 gap-y-5">
          <div>
            <p className="text-[12px] tracking-[0.02em] text-text-faint">Coin balance</p>
            <p className="tnum mt-1.5 inline-flex items-center gap-2.5 text-[38px] font-semibold leading-none tracking-[-0.02em] text-text">
              <Coins size={26} aria-hidden style={{ color: "var(--accent)" }} />
              {rewardsState.loading && !balance ? "—" : count(balance?.balance ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-[12px] tracking-[0.02em] text-text-faint">Lifetime earned</p>
            <p className="tnum mt-1.5 text-[19px] font-medium text-text-dim">
              {count(balance?.lifetime_earned ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-[12px] tracking-[0.02em] text-text-faint">Lifetime spent</p>
            <p className="tnum mt-1.5 text-[19px] font-medium text-text-dim">
              {count(balance?.lifetime_spent ?? 0)}
            </p>
          </div>
          <p className="ml-auto max-w-[34ch] text-[12.5px] leading-relaxed text-text-faint">
            One coin for every ₹100 on a successful payment, capped at 100 per transaction.
            Refunds and failed payments earn nothing.
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeading title="Catalogue" hint="Six rewards. Better rates at higher tiers." />
        <RewardsPanel
          balance={balance}
          rewards={rewards}
          loading={rewardsState.loading}
          error={rewardsState.error}
          onBalanceChange={setBalanceOptimistically}
          onRedeemed={() => {
            refresh();
            setNonce((n) => n + 1);
          }}
          onRetry={refresh}
        />
      </Panel>

      <Panel>
        <PanelHeading
          title="Redemption history"
          hint="Every voucher you have claimed, newest first."
        />

        {historyLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-border py-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : history!.length === 0 ? (
          <EmptyState
            icon={<History size={18} aria-hidden />}
            title="Nothing redeemed yet"
            detail="Redeem a reward above and the voucher code will appear here, so you can find it again later."
          />
        ) : (
          <ul className="space-y-0">
            {history!.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-4 last:border-b-0"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-text-faint">
                  <Gift size={15} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-text">
                    {row.title} {row.status === "REVERSED" && "(reversed)"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-text-faint">
                    {longDateTime(row.created_at)} · worth {money(row.rupee_value)}
                  </p>
                </div>
                <code className="tnum rounded-[var(--r-control)] border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-[12.5px] tracking-[0.06em] text-text">
                  {row.voucher_code}
                </code>
                <span className="tnum shrink-0 text-[13px] text-text-dim">
                  {row.status === "REVERSED" ? "Returned" : `−${count(row.coin_cost)}`}
                </span>
                {row.status !== "REVERSED" && (
                  <button
                    type="button"
                    onClick={() => void reverse(row.id)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--r-control)] border border-border px-3 text-[12px] text-text-dim hover:border-border-strong hover:text-text"
                  >
                    <RotateCcw size={13} aria-hidden />
                    Reverse
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
