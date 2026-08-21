"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AppShell } from "@/components/app/AppShell";
import { DashboardProvider, useDashboardContext } from "@/components/app/DashboardContext";
import { useHasSession } from "@/hooks/useBrowserState";

/**
 * The authenticated area.
 *
 * The guard, the shared dashboard state and the shell all live here rather
 * than in each page, so navigating between sections keeps the user's filters
 * and does not refetch everything.
 */

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/app": {
    title: "Overview",
    subtitle: "What you spent, what you earned, and where it went",
  },
  "/app/transactions": {
    title: "Transactions",
    subtitle: "All 10,000 rows, filtered and sorted on the server",
  },
  "/app/analytics": {
    title: "Analytics",
    subtitle: "Category breakdown and month-by-month trend",
  },
  "/app/rewards": {
    title: "Rewards",
    subtitle: "Spend your coins, and see what you have redeemed",
  },
};

function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { balance, rewardsState } = useDashboardContext();
  const meta = TITLES[pathname] ?? TITLES["/app"];

  return (
    <AppShell
      balance={balance?.balance ?? null}
      lifetimeEarned={balance?.lifetime_earned ?? null}
      balanceLoading={rewardsState.loading}
      title={meta.title}
      subtitle={meta.subtitle}
    >
      {children}
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  // Read through an external store rather than an effect: the token lives in
  // sessionStorage, so the server cannot know. `undefined` is "not determined
  // yet" (server render), which is why it does not immediately redirect.
  const hasSession = useHasSession();

  useEffect(() => {
    if (hasSession === false) router.replace("/login");
  }, [hasSession, router]);

  if (hasSession !== true) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <p className="text-[13px] text-text-faint">
          {hasSession === undefined ? "Checking your session…" : "Redirecting to sign in…"}
        </p>
      </main>
    );
  }

  return (
    <DashboardProvider>
      <Chrome>{children}</Chrome>
    </DashboardProvider>
  );
}
