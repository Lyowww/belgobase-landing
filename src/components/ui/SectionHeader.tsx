"use client";

import { SectionReveal } from "./SectionReveal";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeaderProps) {
  return (
    <SectionReveal className={cn("mb-10 sm:mb-16 md:mb-20", className)}>
      <div
        className={cn(
          "max-w-3xl",
          align === "center" && "mx-auto text-center",
        )}
      >
        {eyebrow && (
          <p className="mb-3 text-xs font-medium tracking-[0.15em] text-primary uppercase sm:mb-4 sm:text-sm sm:tracking-[0.2em]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-semibold tracking-tight text-balance text-deep-navy sm:text-3xl md:text-4xl lg:text-5xl">
          {title}
        </h2>
        {description && (
          <p className="mt-4 text-base leading-relaxed text-muted sm:mt-5 sm:text-lg md:text-xl">
            {description}
          </p>
        )}
      </div>
    </SectionReveal>
  );
}
