"use client";

import { m } from "framer-motion";
import { ProgressiveContactForm } from "@/components/forms/ProgressiveContactForm";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { AmbientGlow } from "@/components/visuals/AmbientBackground";
import { useTranslations } from "@/providers/TranslationsProvider";
import { smoothEase } from "@/lib/motion";

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
            <m.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: smoothEase }}
              className="mb-3 text-xs font-medium tracking-[0.15em] text-primary uppercase sm:mb-4 sm:text-sm sm:tracking-[0.2em]"
            >
              {t("finalCta.eyebrow")}
            </m.p>
            <m.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.08, ease: smoothEase }}
              className="text-2xl font-semibold tracking-tight text-balance text-deep-navy sm:text-3xl md:text-4xl lg:text-5xl"
            >
              {t("finalCta.title")}
              {t("finalCta.titleHighlight") ? (
                <>
                  {" "}
                  <span className="font-semibold text-gradient-accent">
                    {t("finalCta.titleHighlight")}
                  </span>
                </>
              ) : null}
              {t("finalCta.titleEnd") ? ` ${t("finalCta.titleEnd")}` : null}
            </m.h2>
            <m.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.16, ease: smoothEase }}
              className="mt-4 text-[15px] leading-relaxed text-muted sm:mt-6 sm:text-[17px]"
            >
              {t("finalCta.description")}
            </m.p>
          </SectionReveal>

          <SectionReveal direction="right" delay={0.15}>
            <ProgressiveContactForm variant="default" />
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
