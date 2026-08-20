"use client";

/**
 * The things that stop a dark page reading as a blank black rectangle.
 *
 * Flat #08090A across a whole viewport looks like an unstyled page, not a
 * designed one. Depth on a dark surface comes from three cheap, non-decorative
 * layers, all pure CSS/SVG so they cost no assets and no network:
 *
 *   grain     a real film-grain texture from SVG feTurbulence. This is the
 *             single biggest difference between "premium dark" and "black div".
 *             Every expensive dark site has it; almost no generated one does.
 *   wash      two very wide, very low-opacity radial gradients that give the
 *             canvas a light source and therefore a direction.
 *   vignette  darkens the corners so the centre reads as lit.
 */

export function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

export function Wash() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Key light, upper left — the accent, at an opacity you would not
          consciously notice but would miss if removed. */}
      <div
        className="absolute -left-[18%] -top-[28%] size-[68vw] rounded-full blur-[120px]"
        style={{ background: "color-mix(in oklab, var(--accent) 13%, transparent)" }}
      />
      {/* Cool fill, lower right, to keep the field from going one-note. */}
      <div
        className="absolute -bottom-[32%] -right-[14%] size-[58vw] rounded-full blur-[130px]"
        style={{ background: "oklch(52% 0.12 266 / 0.14)" }}
      />
      {/* Vignette. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 45%, transparent 40%, rgb(0 0 0 / 0.55) 100%)",
        }}
      />
    </div>
  );
}

/**
 * The mark. A coin seen at a fold — two arcs offset on the same centre, so it
 * reads as a disc that has been creased. Drawn rather than imported so it
 * inherits currentColor and needs no asset request.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path
        d="M12 2.75a9.25 9.25 0 0 1 0 18.5c-3.4 0-5.1-4.14-5.1-9.25S8.6 2.75 12 2.75Z"
        fill="currentColor"
      />
      <path
        d="M12 2.75v18.5"
        stroke="var(--bg)"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/**
 * Scroll rail — the tracing-beam mechanism from the design library, reduced to
 * its essentials: a hairline track carrying all its visual energy in the
 * travelling head rather than the line.
 */
export function ScrollRail({ progress }: { progress: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed right-5 top-1/2 z-20 hidden h-[38vh] w-px -translate-y-1/2 lg:block"
      style={{ background: "color-mix(in oklab, var(--text) 12%, transparent)" }}
    >
      <div
        className="absolute inset-x-0 top-0 origin-top"
        style={{
          height: "100%",
          transform: `scaleY(${Math.max(0, Math.min(1, progress))})`,
          background: "color-mix(in oklab, var(--accent) 55%, transparent)",
        }}
      />
      <div
        className="absolute -left-[3px] size-[7px] rounded-full"
        style={{
          top: `calc(${Math.max(0, Math.min(1, progress)) * 100}% - 3.5px)`,
          background: "var(--accent)",
          boxShadow: "0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent)",
        }}
      />
    </div>
  );
}
