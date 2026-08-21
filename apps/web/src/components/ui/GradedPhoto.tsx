"use client";

import Image from "next/image";

/**
 * A photograph graded onto the brand's colour ramp.
 *
 * Stock photography arrives in whatever light it was shot in. Put an amber
 * café next to an electric-blue accent and nothing belongs together — the
 * images sit BESIDE the interface instead of inside it. Every serious brand
 * solves this the same way: it grades its imagery.
 *
 * The technique, three layers:
 *
 *   1. desaturate the photo and lift its contrast slightly, so it stops
 *      insisting on its own colour but keeps its light and shade
 *   2. lay the brand gradient over it in `mix-blend-mode: color`, which takes
 *      HUE and SATURATION from the gradient and LUMINOSITY from the picture.
 *      The photograph's form survives exactly; only its colour is replaced.
 *   3. a soft multiply pass to deepen the shadows, so graded images still have
 *      somewhere dark for white type to sit
 *
 * The result is that a café, a market and a pile of coins all read as the same
 * brand, because they now share one colour ramp with the buttons and charts.
 *
 * `strength` is how far onto the ramp to pull it. 1 is a full duotone; around
 * 0.7 keeps a memory of the original light, which usually looks less like a
 * filter and more like a grade.
 */

export function GradedPhoto({
  src,
  alt = "",
  priority,
  sizes = "100vw",
  quality = 88,
  strength = 0.72,
  className = "",
  objectPosition,
}: {
  src: string;
  alt?: string;
  priority?: boolean;
  sizes?: string;
  quality?: number;
  strength?: number;
  className?: string;
  objectPosition?: string;
}) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        quality={quality}
        className="object-cover"
        style={{
          objectPosition,
          // Desaturate before grading: a photo that still carries its own
          // strong hue fights the ramp instead of accepting it.
          // Lifted, not dimmed: these sources are already dark, and the
          // grade plus the page scrims do the darkening from here.
          filter: `saturate(${1 - strength * 0.7}) contrast(1.12) brightness(1.32)`,
        }}
      />

      {/* The grade. `color` keeps the picture's luminosity and replaces its
          hue, which is what separates a grade from a coloured sheet laid on
          top of an image. */}
      <div
        aria-hidden
        className="absolute inset-0 mix-blend-color"
        style={{
          backgroundImage: "var(--grade-ramp)",
          opacity: strength,
        }}
      />

      {/* A light shadow pass only. The page's own scrims give the type its
          contrast; doing it twice is what turned a lit coin into a black
          rectangle. */}
      <div
        aria-hidden
        className="absolute inset-0 mix-blend-multiply"
        style={{
          backgroundImage: "var(--grade-shadow)",
          opacity: 0.16,
        }}
      />
    </div>
  );
}
