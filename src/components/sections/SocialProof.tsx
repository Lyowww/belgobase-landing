"use client";

import { m } from "framer-motion";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";

export function SocialProof() {
  const { t } = useTranslations();

  const metrics = [
    { display: t("socialProof.metric1Value"), label: t("socialProof.metric1Label") },
    { display: t("socialProof.metric2Value"), label: t("socialProof.metric2Label") },
    { display: t("socialProof.metric3Value"), label: t("socialProof.metric3Label") },
    { display: t("socialProof.metric4Value"), label: t("socialProof.metric4Label") },
  ];

  const testimonials = [
    {
      quote: t("socialProof.testimonial1Quote"),
      author: t("socialProof.testimonial1Author"),
      role: t("socialProof.testimonial1Role"),
    },
    {
      quote: t("socialProof.testimonial2Quote"),
      author: t("socialProof.testimonial2Author"),
      role: t("socialProof.testimonial2Role"),
    },
    {
      quote: t("socialProof.testimonial3Quote"),
      author: t("socialProof.testimonial3Author"),
      role: t("socialProof.testimonial3Role"),
    },
  ];

  return (
    <section id="social-proof" className="noise-overlay relative bg-surface py-16 sm:py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("socialProof.eyebrow")}
          title={t("socialProof.title")}
          description={t("socialProof.description")}
        />

        <div className="mb-12 grid grid-cols-2 gap-4 sm:mb-20 sm:gap-6 md:grid-cols-4">
          {metrics.map((metric, i) => (
            <SectionReveal key={metric.label} delay={i * 0.1}>
              <div className="text-center">
                <p className="text-2xl font-semibold tracking-tight text-deep-navy sm:text-3xl md:text-4xl">
                  {metric.display}
                </p>
                <p className="mt-1.5 line-clamp-2 px-0.5 text-xs leading-tight text-muted sm:mt-2 sm:px-0 sm:text-sm">
                  {metric.label}
                </p>
              </div>
            </SectionReveal>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, i) => (
            <SectionReveal key={i} delay={i * 0.15}>
              <m.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="gradient-border group h-full rounded-2xl p-5 sm:p-6"
              >
                <p className="mb-6 text-sm leading-relaxed text-muted">
                  {testimonial.quote}
                </p>
                <div>
                  <p className="text-sm font-semibold text-deep-navy">
                    {testimonial.author}
                  </p>
                  <p className="text-xs text-muted">{testimonial.role}</p>
                </div>
              </m.div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
