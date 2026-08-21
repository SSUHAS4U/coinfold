"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/landing/Atmosphere";
import { AuthBackdrop } from "@/components/landing/StoryBackdrop";

/**
 * Shared frame for sign-in and sign-up.
 *
 * A split: photography on one half, the form on the other. The image half is
 * hidden below `lg` — on a phone it would push the form below the fold, and a
 * sign-in you have to scroll to is worse than no picture at all.
 *
 * Ink on the image half is pinned white rather than following --text, because
 * that half is dark in BOTH themes. Following the token would make it
 * near-black on a dark photograph in light mode.
 */

export function AuthShell({
  image,
  imagePosition,
  eyebrow,
  headline,
  blurb,
  stats,
  children,
}: {
  image: string;
  imagePosition?: string;
  eyebrow: string;
  headline: ReactNode;
  blurb: string;
  stats: [string, string][];
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,520px)]">
      <aside className="relative hidden overflow-hidden lg:block">
        <AuthBackdrop src={image} position={imagePosition} />

        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="inline-flex items-center gap-2.5 text-white">
            <Logo size={22} />
            <span className="text-[13px] font-medium uppercase tracking-[0.16em]">Coinfold</span>
          </Link>

          <div>
            <p className="text-[12px] uppercase tracking-[0.24em] text-white/55">{eyebrow}</p>
            <h2 className="mt-4 max-w-[15ch] text-[clamp(2rem,3.2vw,3rem)] font-semibold uppercase leading-[0.97] tracking-[-0.03em] text-white">
              {headline}
            </h2>
            <p className="mt-5 max-w-[38ch] text-[14px] leading-relaxed text-white/70">{blurb}</p>

            <dl className="mt-10 flex gap-10">
              {stats.map(([value, label]) => (
                <div key={label}>
                  <dt className="tnum text-[22px] font-semibold tracking-[-0.02em] text-white">
                    {value}
                  </dt>
                  <dd className="mt-0.5 text-[12px] text-white/55">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </aside>

      <div className="relative flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2.5 text-text lg:hidden"
          >
            <Logo size={20} />
            <span className="text-[13px] font-medium uppercase tracking-[0.16em]">Coinfold</span>
          </Link>
          {children}
        </div>
      </div>
    </main>
  );
}

export const authInputClass =
  "h-11 min-h-11 w-full rounded-[var(--r-control)] border border-border bg-surface-1 px-3 " +
  "text-[14px] text-text placeholder:text-text-faint transition-colors " +
  "duration-[var(--t-interaction)] hover:border-border-strong focus:border-accent focus:outline-none";

export function AuthField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] tracking-[0.02em] text-text-faint">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12px] text-text-faint">{hint}</span>}
    </label>
  );
}

export function AuthError({ what, action }: { what: string; action: string }) {
  return (
    <div
      role="alert"
      className="rounded-[var(--r-control)] border px-3 py-2.5"
      style={{
        borderColor: "color-mix(in oklab, var(--danger) 35%, transparent)",
        background: "color-mix(in oklab, var(--danger) 8%, transparent)",
      }}
    >
      <p className="text-[13px] font-medium" style={{ color: "var(--danger)" }}>
        {what}
      </p>
      <p className="mt-1 text-[12px] text-text-dim">{action}</p>
    </div>
  );
}
