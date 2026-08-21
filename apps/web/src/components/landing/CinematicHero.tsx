"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/useBrowserState";

/**
 * The cinematic hero: four full-bleed photographic bands, scrubbed by scroll.
 *
 * Built to the design skill's band-map discipline rather than as a generic
 * parallax section:
 *
 *   THE BAND MAP — each band owns one photograph, one verbatim line, and ONE
 *   named entrance. The entrance ECHOES what the picture is doing, so the
 *   words and the image read as a single event instead of two things layered.
 *
 *     1  a warm room at closing time   "Your money has a story."
 *        entrance: word-by-word rise, opening already settled
 *     2  a lit street, all motion      "Ten thousand payments."
 *        entrance: characters scatter-assemble, chaos resolving to order
 *     3  a quiet desk                  "Sorted before you ask."
 *        entrance: blur-to-sharp, focus arriving
 *     4  gold                          "And you keep the change."
 *        entrance: staged settle, headline then subline then CTA
 *
 *   THE LEGIBILITY SYSTEM — four layers, because a single flat overlay kills
 *   the photograph without ever making the words safe:
 *     1. a global base scrim, always on, so no frame is ever raw
 *     2. a per-band scrim that deepens with that band's own progress
 *     3. a three-layer text shadow, off on buttons
 *     4. a blurred chip behind small labels
 *
 * Every effect is `transform` and `opacity` only, scrubbed off each band's `k`
 * (0 to 1), and fully reversible on scroll-up. Band one carries a one-time
 * load ramp so the hero opens with its words already assembled rather than
 * waiting for a scroll that may never come.
 */

interface Band {
  image: string;
  eyebrow: string;
  headline: string;
  sub: string;
  /** Scroll-progress window this band owns. */
  from: number;
  to: number;
  entrance: "rise" | "scatter" | "focus" | "settle";
  align: "left" | "right" | "center";
}

const BANDS: Band[] = [
  {
    image: "/img/hero-1-evening.jpg",
    eyebrow: "Credit-card bills, without the amnesia",
    headline: "Your money has a story.",
    sub: "Every payment you make says something. Coinfold is where you finally get to read it.",
    from: 0,
    to: 0.26,
    entrance: "rise",
    align: "left",
  },
  {
    image: "/img/hero-2-street.jpg",
    eyebrow: "Fourteen months of statements",
    headline: "Ten thousand payments.",
    sub: "Filtered, sorted and paged in Postgres. Your browser holds fifty rows, never the whole table.",
    from: 0.26,
    to: 0.52,
    entrance: "scatter",
    align: "left",
  },
  {
    image: "/img/hero-3-desk.jpg",
    eyebrow: "Ten categories, one timeline",
    headline: "Sorted before you ask.",
    sub: "Five timestamp formats, forty colliding ids, two hundred missing categories. All repaired at ingest, every repair on the record.",
    from: 0.52,
    to: 0.76,
    entrance: "focus",
    align: "right",
  },
  {
    image: "/img/hero-4-gold.jpg",
    eyebrow: "One coin for every ₹100",
    headline: "And you keep the change.",
    sub: "3,62,629 coins earned so far, every one of them traceable to the payment that made it.",
    from: 0.76,
    to: 1,
    entrance: "settle",
    align: "center",
  },
];

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}

/** Splits a line into words, and words into characters, for the entrances. */
function words(text: string) {
  return text.split(" ");
}

