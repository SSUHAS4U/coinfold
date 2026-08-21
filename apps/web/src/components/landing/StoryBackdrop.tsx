"use client";

import Image from "next/image";

/**
 * The scroll story, told by the photographs themselves.
 *
 * Each chapter owns one full-bleed image. As you scroll, its image:
 *
 *   - cross-fades in and out against its neighbours
 *   - scales from 1.18 down to 1.00 (a slow push-in, not a zoom)
 *   - drifts vertically against the scroll, so it reads as parallax depth
 *
 * All three are driven by ONE scroll-progress number, so nothing can desync.
 * Only `opacity` and `transform` animate — both compositor properties, so this
 * holds 60fps where animating width or top would not.
 *
 * The scrim is deliberately light (about half what a typical hero uses) and
 * DIRECTIONAL rather than flat: the image stays vivid and high-definition, and
 * the copy sits in the corner the gradient darkens. A flat grey wash over a
 * good photograph is how you end up with an expensive image that looks cheap.
 */

export interface StoryChapter {
  src: string;
  /** Scroll progress at which this image is fully visible. */
  at: number;
  /** Focal point, so the subject survives an aggressive crop. */
  position?: string;
  /** Which corner the copy occupies, so the scrim darkens the right side. */
  copySide?: "left" | "right" | "center";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function StoryBackdrop({
  chapters,
  progress,
  reduced,
}: {
  chapters: StoryChapter[];
  progress: number;
  reduced: boolean;
}) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#050607]">
      {chapters.map((chapter, index) => {
        const previous = index === 0 ? chapter.at - 0.3 : chapters[index - 1].at;
        const next =
          index === chapters.length - 1 ? chapter.at + 0.3 : chapters[index + 1].at;

        // How near are we to this chapter's anchor, 1 at the anchor, 0 at a
        // neighbour's anchor.
        const span = Math.min(chapter.at - previous, next - chapter.at) || 1;
        const nearness = clamp01(1 - Math.abs(progress - chapter.at) / span);

        // Signed local progress drives direction: an image pushes in as it
        // arrives and keeps travelling as it leaves, rather than bouncing back.
        const local = clamp01((progress - previous) / (next - previous));

        const opacity = reduced ? (index === 0 ? 1 : 0) : nearness;
        const scale = reduced ? 1 : 1.18 - nearness * 0.18;
        const drift = reduced ? 0 : (local - 0.5) * 90;

        const gradient =
          chapter.copySide === "right"
            ? "linear-gradient(270deg, rgb(5 6 7 / 0.92) 0%, rgb(5 6 7 / 0.55) 42%, rgb(5 6 7 / 0.15) 100%)"
            : chapter.copySide === "center"
              ? "radial-gradient(ellipse 78% 70% at 50% 55%, rgb(5 6 7 / 0.86) 0%, rgb(5 6 7 / 0.35) 60%, rgb(5 6 7 / 0.12) 100%)"
              : "linear-gradient(90deg, rgb(5 6 7 / 0.92) 0%, rgb(5 6 7 / 0.55) 42%, rgb(5 6 7 / 0.15) 100%)";

        return (
          <div
            key={chapter.src}
            className="absolute inset-0"
            style={{
              opacity,
              // will-change is set only while a layer is actually in play;
              // leaving it on every layer permanently costs GPU memory.
              willChange: opacity > 0.01 ? "opacity, transform" : undefined,
            }}
          >
            <div
              className="absolute inset-[-6%]"
              style={{ transform: `scale(${scale}) translateY(${drift}px)` }}
            >
              <Image
                src={chapter.src}
                alt=""
                fill
                priority={index === 0}
                sizes="100vw"
                quality={90}
                className="object-cover"
                style={{ objectPosition: chapter.position ?? "center" }}
              />
            </div>

            {/* Directional scrim: darkens only where the copy sits. */}
            <div className="absolute inset-0" style={{ background: gradient }} />
          </div>
        );
      })}

      {/* A light global floor plus top/bottom falloff, so the fixed nav and the
          section edge always have something to sit on regardless of chapter. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(5 6 7 / 0.72) 0%, rgb(5 6 7 / 0) 22%, rgb(5 6 7 / 0) 74%, rgb(5 6 7 / 0.85) 100%)",
        }}
      />
    </div>
  );
}

/**
 * A single still image with a Ken Burns drift, for the auth pages.
 *
 * The drift is CSS-only and slow (28s), so a sign-in screen feels alive without
 * anything moving fast enough to distract from the form.
 */
export function AuthBackdrop({
  src,
  position = "center",
}: {
  src: string;
  position?: string;
}) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#050607]">
      <div className="auth-drift absolute inset-[-8%]">
        <Image
          src={src}
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 55vw"
          quality={90}
          className="object-cover"
          style={{ objectPosition: position }}
        />
      </div>

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(5 6 7 / 0.55) 0%, rgb(5 6 7 / 0.2) 40%, rgb(5 6 7 / 0.88) 100%)",
        }}
      />

      <style>{`
        @keyframes auth-drift {
          0%   { transform: scale(1.06) translate3d(0, 0, 0); }
          100% { transform: scale(1.14) translate3d(-1.5%, -2%, 0); }
        }
        .auth-drift {
          animation: auth-drift 28s ease-in-out infinite alternate;
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-drift { animation: none; transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}
