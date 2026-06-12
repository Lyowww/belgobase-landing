"use client";

import { useInView } from "framer-motion";
import { useRef } from "react";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";

/**
 * Returns whether heavy / infinite animations should run:
 * element is near the viewport and performance mode allows it.
 */
export function useActiveInView() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, margin: "-40px" });
  const { reduceMotionEffects } = usePerformanceMode();

  return {
    ref,
    active: isInView && !reduceMotionEffects,
    isInView,
    reduceMotionEffects,
  };
}
