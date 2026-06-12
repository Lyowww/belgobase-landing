"use client";

import { m, useInView, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";
import { cn } from "@/lib/utils";

type SectionRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
};

const offsets = {
  up: { y: 40, x: 0 },
  down: { y: -40, x: 0 },
  left: { x: 40, y: 0 },
  right: { x: -40, y: 0 },
};

export function SectionReveal({
  children,
  className,
  delay = 0,
  direction = "up",
}: SectionRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const prefersReducedMotion = useReducedMotion();
  const { isMobile } = usePerformanceMode();
  const base = offsets[direction];
  const offset = isMobile
    ? { x: base.x * 0.5, y: base.y * 0.5 }
    : base;

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <m.div
      ref={ref}
      initial={{ opacity: 0, ...offset }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, ...offset }}
      transition={{
        duration: isMobile ? 0.45 : 0.75,
        delay: isMobile ? delay * 0.6 : delay,
        ease: [0.22, 1, 0.36, 1],
        type: "tween",
      }}
      className={cn(className)}
    >
      {children}
    </m.div>
  );
}
