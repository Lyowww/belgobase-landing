"use client";

import { m, useInView, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode } from "react";
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
  const offset = offsets[direction];

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <m.div
      ref={ref}
      initial={{ opacity: 0, ...offset }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, ...offset }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1], type: "tween" }}
      className={cn(className)}
    >
      {children}
    </m.div>
  );
}
