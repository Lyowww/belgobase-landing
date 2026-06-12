"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

type PerformanceMode = {
  /** User prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Viewport ≤ 1023px */
  isMobile: boolean;
  /** Coarse pointer (touch) */
  isTouch: boolean;
  /** Disable infinite loops & ambient CSS — keep one-shot reveals */
  reduceMotionEffects: boolean;
  /** Use solid surfaces instead of backdrop-filter / heavy blur */
  reduceVisualEffects: boolean;
};

const MOBILE_QUERY = "(max-width: 1023px)";
const TOUCH_QUERY = "(pointer: coarse)";

function readMode(prefersReducedMotion: boolean | null): PerformanceMode {
  if (typeof window === "undefined") {
    return {
      prefersReducedMotion: !!prefersReducedMotion,
      isMobile: false,
      isTouch: false,
      reduceMotionEffects: !!prefersReducedMotion,
      reduceVisualEffects: !!prefersReducedMotion,
    };
  }

  const isMobile = window.matchMedia(MOBILE_QUERY).matches;
  const isTouch = window.matchMedia(TOUCH_QUERY).matches;

  return {
    prefersReducedMotion: !!prefersReducedMotion,
    isMobile,
    isTouch,
    reduceMotionEffects: !!prefersReducedMotion || isMobile,
    reduceVisualEffects: !!prefersReducedMotion || isMobile || isTouch,
  };
}

export function usePerformanceMode(): PerformanceMode {
  const prefersReducedMotion = useReducedMotion();
  const [mode, setMode] = useState(() => readMode(prefersReducedMotion));

  useEffect(() => {
    const mobileMq = window.matchMedia(MOBILE_QUERY);
    const touchMq = window.matchMedia(TOUCH_QUERY);

    const sync = () => setMode(readMode(prefersReducedMotion));

    sync();
    mobileMq.addEventListener("change", sync);
    touchMq.addEventListener("change", sync);
    return () => {
      mobileMq.removeEventListener("change", sync);
      touchMq.removeEventListener("change", sync);
    };
  }, [prefersReducedMotion]);

  return mode;
}
