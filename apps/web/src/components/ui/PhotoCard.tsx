"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { GradedPhoto } from "@/components/ui/GradedPhoto";

import { springPanel, springControl } from "@/lib/motion";

/**
 * A photographic card.
 *
 * The interaction is the point: on hover the card lifts, its shadow deepens,
 * and the image inside scales up *behind* a fixed frame. The photo moving
 * relative to its own frame is what makes it read as a window rather than a
 * picture pasted onto a rectangle — and it is the difference between a card
 * that feels built and one that feels placed.
 *
 * Only `transform` and `opacity` animate, so the lift costs the compositor
 * nothing even with ten of these on screen.
 */

export function PhotoCard({
  src,
  alt,
  eyebrow,
  title,
  value,
  meta,
  tint,
  aspect = "4 / 3",
  onClick,
  selected,
  children,
}: {
  src: string;
  alt: string;
  eyebrow?: string;
  title: string;
  value?: string;
  meta?: string;
  /** Category colour, used for the accent rule and the tinted wash. */
  tint?: string;
  aspect?: string;
  onClick?: () => void;
  selected?: boolean;
  children?: ReactNode;
}) {
  const Wrapper = onClick ? motion.button : motion.div;

  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick, "aria-pressed": selected } : {})}
      initial="rest"
      whileHover="hover"
      whileFocus="hover"
      whileTap={onClick ? { scale: 0.985 } : undefined}
      animate="rest"
      variants={{ rest: { y: 0 }, hover: { y: -4 } }}
      transition={springPanel}
      className={[
        "group relative block w-full overflow-hidden text-left",
        "rounded-[var(--r-card)] border bg-[var(--content)]",
        "transition-[box-shadow,border-color] duration-[var(--t-move)]",
        selected
          ? "border-[var(--accent-line)] shadow-[var(--shadow-lift)]"
          : "border-[var(--line)] shadow-[var(--shadow-rest)] hover:shadow-[var(--shadow-lift)]",
      ].join(" ")}
    >
      {/* The window. overflow-hidden here, not on the card, so the image can
          scale without the card's own corners clipping the shadow. */}
      <div className="relative overflow-hidden" style={{ aspectRatio: aspect }}>
        <motion.div
          className="absolute inset-0"
          variants={{ rest: { scale: 1 }, hover: { scale: 1.07 } }}
          transition={springPanel}
        >
          {/* Graded more gently than the hero: these are small, and a full
              duotone at card size loses the subject entirely. */}
          <GradedPhoto
            src={src}
            alt={alt}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            strength={0.55}
          />
        </motion.div>

        {/* A gradient foot so any caption laid over the image stays readable
            regardless of what the photograph happens to be doing down there. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/3"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgb(10 10 16 / 0.14) 45%, rgb(10 10 16 / 0.72) 100%)",
          }}
        />

        {tint && (
          <motion.div
            aria-hidden
            className="absolute inset-0 mix-blend-multiply"
            variants={{ rest: { opacity: 0 }, hover: { opacity: 0.18 } }}
            transition={{ duration: 0.28 }}
            style={{ background: tint }}
          />
        )}

        {eyebrow && (
          <span className="absolute left-4 top-4 rounded-[var(--r-pill)] bg-[var(--floating-strong)] px-2.5 py-1 text-[11px] font-medium text-ink backdrop-blur-md">
            {eyebrow}
          </span>
        )}

        {/* Caption sits on the image, over the gradient foot. */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold tracking-[-0.015em] text-white">
              {title}
            </span>
            {meta && <span className="mt-0.5 block text-[12px] text-white/75">{meta}</span>}
          </span>
          {value && <span className="figure shrink-0 text-[17px] text-white">{value}</span>}
        </div>
      </div>

      {/* An accent rule that draws in on hover, in the category's own colour. */}
      {tint && (
        <motion.span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[3px] origin-left"
          style={{ background: tint }}
          variants={{ rest: { scaleX: selected ? 1 : 0 }, hover: { scaleX: 1 } }}
          transition={springControl}
        />
      )}

      {children && <div className="p-4">{children}</div>}
    </Wrapper>
  );
}
