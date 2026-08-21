"use client";

import { useSyncExternalStore } from "react";

/**
 * Reading browser state the way React actually wants it read.
 *
 * The obvious approach — `useState(false)` plus an effect that sets the real
 * value on mount — renders twice and is flagged by react-hooks/set-state-in-effect,
 * correctly: it is a cascading render. `useSyncExternalStore` is the API built
 * for this. It subscribes to the external source, returns the current value
 * during render, and takes an explicit server snapshot so SSR and hydration
 * agree instead of flashing.
 */

const emptySubscribe = () => () => {};

/** Matches a CSS media query, and re-renders when the match changes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    // On the server, assume no match. For reduced-motion this is the safe
    // default: the animation is rendered, then removed on hydration if the
    // user asked for stillness — never the reverse, which would flash motion.
    () => false,
  );
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

// --- Theme ------------------------------------------------------------------
// A tiny store so every component reading the theme sees one value and one
// subscription, rather than each keeping its own copy in sync.

const themeListeners = new Set<() => void>();

function notifyTheme() {
  for (const listener of themeListeners) listener();
}

export function setTheme(next: "light" | "dark") {
  document.documentElement.classList.toggle("light", next === "light");
  localStorage.setItem("coinfold.theme", next);
  notifyTheme();
}

export function useTheme(): "light" | "dark" {
  return useSyncExternalStore(
    (onChange) => {
      themeListeners.add(onChange);
      return () => themeListeners.delete(onChange);
    },
    () => (document.documentElement.classList.contains("light") ? "light" : "dark"),
    // Dark is the designed default, and the inline script in the layout has
    // already applied any saved preference before first paint.
    () => "dark" as const,
  );
}

// --- Session ----------------------------------------------------------------

const sessionListeners = new Set<() => void>();

export function notifySession() {
  for (const listener of sessionListeners) listener();
}

/**
 * Whether an access token is present.
 *
 * `undefined` means "not determined yet" — the server cannot know, because the
 * token lives in sessionStorage. The guard renders a neutral state for that
 * case rather than briefly deciding the user is signed out and redirecting.
 */
export function useHasSession(): boolean | undefined {
  return useSyncExternalStore(
    (onChange) => {
      sessionListeners.add(onChange);
      window.addEventListener("storage", onChange);
      return () => {
        sessionListeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => Boolean(sessionStorage.getItem("coinfold.access")),
    () => undefined,
  );
}

/** For values that must not be read during SSR at all. */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
