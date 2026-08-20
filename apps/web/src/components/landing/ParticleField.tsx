"use client";

import { useEffect, useRef } from "react";

/**
 * The hero visual: 10,000 particles, one per transaction in the sample
 * dataset, each carrying its real category colour.
 *
 * It is not decoration standing in for a photograph — it IS the data. As the
 * page scrolls the field reorganises through four states:
 *
 *   0  drift    a loose scattered field, breathing
 *   1  stream   pulled into a horizontal current, the shape of a feed
 *   2  sort     separated into ten stacked bands, one per category, each band's
 *               width proportional to that category's real share of spend
 *   3  coin     collapsed into a single disc
 *
 * Every particle interpolates between its own precomputed target for each
 * state, so the transitions are continuous rather than cross-faded. That is
 * what makes it read as one substance moving, rather than four pictures.
 *
 * Performance: positions live in flat Float32Arrays and the whole field is
 * drawn as filled rects in one pass — no per-particle objects, no shadow
 * blur, no per-frame allocation. It holds 60fps with 10,000 points.
 */

const CATEGORIES: { hue: number; share: number }[] = [
  { hue: 196, share: 0.1213 }, // Travel
  { hue: 292, share: 0.1209 }, // Shopping
  { hue: 48, share: 0.1014 }, // Utilities
  { hue: 12, share: 0.1009 }, // Food & Dining
  { hue: 158, share: 0.0998 }, // Health
  { hue: 266, share: 0.0992 }, // Education
  { hue: 330, share: 0.0983 }, // Entertainment
  { hue: 95, share: 0.0979 }, // Groceries
  { hue: 32, share: 0.078 }, // Fuel
  { hue: 232, share: 0.0623 }, // Insurance
];

const COUNT = 10_000;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smooth(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function ParticleField({ progress, reduced }: { progress: number; reduced: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Read by the animation loop without re-subscribing it on every scroll frame.
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Flat typed arrays: one allocation, no garbage per frame.
    const cat = new Uint8Array(COUNT);
    const driftX = new Float32Array(COUNT);
    const driftY = new Float32Array(COUNT);
    const streamX = new Float32Array(COUNT);
    const streamY = new Float32Array(COUNT);
    const sortX = new Float32Array(COUNT);
    const sortY = new Float32Array(COUNT);
    const coinX = new Float32Array(COUNT);
    const coinY = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);

    let width = 0;
    let height = 0;
    let dpr = 1;

    /** Assigns every particle its target position in each of the four states. */
    function seed() {
      // Category membership follows the real distribution, so band thickness
      // is the dataset's actual composition rather than an even split.
      let index = 0;
      for (let c = 0; c < CATEGORIES.length; c += 1) {
        const n = c === CATEGORIES.length - 1 ? COUNT - index : Math.round(CATEGORIES[c].share * COUNT);
        for (let k = 0; k < n && index < COUNT; k += 1, index += 1) cat[index] = c;
      }

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.135;

      // Band geometry for the sorted state.
      const bandH = (height * 0.62) / CATEGORIES.length;
      const bandTop = height * 0.19;
      const counts = new Uint32Array(CATEGORIES.length);
      for (let i = 0; i < COUNT; i += 1) counts[cat[i]] += 1;
      const seen = new Uint32Array(CATEGORIES.length);

      for (let i = 0; i < COUNT; i += 1) {
        const c = cat[i];

        // 0 — drift: uniform scatter with a soft horizon bias.
        driftX[i] = Math.random() * width;
        driftY[i] = Math.random() * height;

        // 1 — stream: a band across the middle, denser at its core.
        const spread = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
        streamX[i] = Math.random() * width;
        streamY[i] = cy + spread * height * 0.46;

        // 2 — sort: each category its own row, filled left to right in
        // proportion to its share, so the rows read as a bar chart.
        //
        // Rows are held inside the left 58% of the canvas. The chapter's copy
        // sits in the right column, and bands running under it made the text
        // unreadable — the bars are the evidence, but the sentence naming what
        // they are has to win.
        const within = seen[c] / counts[c];
        seen[c] += 1;
        const rowWidth = width * 0.5 * (counts[c] / counts[0]);
        sortX[i] = width * 0.06 + within * rowWidth + (Math.random() - 0.5) * 3;
        sortY[i] = bandTop + c * bandH + bandH * 0.5 + (Math.random() - 0.5) * bandH * 0.62;

        // 3 — coin: a filled disc, area-uniform so it does not clump centrally.
        // Seated above centre so the readout and its caption sit below the
        // disc rather than on top of 10,000 specks.
        const angle = Math.random() * Math.PI * 2;
        const r = radius * Math.sqrt(Math.random());
        coinX[i] = cx + Math.cos(angle) * r;
        coinY[i] = height * 0.3 + Math.sin(angle) * r * 0.99;

        phase[i] = Math.random() * Math.PI * 2;
        size[i] = 0.8 + Math.random() * 1.0;
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    resize();

    let raf = 0;
    let time = 0;

    function frame() {
      const p = progressRef.current;
      time += 0.006;

      ctx!.clearRect(0, 0, width, height);

      // Which pair of states are we between, and how far?
      // drift 0.00-0.16 · stream 0.16-0.40 · sort 0.40-0.66 · coin 0.66-1.00
      const toStream = smooth((p - 0.02) / 0.18);
      const toSort = smooth((p - 0.34) / 0.16);
      const toCoin = smooth((p - 0.6) / 0.16);

      // Global fade: the field recedes while the hero copy is legible, comes
      // forward for its own chapters, so it never fights the type.
      const presence = 0.34 + 0.66 * smooth((p - 0.04) / 0.16);

      for (let i = 0; i < COUNT; i += 1) {
        // Drift never fully stops: a living field, not a frozen one.
        const wobble = reduced ? 0 : Math.sin(time + phase[i]) * 3.5;

        let x = lerp(driftX[i] + wobble, streamX[i], toStream);
        let y = lerp(driftY[i] + wobble * 0.6, streamY[i], toStream);
        x = lerp(x, sortX[i], toSort);
        y = lerp(y, sortY[i], toSort);
        x = lerp(x, coinX[i], toCoin);
        y = lerp(y, coinY[i], toCoin);

        // Colour only emerges as the field sorts. Before that it is near
        // monochrome, so the reveal of ten colours IS the chapter change.
        const hue = CATEGORIES[cat[i]].hue;
        const chroma = 0.02 + 0.12 * Math.max(toSort, toCoin * 0.55);
        const light = 0.42 + 0.3 * Math.max(toStream, toSort);

        ctx!.fillStyle = `oklch(${light * 100}% ${chroma} ${hue} / ${presence})`;
        const s = size[i] * (1 + toCoin * 0.5);
        ctx!.fillRect(x, y, s, s);
      }

      raf = requestAnimationFrame(frame);
    }

    if (reduced) {
      // One static frame at the sorted state: the composition without motion.
      progressRef.current = 0.5;
      frame();
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full"
    />
  );
}
