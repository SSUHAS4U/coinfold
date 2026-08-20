"use client";

import Image from "next/image";

/**
 * Full-bleed photographic backdrops that cross-fade with scroll progress.
 *
 * Each chapter of the story owns one photograph. They are stacked, all
 * mounted, and only their opacity changes — so a cross-fade costs a
 * compositor property and never a layout or a network request mid-scroll.
 *
 * Every image carries a scrim: a vertical gradient plus a flat wash that pulls
 * it down to roughly 25% luminance. Photographs are the atmosphere; the type
 * has to stay the thing you read. Without the scrim, white text over a bright
 * photograph fails contrast the moment the image changes.
 *
 * `priority` is set only on the first image — it is the LCP element. Marking
 * them all priority would make the browser fight itself for bandwidth.
 */

export interface Chapter {
  src: string;
  alt: string;
  /** Scroll progress where this image is fully visible. */
  at: number;
  /** Focal point, so the subject survives an aggressive crop. */
  position?: string;
}

export function PhotoBackdrop({
  chapters,
  progress,
  reduced,
}: {
  chapters: Chapter[];
  progress: number;
  reduced: boolean;
}) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {chapters.map((chapter, index) => {
        // Distance from this chapter's anchor, normalised by the gap to its
        // neighbours, so a chapter is fully opaque at its anchor and gone by
        // the next one.
        const previous = index === 0 ? -0.35 : chapters[index - 1].at;
        const next = index === chapters.length - 1 ? 1.35 : chapters[index + 1].at;
        const span = Math.min(chapter.at - previous, next - chapter.at) || 1;
        const distance = Math.abs(progress - chapter.at);
        const opacity = reduced ? (index === 0 ? 1 : 0) : Math.max(0, 1 - distance / span);

        return (
          <div
            key={chapter.src}
            className="absolute inset-0"
            style={{
              opacity,
              // A slow push-in as a chapter arrives gives the still image a
              // sense of being filmed rather than pasted.
              transform: reduced ? undefined : `scale(${1.04 + (1 - opacity) * 0.04})`,
              transition: "opacity 120ms linear",
            }}
          >
            <Image
              src={chapter.src}
              alt={chapter.alt}
              fill
              priority={index === 0}
              sizes="100vw"
              className="object-cover"
              style={{ objectPosition: chapter.position ?? "center" }}
            />
          </div>
        );
      })}

      {/* Scrim. Two layers: a flat knock-down for overall luminance, and a
          vertical gradient that darkens top and bottom where the nav and the
          copy sit. */}
      <div className="absolute inset-0 bg-[rgb(4_6_8/0.74)]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(4 6 8 / 0.92) 0%, rgb(4 6 8 / 0.35) 38%, rgb(4 6 8 / 0.55) 72%, rgb(4 6 8 / 0.95) 100%)",
        }}
      />
    </div>
  );
}

/**
 * A single still backdrop, for pages that are not a scroll story (sign-in).
 */
export function StillBackdrop({
  src,
  alt,
  position = "center",
  overlay = 0.62,
}: {
  src: string;
  alt: string;
  position?: string;
  overlay?: number;
}) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
        style={{ objectPosition: position }}
      />
      <div className="absolute inset-0" style={{ background: `rgb(4 6 8 / ${overlay})` }} />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(4 6 8 / 0.55) 0%, rgb(4 6 8 / 0.15) 45%, rgb(4 6 8 / 0.8) 100%)",
        }}
      />
    </div>
  );
}
