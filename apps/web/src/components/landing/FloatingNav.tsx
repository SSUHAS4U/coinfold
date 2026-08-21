"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Mark } from "@/components/brand/Mark";
import { springControl, springPanel, tap } from "@/lib/motion";

/**
 * A floating navigation bar, in the FLOATING material layer.
 *
 * It genuinely hovers above the page, so it is one of the few things allowed
 * to blur. It starts flush and detaches once the page scrolls — the shadow and
 * the blur arrive together, which is what sells "this is lifting off the
 * surface" rather than "this element has a border now".
 */

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#data", label: "The data" },
];

export function FloatingNav() {
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <motion.nav
        animate={{
          width: lifted ? "min(100%, 720px)" : "min(100%, 1120px)",
          paddingLeft: lifted ? 14 : 20,
          paddingRight: lifted ? 8 : 20,
        }}
        transition={springPanel}
        className={[
          "pointer-events-auto flex h-14 items-center gap-2 rounded-[var(--r-pill)]",
          "transition-shadow duration-[var(--t-move)]",
          lifted
            ? "border border-[var(--line-strong)] bg-[var(--floating-strong)] shadow-[var(--shadow-float)] backdrop-blur-[24px] backdrop-saturate-[180%]"
            : "border border-transparent bg-transparent",
        ].join(" ")}
      >
        <Link
          href="/"
          className={`mr-auto inline-flex items-center gap-2.5 transition-colors duration-[var(--t-move)] ${
            lifted ? "text-ink" : "text-white"
          }`}
        >
          <Mark size={22} />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">Coinfold</span>
        </Link>

        <div className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`rounded-[var(--r-pill)] px-3 py-2 text-[13.5px] transition-colors ${
                lifted
                  ? "text-ink-dim hover:bg-[var(--content-active)] hover:text-ink"
                  : "text-white/75 hover:text-white"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <Link
          href="/login"
          className={`rounded-[var(--r-pill)] px-3 py-2 text-[13.5px] transition-colors ${
            lifted ? "text-ink-dim hover:text-ink" : "text-white/75 hover:text-white"
          }`}
        >
          Sign in
        </Link>

        <motion.span whileTap={tap} transition={springControl}>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center rounded-[var(--r-pill)] px-4 text-[13.5px] font-medium text-[var(--on-accent)] shadow-[var(--shadow-rest)] [background-image:var(--accent-gradient)] transition-[filter] hover:brightness-[1.07]"
          >
            Get started
          </Link>
        </motion.span>
      </motion.nav>
    </div>
  );
}
