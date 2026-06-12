"use client";

import { m, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";

type AnimatedCounterProps = {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
};

export function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
  className,
}: AnimatedCounterProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const { isMobile } = usePerformanceMode();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, {
    stiffness: isMobile ? 140 : 80,
    damping: isMobile ? 28 : 20,
  });
  const rounded = useTransform(spring, (latest) =>
    Math.round(latest).toLocaleString(),
  );

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, motionValue, value]);

  if (isMobile) {
    return (
      <span ref={ref} className={className}>
        {prefix}
        {isInView ? value.toLocaleString() : "0"}
        {suffix}
      </span>
    );
  }

  return (
    <span ref={ref} className={className}>
      {prefix}
      <m.span>{rounded}</m.span>
      {suffix}
    </span>
  );
}
