"use client";

import { m } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";

export function Pricing() {
  const { t } = useTranslations();

  const features = [
    t("pricing.packageFeature1"),
    t("pricing.packageFeature2"),
    t("pricing.packageFeature3"),
    t("pricing.packageFeature4"),
    t("pricing.packageFeature5"),
    t("pricing.packageFeature6"),
    t("pricing.packageFeature7"),
    t("pricing.packageFeature8"),
  ];

  return (
    <section id="pricing" className="section-alt noise-overlay relative py-16 sm:py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("pricing.eyebrow")}
          title={t("pricing.title")}
          description={t("pricing.description")}
        />

        <div className="mx-auto max-w-4xl pt-6">
          <SectionReveal className="h-full">
            <m.div
              whileHover={{ y: -8, scale: 1.01 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="pricing-card pricing-popular relative flex h-full flex-col rounded-2xl p-5 pt-8 sm:p-10 sm:pt-10"
            >
              <div className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2">
                <m.span
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-primary/40"
                >
                  <Sparkles className="h-3 w-3" />
                  {t("pricing.packageBadge")}
                </m.span>
              </div>

              <div className="mb-6 text-center">
                <h3 className="text-xl font-semibold text-deep-navy sm:text-2xl">
                  {t("pricing.packageName")}
                </h3>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                  {t("pricing.packageDescription")}
                </p>
              </div>

              <div className="mb-7 text-center">
                <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
                  <span className="text-4xl font-semibold tracking-tight text-deep-navy sm:text-5xl">
                    {t("pricing.packagePrice")}
                  </span>
                  <span className="text-sm font-medium text-muted sm:text-base">
                    {t("pricing.packagePriceSuffix")}
                  </span>
                </div>
                <p className="mt-3 font-semibold text-primary">
                  {t("pricing.packagePayment")}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t("pricing.packageRecurring")}
                </p>
              </div>

              <div className="flex flex-1 flex-col">
                <p className="mb-4 text-center text-xs font-medium tracking-wide text-muted uppercase">
                  {t("pricing.packageIncludes")}
                </p>
                <ul className="mb-8 grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  {features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-deep-navy"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-3 w-3 text-primary" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <MagneticButton
                  href="#contact"
                  variant="primary"
                  className="mx-auto mt-auto w-full sm:max-w-sm"
                >
                  {t("pricing.packageCta")}
                </MagneticButton>
              </div>
            </m.div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
