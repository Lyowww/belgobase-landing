"use client";

import { m, useMotionValue, useSpring } from "framer-motion";
import { type ReactNode, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type MagneticButtonProps = {
  children: ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
};

const variants = {
  primary:
    "bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary-dark hover:shadow-primary/35 dark:shadow-primary/20 dark:hover:shadow-primary/30",
  secondary:
    "border border-border bg-surface-elevated text-deep-navy hover:border-primary/30 hover:bg-surface-hover dark:bg-surface-elevated/80",
  ghost: "text-deep-navy hover:bg-surface-hover",
};

export function MagneticButton({
  children,
  className,
  href,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });
  const isFullWidth = className?.includes("w-full");
  const [magneticEnabled, setMagneticEnabled] = useState(false);

  useEffect(() => {
    setMagneticEnabled(window.matchMedia("(pointer: fine)").matches);
  }, []);

  const handleMove = (e: React.MouseEvent) => {
    if (!magneticEnabled || !ref.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.15);
    y.set((e.clientY - centerY) * 0.15);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  const baseClass = cn(
    "relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all duration-300 touch-manipulation",
    variants[variant],
    disabled && "pointer-events-none opacity-60",
    isFullWidth && "w-full",
    className,
  );

  const wrapperClass = cn(isFullWidth ? "block w-full" : "inline-block");

  const content = (
    <m.div
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      whileTap={{ scale: 0.97 }}
      className={baseClass}
    >
      {children}
    </m.div>
  );

  if (href) {
    return (
      <a href={href} className={wrapperClass}>
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={wrapperClass}
    >
      {content}
    </button>
  );
}
