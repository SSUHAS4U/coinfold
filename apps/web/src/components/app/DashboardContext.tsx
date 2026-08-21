"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useDashboard } from "@/hooks/useDashboard";

/**
 * Holds the dashboard's state at the LAYOUT level, above the routes.
 *
 * This is what lets Overview, Transactions and Rewards be separate pages while
 * still sharing one filter state and one set of fetches. Without it each route
 * would mount its own `useDashboard`, refetch everything on navigation, and
 * quietly lose the user's filters when they moved between screens.
 */

type DashboardValue = ReturnType<typeof useDashboard>;

const DashboardCtx = createContext<DashboardValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const value = useDashboard();
  return <DashboardCtx.Provider value={value}>{children}</DashboardCtx.Provider>;
}

export function useDashboardContext(): DashboardValue {
  const value = useContext(DashboardCtx);
  if (!value) {
    // A clear message beats "cannot read property of null" three frames deep.
    throw new Error("useDashboardContext must be used inside <DashboardProvider>");
  }
  return value;
}
