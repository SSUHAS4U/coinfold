"use client";

import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { springControl, tap } from "@/lib/motion";

type Variant = "primary" | "secondary" | "ghost" | "gold" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps
  extends Omit<
    ComponentPropsWithoutRef<"button">,
    "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag" | "ref"
  > {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  trailing?: boolean;
}

/**
 * There is exactly one `primary` per screen; everything else is subordinate,
 * which is what gives a screen a focal point at all.
 *
 * `gold` exists only for reward actions. The accent means "interaction" and
 * gold means "reward" — using the accent to redeem would blur two meanings the
 * colour system keeps deliberately apart.
 *
 * `loading` keeps the label in place and swaps only the glyph, so a row of
 * controls does not reflow mid-interaction.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "text-[var(--on-accent)] shadow-[var(--shadow-rest)] " +
    "[background-image:var(--accent-gradient)] hover:brightness-[1.07] active:brightness-95",
  secondary:
    "bg-[var(--content)] text-ink border border-[var(--line-strong)] " +
    "shadow-[var(--shadow-rest)] hover:bg-[var(--content-hover)]",
  ghost: "text-ink-dim hover:bg-[var(--content-active)] hover:text-ink",
  gold:
    "text-white shadow-[var(--shadow-rest)] " +
    "[background-image:linear-gradient(135deg,var(--gold-bright),var(--gold))] " +
    "hover:brightness-[1.07] active:brightness-95",
  danger:
    "bg-transparent text-[var(--down)] border " +
    "border-[color-mix(in_oklab,var(--down)_32%,transparent)] " +
    "hover:bg-[color-mix(in_oklab,var(--down)_10%,transparent)]",
};

const SIZES: Record<Size, string> = {
  // 44px on touch, tighter from `sm` up: the touch floor applies to fingers,
  // and desktop density should not pay for it.
  sm: "h-11 min-h-11 sm:h-9 sm:min-h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 min-h-11 px-4.5 text-[14px] gap-2",
  lg: "h-13 min-h-13 px-6 text-[15px] gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading,
    icon,
    trailing,
    children,
    className = "",
    disabled,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const glyph = loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : icon;

  return (
    <motion.button
      ref={ref}
      disabled={isDisabled}
      // Communicates busy state to assistive tech, which a spinner alone does not.
      aria-busy={loading || undefined}
      whileTap={isDisabled ? undefined : tap}
      transition={springControl}
      className={[
        "relative inline-flex select-none items-center justify-center rounded-[var(--r-control)]",
        "font-medium tracking-[-0.01em] transition-[background-color,border-color,filter,opacity]",
        "duration-[var(--t-hover)] ease-[var(--ease-out)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        SIZES[size],
        VARIANTS[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {glyph && !trailing && <span className="shrink-0">{glyph}</span>}
      {children}
      {glyph && trailing && <span className="shrink-0">{glyph}</span>}
    </motion.button>
  );
});