export function CinematicHero() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [loadK, setLoadK] = useState(0);
  const reduced = usePrefersReducedMotion();

  // Band one's one-time load ramp: the hero must open with words on screen,
  // not wait for a scroll. It hands over to scroll once it reaches 1.
  useEffect(() => {
    if (reduced) {
      setLoadK(1);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = clamp01((now - start) / 900);
      setLoadK(easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const stage = stageRef.current;
      if (!stage) return;
      const { top, height } = stage.getBoundingClientRect();
      const travel = height - window.innerHeight;
      setP(travel <= 0 ? 0 : clamp01(-top / travel));
    };
    const onScroll = () => {
      // One layout read per frame; measuring on every wheel event is what
      // makes scroll-driven pages lurch.
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduced]);

  return (
    <div ref={stageRef} style={{ height: reduced ? "auto" : "460vh" }}>
      <div
        className={
          reduced
            ? "relative"
            : "sticky top-0 h-dvh w-full overflow-hidden bg-[#0b0806]"
        }
      >
        {BANDS.map((band, index) => {
          // How far through its own window this band is.
          const raw = clamp01((p - band.from) / (band.to - band.from));
          const k = index === 0 && !reduced ? Math.max(raw, loadK) : reduced ? 1 : raw;

          // Visibility: a band is present across its window and hands over at
          // the edges, so two bands are never both fully opaque.
          const enter = clamp01((p - band.from) / 0.07);
          const leave = 1 - clamp01((p - (band.to - 0.07)) / 0.07);
          const vis = reduced ? 1 : index === 0 ? Math.min(1, leave) : Math.min(enter, leave);

          const isLast = index === BANDS.length - 1;

          return (
            <section
              key={band.image}
              className={
                reduced
                  ? "relative min-h-[86vh] overflow-hidden"
                  : "absolute inset-0"
              }
              style={reduced ? undefined : { opacity: vis, pointerEvents: vis < 0.5 ? "none" : undefined }}
              aria-hidden={!reduced && vis < 0.5}
            >
              {/* The photograph. A slow push-in across the band's own window,
                  so the picture is never static while its words are on. */}
              <div
                className="absolute inset-0"
                style={{ transform: reduced ? undefined : `scale(${1.1 - k * 0.1})` }}
              >
                <Image
                  src={band.image}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="100vw"
                  quality={88}
                  className="object-cover"
                />
              </div>

              {/* Layer 1 — the global base scrim. Always on. */}
              <div aria-hidden className="absolute inset-0" style={{ background: "var(--scrim-base)" }} />

              {/* Layer 2 — the per-band scrim, deepening with this band's k. */}
              <div
                aria-hidden
                className="absolute inset-[-4%]"
                style={{
                  background: "var(--scrim-band)",
                  opacity: 0.3 + 0.7 * k,
                }}
              />

              {/* A directional wash toward whichever side the copy occupies. */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    band.align === "right"
                      ? "linear-gradient(270deg, rgb(8 6 5 / 0.72) 0%, rgb(8 6 5 / 0.28) 46%, transparent 78%)"
                      : band.align === "center"
                        ? "radial-gradient(ellipse 70% 62% at 50% 52%, rgb(8 6 5 / 0.72) 0%, transparent 74%)"
                        : "linear-gradient(90deg, rgb(8 6 5 / 0.74) 0%, rgb(8 6 5 / 0.3) 46%, transparent 78%)",
                }}
              />

              {/* Layer 3 — the copy, carrying the three-layer text shadow. */}
              <div
                className={[
                  "over-photo relative mx-auto flex h-full max-w-[1180px] flex-col justify-center px-5 sm:px-8",
                  reduced ? "py-24" : "pt-28",
                  band.align === "right" ? "items-end text-right" : "",
                  band.align === "center" ? "items-center text-center" : "",
                ].join(" ")}
              >
                <div
                  className={
                    band.align === "center"
                      ? "w-full max-w-[720px]"
                      : "w-full max-w-[620px]"
                  }
                >
                  {/* Layer 4 — the chip, for the small label. */}
                  <span
                    className="chip-scrim inline-block rounded-[var(--r-pill)] px-3.5 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/85"
                    style={{ opacity: k, transform: `translateY(${(1 - k) * 10}px)` }}
                  >
                    {band.eyebrow}
                  </span>

                  <h2
                    className="display mt-8 text-[clamp(2.6rem,5.4vw,5rem)] text-white"
                    aria-label={band.headline}
                  >
                    {band.entrance === "focus" ? (
                      /* Blur-to-sharp: two stacked copies crossfaded. The soft
                         copy carries a STATIC blur — animating `filter` is not
                         compositor-friendly and drops frames. */
                      <span className="relative inline-block" aria-hidden>
                        <span
                          className="absolute inset-0 blur-[12px]"
                          style={{ opacity: 1 - k }}
                        >
                          {band.headline}
                        </span>
                        <span style={{ opacity: k }}>{band.headline}</span>
                      </span>
                    ) : band.entrance === "scatter" ? (
                      /* Scatter-assemble: characters arrive from offsets that
                         settle to zero, echoing motion resolving into order. */
                      <span aria-hidden>
                        {words(band.headline).map((word, w) => (
                          <span key={w} className="inline-block whitespace-nowrap">
                            {[...word].map((ch, c) => {
                              const seed = ((w * 31 + c * 17) % 13) / 13 - 0.5;
                              const local = clamp01(k * 2.2 - (w * 0.18 + c * 0.02));
                              return (
                                <span
                                  key={c}
                                  className="inline-block"
                                  style={{
                                    opacity: local,
                                    transform: `translate(${seed * 46 * (1 - local)}px, ${seed * 34 * (1 - local)}px)`,
                                  }}
                                >
                                  {ch}
                                </span>
                              );
                            })}
                            {w < words(band.headline).length - 1 && <span>&nbsp;</span>}
                          </span>
                        ))}
                      </span>
                    ) : (
                      /* Word-by-word rise, in reading order. */
                      <span aria-hidden>
                        {words(band.headline).map((word, w) => {
                          const local = clamp01(k * 2.4 - w * 0.16);
                          return (
                            <span
                              key={w}
                              className="inline-block"
                              style={{
                                opacity: local,
                                transform: `translateY(${(1 - local) * 0.32}em)`,
                              }}
                            >
                              {word}
                              {w < words(band.headline).length - 1 && <span>&nbsp;</span>}
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </h2>

                  {/* The subline follows the headline, never with it. */}
                  <p
                    className={[
                      "mt-8 text-[16px] leading-relaxed text-white/80",
                      band.align === "center" ? "mx-auto max-w-[48ch]" : "max-w-[44ch]",
                    ].join(" ")}
                    style={{
                      opacity: clamp01((k - 0.55) * 3),
                      transform: `translateY(${(1 - clamp01((k - 0.55) * 3)) * 12}px)`,
                    }}
                  >
                    {band.sub}
                  </p>

                  {/* The CTA arrives last, and only on the final band. */}
                  {isLast && (
                    <div
                      className={[
                        "mt-10 flex flex-wrap items-center gap-3",
                        band.align === "center" ? "justify-center" : "",
                      ].join(" ")}
                      style={{
                        opacity: clamp01((k - 0.72) * 4),
                        transform: `translateY(${(1 - clamp01((k - 0.72) * 4)) * 14}px)`,
                      }}
                    >
                      <Link
                        href="/signup"
                        className="btn inline-flex h-13 items-center gap-2 rounded-[var(--r-pill)] bg-white px-7 text-[15px] font-medium text-[#16130f] transition-transform hover:scale-[1.03]"
                      >
                        Create an account
                        <ArrowRight size={16} aria-hidden />
                      </Link>
                      <Link
                        href="/login"
                        className="btn inline-flex h-13 items-center rounded-[var(--r-pill)] border border-white/30 px-6 text-[15px] font-medium text-white transition-colors hover:bg-white/10"
                      >
                        Use the demo account
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}

        {/* A hairline progress rail: the one living element in the hero. */}
        {!reduced && (
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[2px] bg-white/12"
          >
            <div
              className="h-full origin-left"
              style={{
                transform: `scaleX(${p})`,
                background: "linear-gradient(90deg, rgb(255 255 255 / 0.5), #fff)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
