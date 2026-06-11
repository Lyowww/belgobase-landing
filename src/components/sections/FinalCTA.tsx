"use client";

import { ProgressiveContactForm } from "@/components/forms/ProgressiveContactForm";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { AmbientGlow } from "@/components/visuals/AmbientBackground";
import { useTranslations } from "@/providers/TranslationsProvider";

export function FinalCTA() {
  const { t } = useTranslations();

  return (
    <section
      id="contact"
      className="cta-section noise-overlay relative overflow-hidden py-16 sm:py-24 md:py-32"
    >
      <AmbientGlow className="left-1/2 top-1/2 h-[min(700px,90vw)] w-[min(700px,90vw)] -translate-x-1/2 -translate-y-1/2" />
      <div
        className="cta-radial-pulse pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid min-w-0 items-start gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionReveal direction="left">
            <p className="mb-3 text-xs font-medium tracking-[0.15em] text-primary uppercase sm:mb-4 sm:text-sm sm:tracking-[0.2em]">
              {t("finalCta.eyebrow")}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-deep-navy sm:text-3xl md:text-4xl lg:text-5xl">
              {t("finalCta.title")}{" "}
              <span className="font-semibold text-gradient-accent">
                {t("finalCta.titleHighlight")}
              </span>{" "}
              {t("finalCta.titleEnd")}
            </h2>
            <p className="mt-4 text-sm text-muted sm:mt-6 sm:text-base">
              {t("finalCta.description")}
            </p>
            <p className="mt-6 text-lg font-semibold text-gradient-accent sm:mt-8 sm:text-xl">
              {t("finalCta.tagline")}
            </p>
          </SectionReveal>

          <SectionReveal direction="right" delay={0.15}>
            <ProgressiveContactForm variant="default" />
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
