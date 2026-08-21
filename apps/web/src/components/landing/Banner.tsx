"use client";

import Image from "next/image";

/**
 * A still photographic banner behind a block of content.
 *
 * Used for the Overview headline strip. The scrim is heavy here on purpose:
 * unlike the landing, this surface carries figures a user reads rather than
 * a message they glance at, and legibility beats atmosphere every time a
 * number is involved.
 *
 * The banner stays dark in BOTH themes, so anything placed over it must pin
 * its own ink rather than following the text token.
 */
export function StillBanner({
  src,
  position = "center",
  overlay = 0.74,
}: {
  src: string;
  position?: string;
  overlay?: number;
}) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <Image
        src={src}
        alt=""
        fill
        priority
        sizes="100vw"
        quality={85}
        className="object-cover"
        style={{ objectPosition: position }}
      />
      <div className="absolute inset-0" style={{ background: `rgb(5 6 7 / ${overlay})` }} />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgb(5 6 7 / 0.7) 0%, rgb(5 6 7 / 0.25) 55%, rgb(5 6 7 / 0.6) 100%)",
        }}
      />
    </div>
  );
}
