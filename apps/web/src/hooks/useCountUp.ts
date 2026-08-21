"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts a figure to its new value instead of swapping it.
 *
 * A balance that jumps from 362,629 to 361,729 reads as a different number. A
 * balance that travels reads as a *change* — which is the point when the user
 * just spent something. Motion carrying meaning, not decorating it.
 *
 * Shared by the coin dial and the top-bar balance so both animate identically;
 * two count-ups with different easing on the same screen is exactly the kind of
 * inconsistency that makes an interface feel assembled rather than designed.
 */
export function useCountUp(target: number, reduced: boolean, duration = 750): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    // With motion disabled there is nothing to animate; the hook returns the
    // target directly, so only the ref needs syncing.
    if (reduced) {
      fromRef.current = target;
      return;
    }

    const start = performance.now();
    const delta = target - from;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // Ease-out cubic: fast, then settling. Reads as a value arriving rather
      // than a meter filling at a constant rate.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + delta * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, reduced]);

  return reduced ? target : display;
}
