"use client";

import { Check, Coins, Copy, Gift, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Overlay } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/Primitives";
import { ApiError, api, type Balance, type Redemption, type Reward } from "@/lib/api";
import { count, money } from "@/lib/format";

/**
 * Redeem flow: select, confirm, done.
 *
 * The balance updates optimistically the moment the user confirms, and rolls
 * back to the exact previous value if the call fails. The rollback matters more
 * than the optimism: a balance left showing a number the server disagrees with
 * is worse than a spinner, because the user will act on it.
 *
 * Each attempt carries a fresh idempotency key, so a retry after a dropped
 * response returns the original redemption rather than charging twice.
 */

interface Props {
  balance: Balance | null;
  rewards: Reward[];
  loading: boolean;
  error?: ApiError | null;
  onBalanceChange: (balance: number) => void;
  onRedeemed: () => void;
  onRetry?: () => void;
}

type Stage = { kind: "idle" } | { kind: "confirm"; reward: Reward } | { kind: "done"; result: Redemption };

export function RewardsPanel({
  balance,
  rewards,
  loading,
  error,
  onBalanceChange,
  onRedeemed,
  onRetry,
}: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const confirm = useCallback(
    async (reward: Reward) => {
      if (!balance) return;

      const previous = balance.balance;
      setSubmitting(true);
      setFailure(null);

      // Optimistic: paint the new balance immediately.
      onBalanceChange(previous - reward.coin_cost);

      try {
        const result = await api.redeem(reward.id, crypto.randomUUID());
        // Trust the server's figure over the optimistic guess — they agree in
        // the normal case, and where they do not, the server is right.
        onBalanceChange(result.balance);
        setStage({ kind: "done", result });
        onRedeemed();
      } catch (cause) {
        // Roll back to the exact previous value, not a recomputation.
        onBalanceChange(previous);
        setFailure(cause instanceof ApiError ? cause : null);
      } finally {
        setSubmitting(false);
      }
    },
    [balance, onBalanceChange, onRedeemed],
  );

  if (error) {
    return (
      <ErrorState
        what={error.fault.what}
        why={error.fault.why}
        action={error.fault.action}
        traceId={error.fault.trace_id}
        onRetry={onRetry}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[var(--line)] py-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="h-9 w-24 rounded-[var(--r-control)]" />
          </div>
        ))}
      </div>
    );
  }

  if (rewards.length === 0) {
    return (
      <EmptyState
        icon={<Gift size={18} aria-hidden />}
        title="The catalogue is empty"
        detail="No rewards are currently active. New ones appear here as soon as they are published."
      />
    );
  }

  return (
    <>
      {/* Reward rows. Hairline dividers, no card per row (Wise / Groww). */}
      <ul className="space-y-0">
        {rewards.map((reward) => {
          const blocked = !reward.affordable || !reward.in_stock;
          return (
            <li
              key={reward.id}
              className="flex items-center gap-4 border-b border-[var(--line)] py-4 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[14px] font-medium text-ink">{reward.title}</p>
                  <span className="tnum shrink-0 text-[12px] text-ink-faint">
                    worth {money(reward.rupee_value)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[12px] text-ink-faint">{reward.description}</p>

                {/* The shortfall is stated in words, not implied by a disabled
                    button. A disabled control with no reason is a dead end. */}
                {!reward.affordable && (
                  <p className="tnum mt-1 text-[12px]" style={{ color: "var(--hold)" }}>
                    {count(reward.coins_short)} more coins needed
                  </p>
                )}
                {reward.in_stock && reward.stock !== null && reward.stock <= 20 && (
                  <p className="tnum mt-1 text-[12px] text-ink-faint">
                    only {reward.stock} left
                  </p>
                )}
                {!reward.in_stock && (
                  <p className="mt-1 text-[12px]" style={{ color: "var(--down)" }}>
                    Sold out
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="tnum inline-flex items-center gap-1.5 text-[13px] text-ink">
                  <Coins size={13} aria-hidden style={{ color: "var(--accent)" }} />
                  {count(reward.coin_cost)}
                </span>
                <Button
                  variant={blocked ? "secondary" : "primary"}
                  size="sm"
                  disabled={blocked}
                  icon={blocked ? <Lock size={13} /> : undefined}
                  onClick={() => setStage({ kind: "confirm", reward })}
                >
                  Redeem
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Step 2 — confirm */}
      <Overlay
        open={stage.kind === "confirm"}
        onClose={() => {
          if (!submitting) {
            setStage({ kind: "idle" });
            setFailure(null);
          }
        }}
        title="Confirm redemption"
        description={
          stage.kind === "confirm"
            ? `${stage.reward.title} — worth ${money(stage.reward.rupee_value)}`
            : undefined
        }
        footer={
          stage.kind === "confirm" && (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setStage({ kind: "idle" });
                  setFailure(null);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button variant="primary" loading={submitting} onClick={() => confirm(stage.reward)}>
                {submitting ? "Redeeming" : "Confirm"}
              </Button>
            </>
          )
        }
      >
        {stage.kind === "confirm" && balance && (
          <div className="space-y-4">
            <dl className="space-y-0">
              {[
                ["Current balance", count(balance.balance)],
                ["Cost", `− ${count(stage.reward.coin_cost)}`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between border-b border-[var(--line)] py-2.5"
                >
                  <dt className="text-[13px] text-ink-dim">{label}</dt>
                  <dd className="tnum text-[13px] text-ink">{value}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between py-3">
                <dt className="text-[13px] font-medium text-ink">Balance after</dt>
                <dd className="tnum text-[15px] font-semibold text-ink">
                  {count(balance.balance - stage.reward.coin_cost)}
                </dd>
              </div>
            </dl>

            {failure && (
              <div
                className="rounded-[var(--r-control)] border px-3 py-2.5"
                style={{
                  borderColor: "color-mix(in oklab, var(--down) 35%, transparent)",
                  background: "color-mix(in oklab, var(--down) 8%, transparent)",
                }}
              >
                <p className="text-[13px] font-medium" style={{ color: "var(--down)" }}>
                  {failure.fault.what}
                </p>
                <p className="mt-1 text-[12px] text-ink-dim">{failure.fault.action}</p>
                <p className="mt-1.5 text-[12px] text-ink-faint">
                  Your balance was not changed.
                </p>
              </div>
            )}
          </div>
        )}
      </Overlay>

      {/* Step 3 — done */}
      <Overlay
        open={stage.kind === "done"}
        onClose={() => setStage({ kind: "idle" })}
        title="Redeemed"
        description={stage.kind === "done" ? stage.result.title : undefined}
        footer={
          <Button variant="primary" onClick={() => setStage({ kind: "idle" })}>
            Done
          </Button>
        }
      >
        {stage.kind === "done" && (
          <div className="space-y-4">
            <div
              className="flex items-center gap-3 rounded-[var(--r-control)] px-3 py-3"
              style={{ background: "var(--accent-soft)" }}
            >
              <Check size={17} aria-hidden style={{ color: "var(--accent)" }} />
              <p className="text-[13px] text-ink">
                {money(stage.result.rupee_value)} reward is yours.{" "}
                {stage.result.replayed && "(This retry returned your original redemption.)"}
              </p>
            </div>

            <div>
              <p className="text-[12px] tracking-[0.02em] text-ink-faint">Voucher code</p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="tnum flex-1 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--content-hover)] px-3 py-2.5 font-mono text-[14px] tracking-[0.08em] text-ink">
                  {stage.result.voucher_code}
                </code>
                <Button
                  variant="secondary"
                  size="md"
                  icon={copied ? <Check size={14} /> : <Copy size={14} />}
                  onClick={() => {
                    navigator.clipboard?.writeText(stage.result.voucher_code);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <p className="tnum text-[13px] text-ink-dim">
              New balance: <span className="text-ink">{count(stage.result.balance)}</span> coins
            </p>
          </div>
        )}
      </Overlay>
    </>
  );
}
