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
    <SectionReveal className={cn("mb-16 md:mb-20", className)}>
      <div
        className={cn(
          "max-w-3xl",
          align === "center" && "mx-auto text-center",
        )}
      >
        {eyebrow && (
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </p>
        )}
        <h2 className="text-3xl font-semibold tracking-tight text-deep-navy md:text-4xl lg:text-5xl">
          {title}
        </h2>
        {description && (
          <p className="mt-5 text-lg leading-relaxed text-muted md:text-xl">
            {description}
          </p>
        )}
      </div>
    </SectionReveal>
  );
}
