"use client";

import { m, useInView, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";
import { fadeUp, staggerContainer, smoothEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

type StaggerRevealProps = {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
};

export function StaggerReveal({
  children,
  className,
  stagger = 0.08,
  delayChildren = 0.06,
}: StaggerRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const prefersReducedMotion = useReducedMotion();
  const { isMobile } = usePerformanceMode();

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <m.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={staggerContainer(
        isMobile ? stagger * 0.6 : stagger,
        isMobile ? delayChildren * 0.5 : delayChildren,
      )}
      className={cn(className)}
    >
      {children}
    </m.div>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
};

export function StaggerItem({ children, className }: StaggerItemProps) {
  const { isMobile } = usePerformanceMode();

  return (
    <m.div
      variants={isMobile ? { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } } : fadeUp}
      transition={{ duration: isMobile ? 0.4 : 0.55, ease: smoothEase }}
      className={cn(className)}
    >
      {children}
    </m.div>
  );
}
