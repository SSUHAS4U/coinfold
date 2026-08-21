import type { Transition, Variants } from "motion/react";

/**
 * One motion vocabulary for the whole product.
 *
 * Every spring in Coinfold comes from this file. Components never invent their
 * own numbers, which is what stops a modal feeling different from a drawer
 * feeling different from a tooltip — the thing that makes an interface feel
 * assembled rather than designed.
 *
 * Springs rather than durations for anything the user causes directly: a
 * spring settles at a rate that reads as physical, and it can be interrupted
 * mid-flight without snapping. Durations are kept for things the user did not
 * trigger, where predictable timing matters more than physicality.
 */

/** Panels, sheets, drawers. A slight overshoot — present, not bouncy. */
export const springPanel: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.9,
};

/** Small controls: toggles, chips, icon buttons. Snappier, no visible overshoot. */
export const springControl: Transition = {
  type: "spring",
  stiffness: 620,
  damping: 38,
  mass: 0.6,
};

/** Things that travel across the screen — a coin flying to a balance. */
export const springTravel: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 1,
};

/** Layout reflow: filter tokens appearing, list reordering. */
export const springLayout: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 40,
  mass: 0.7,
};

/** Non-interactive reveals, where predictable timing beats physicality. */
export const easeEnter: Transition = {
  duration: 0.38,
  ease: [0.22, 1, 0.36, 1],
};

export const easeExit: Transition = {
  // Exits run at ~65% of the enter duration: leaving should feel decisive.
  duration: 0.24,
  ease: [0.65, 0, 0.35, 1],
};

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

/** Rises into place. The default for a panel entering the viewport. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: easeEnter },
};

/**
 * Staggered children. `custom` is the index, so a list can cascade without
 * every item needing its own delay.
 *
 * The stagger is capped: past ~8 items the delay stops growing, or the last
 * row of a long list arrives after the user has already looked away.
 */
export const riseStagger: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...easeEnter, delay: Math.min(index, 8) * 0.035 },
  }),
};

/** An action sheet: comes up from below with a spring. */
export const sheet: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: springPanel },
  exit: { opacity: 0, y: 16, scale: 0.98, transition: easeExit },
};

/** An inspector sliding in from the right edge. */
export const inspector: Variants = {
  hidden: { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0, transition: springPanel },
  exit: { opacity: 0, x: 24, transition: easeExit },
};

/** The scrim behind a floating layer. */
export const scrim: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.24 } },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};

/** Command palette: drops from slightly above, like Spotlight. */
export const palette: Variants = {
  hidden: { opacity: 0, y: -12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: springPanel },
  exit: { opacity: 0, y: -8, scale: 0.99, transition: easeExit },
};

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

/** Press feedback. Applied to every button in the product. */
export const tap = { scale: 0.975 } as const;

/** Hover lift for a card that is also a link. */
export const hoverLift = { y: -2 } as const;

/**
 * Viewport trigger for scroll reveals.
 *
 * `once` so a section does not re-animate every time it scrolls back past —
 * re-animation reads as a glitch, not as delight. The negative bottom margin
 * fires the reveal slightly before the element is fully on screen, so it is
 * already settled by the time the reader reaches it.
 */
export const inView = { once: true, margin: "0px 0px -12% 0px" } as const;
