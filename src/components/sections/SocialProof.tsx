"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";

const logos = [
  "Deloitte Partners",
  "Flanders Tech",
  "Brussels Growth Co.",
  "Antwerp Digital",
  "Wallonia SaaS",
  "Benelux Advisory",
];

export function SocialProof() {
  const { t } = useTranslations();

  const metrics = [
    { value: 500, suffix: "+", label: t("socialProof.metricBusinesses") },
    { value: 2, suffix: "M+", label: t("socialProof.metricCompanies") },
    { value: 150000, suffix: "+", label: t("socialProof.metricLeads") },
    { value: 94, suffix: "%", label: t("socialProof.metricSatisfaction") },
  ];

  const testimonials = [
    {
      quote: t("socialProof.testimonial1Quote"),
      author: t("socialProof.testimonial1Author"),
      role: t("socialProof.testimonial1Role"),
      rating: 5,
    },
    {
      quote: t("socialProof.testimonial2Quote"),
      author: t("socialProof.testimonial2Author"),
      role: t("socialProof.testimonial2Role"),
      rating: 5,
    },
    {
      quote: t("socialProof.testimonial3Quote"),
      author: t("socialProof.testimonial3Author"),
      role: t("socialProof.testimonial3Role"),
      rating: 5,
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
                  <AnimatedCounter value={metric.value} suffix={metric.suffix} />
                </p>
                <p className="mt-1.5 text-xs text-muted sm:mt-2 sm:text-sm">
                  {metric.label}
                </p>
              </div>
            </SectionReveal>
          ))}
        </div>

        <SectionReveal>
          <div className="mb-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 opacity-60 sm:mb-16 sm:gap-x-10 sm:gap-y-6">
            {logos.map((logo) => (
              <span
                key={logo}
                className="text-center text-xs font-medium tracking-wide text-deep-navy/70 uppercase sm:text-sm"
              >
                {logo}
              </span>
            ))}
          </div>
        </SectionReveal>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, i) => (
            <SectionReveal key={testimonial.author} delay={i * 0.15}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="gradient-border group h-full rounded-2xl p-5 sm:p-6"
              >
                <Quote className="mb-4 h-8 w-8 text-primary/20" />
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: testimonial.rating }).map((_, j) => (
                    <Star
                      key={j}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="mb-6 text-sm leading-relaxed text-muted">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div>
                  <p className="text-sm font-semibold text-deep-navy">
                    {testimonial.author}
                  </p>
                  <p className="text-xs text-muted">{testimonial.role}</p>
                </div>
              </motion.div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
