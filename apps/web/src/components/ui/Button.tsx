"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  /** Renders the icon after the label — for "next" and "open" affordances. */
  trailing?: boolean;
}

/**
 * There is exactly one `primary` per screen. Everything else is subordinate,
 * which is what gives a screen a focal point at all.
 *
 * `loading` keeps the button's width by leaving the label in place and swapping
 * only the icon, so a row of controls does not reflow mid-interaction.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent hover:brightness-110 active:brightness-95 " +
    "shadow-[var(--shadow-1)]",
  secondary:
    "bg-surface-2 text-text border border-border hover:bg-surface-3 " +
    "hover:border-border-strong active:bg-surface-3",
  ghost: "text-text-dim hover:text-text hover:bg-surface-2 active:bg-surface-3",
  danger:
    "bg-transparent text-danger border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] " +
    "hover:bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]",
};

const SIZES: Record<Size, string> = {
  // min-h-11 is 44px — the touch-target floor asserted by the render tests.
  sm: "h-9 min-h-9 px-3 text-[13px] gap-1.5 rounded-[var(--r-control)]",
  md: "h-11 min-h-11 px-4 text-sm gap-2 rounded-[var(--r-control)]",
  lg: "h-12 min-h-12 px-6 text-[15px] gap-2 rounded-[var(--r-control)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, trailing, children, className = "", disabled, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  const glyph = loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      // Communicates busy state to assistive tech, which a spinner alone does not.
      aria-busy={loading || undefined}
      className={[
        "inline-flex select-none items-center justify-center font-medium",
        "transition-[background-color,border-color,filter,opacity]",
        "duration-[var(--t-interaction)] ease-[var(--ease)]",
        "disabled:cursor-not-allowed disabled:opacity-45",
        SIZES[size],
        VARIANTS[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {glyph && !trailing && <span className="shrink-0">{glyph}</span>}
      {children}
      {glyph && trailing && <span className="shrink-0">{glyph}</span>}
    </button>
  );
});
