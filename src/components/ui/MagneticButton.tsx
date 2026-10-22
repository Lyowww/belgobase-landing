"use client";

import { type ReactNode } from "react";
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
    "bg-[#245adb] text-white hover:bg-[#1746bc]",
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
  const isFullWidth = className?.includes("w-full");

  const baseClass = cn(
    "relative inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-semibold transition-colors duration-150 touch-manipulation",
    variants[variant],
    disabled && "pointer-events-none opacity-60",
    isFullWidth && "w-full",
    className,
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} className={baseClass}>
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={baseClass}
    >
      {children}
    </button>
  );
}
