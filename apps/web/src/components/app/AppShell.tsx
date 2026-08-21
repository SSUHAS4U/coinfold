"use client";

import {
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PieChart,
  Receipt,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { CoinHud } from "@/components/dashboard/CoinHud";
import { Mark } from "@/components/brand/Mark";
import { notifySession, setTheme, useTheme } from "@/hooks/useBrowserState";
import { tokens } from "@/lib/api";

/**
 * The application shell: a persistent sidebar, a top bar, and the routed page.
 *
 * The sidebar is the point. Putting Overview, Transactions, Analytics and
 * Rewards on one scrolling page made each of them feel like an afterthought and
 * gave the user nowhere to stand. Separate routes mean the browser's back
 * button works, each screen can be linked to, and each one gets the whole
 * viewport instead of a slice of it.
 *
 * Below `lg` the sidebar becomes a drawer: a rail of icons is not navigation,
 * it is a puzzle.
 */

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Overview matches only its exact path, or it would light up on every route. */
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/transactions", label: "Transactions", icon: Receipt },
  { href: "/app/analytics", label: "Analytics", icon: PieChart },
  { href: "/app/rewards", label: "Rewards", icon: Gift },
];

function ThemeToggle() {
  const theme = useTheme();
  const light = theme === "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(light ? "dark" : "light")}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      className="grid size-11 min-h-11 place-items-center rounded-[var(--r-control)] border border-[var(--line)] text-ink-dim transition-colors duration-[var(--t-hover)] hover:border-[var(--line-strong)] hover:text-ink"
    >
      {light ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
    </button>
  );
}

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Sections" className="space-y-1">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={[
              "flex h-11 min-h-11 items-center gap-3 rounded-[var(--r-control)] px-3",
              "text-[13.5px] transition-colors duration-[var(--t-hover)]",
              active
                ? "bg-[var(--content-active)] font-medium text-ink"
                : "text-ink-dim hover:bg-[var(--content-hover)] hover:text-ink",
            ].join(" ")}
          >
            {/* The active marker is a bar, not only a colour: colour alone is
                not a reliable signal of "you are here". */}
            <span
              aria-hidden
              className="h-4 w-[2px] shrink-0 rounded-full transition-colors"
              style={{ background: active ? "var(--accent)" : "transparent" }}
            />
            <Icon size={16} aria-hidden className="shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  balance,
  lifetimeEarned,
  balanceLoading,
  title,
  subtitle,
  children,
}: {
  balance: number | null;
  lifetimeEarned: number | null;
  balanceLoading: boolean;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Escape closes the drawer, matching every other overlay in the app.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const signOut = useCallback(() => {
    tokens.clear();
    notifySession();
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* ---- Sidebar, permanent from lg up ---------------------------- */}
      <aside className="hidden border-r border-[var(--line)] bg-[var(--content)] lg:flex lg:h-dvh lg:flex-col lg:sticky lg:top-0">
        <div className="flex h-[73px] items-center border-b border-[var(--line)] px-5">
          <Link href="/app" className="inline-flex items-center gap-2.5 text-ink">
            <Mark size={19} />
            <span className="text-[13px] font-medium uppercase tracking-[0.16em]">Coinfold</span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <NavList pathname={pathname} />
        </div>

        <div className="border-t border-[var(--line)] p-3">
          <button
            type="button"
            onClick={signOut}
            className="flex h-11 min-h-11 w-full items-center gap-3 rounded-[var(--r-control)] px-3 text-[13.5px] text-ink-dim transition-colors hover:bg-[var(--content-hover)] hover:text-ink"
          >
            <span aria-hidden className="w-[2px] shrink-0" />
            <LogOut size={16} aria-hidden className="shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ---- Mobile drawer -------------------------------------------- */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[rgb(0_0_0/0.6)]"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-[264px] flex-col border-r border-[var(--line)] bg-[var(--content)]"
          >
            <div className="flex h-[73px] items-center justify-between border-b border-[var(--line)] px-5">
              <span className="inline-flex items-center gap-2.5 text-ink">
                <Mark size={19} />
                <span className="text-[13px] font-medium uppercase tracking-[0.16em]">
                  Coinfold
                </span>
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="grid size-11 min-h-11 place-items-center rounded-[var(--r-control)] text-ink-faint hover:bg-[var(--content-hover)] hover:text-ink"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <NavList pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            </div>

            <div className="border-t border-[var(--line)] p-3">
              <button
                type="button"
                onClick={signOut}
                className="flex h-11 min-h-11 w-full items-center gap-3 rounded-[var(--r-control)] px-3 text-[13.5px] text-ink-dim hover:bg-[var(--content-hover)] hover:text-ink"
              >
                <span aria-hidden className="w-[2px] shrink-0" />
                <LogOut size={16} aria-hidden />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Main column ---------------------------------------------- */}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--floating-strong)] backdrop-blur-md">
          <div className="flex min-h-[73px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="grid size-11 min-h-11 shrink-0 place-items-center rounded-[var(--r-control)] border border-[var(--line)] text-ink-dim transition-colors hover:border-[var(--line-strong)] hover:text-ink lg:hidden"
            >
              <Menu size={17} aria-hidden />
            </button>

            <div className="mr-auto min-w-0">
              <h1 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">
                {title}
              </h1>
              <p className="truncate text-[12.5px] text-ink-faint">{subtitle}</p>
            </div>

            <CoinHud
              balance={balance}
              lifetimeEarned={lifetimeEarned}
              loading={balanceLoading}
            />
            <ThemeToggle />
          </div>
        </header>

        <main className="px-4 py-7 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
