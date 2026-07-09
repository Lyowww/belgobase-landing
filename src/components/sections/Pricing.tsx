"use client";

import { m } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";

export function Pricing() {
  const { t } = useTranslations();

  const plans = [
    {
      key: "minimum",
      name: t("pricing.minimumName"),
      tag: t("pricing.minimumTag"),
      price: t("pricing.minimumPrice"),
      priceSuffix: t("pricing.minimumPriceSuffix"),
      description: t("pricing.minimumDesc"),
      includesLabel: null as string | null,
      features: [
        t("pricing.minimumFeature1"),
        t("pricing.minimumFeature2"),
        t("pricing.minimumFeature3"),
        t("pricing.minimumFeature4"),
        t("pricing.minimumFeature5"),
      ],
      popular: false,
      cta: t("pricing.minimumCta"),
    },
    {
      key: "plus",
      name: t("pricing.plusName"),
      tag: null as string | null,
      price: t("pricing.plusPrice"),
      priceSuffix: null as string | null,
      description: t("pricing.plusDesc"),
      includesLabel: t("pricing.plusIncludes"),
      features: [
        t("pricing.plusFeature1"),
        t("pricing.plusFeature2"),
        t("pricing.plusFeature3"),
        t("pricing.plusFeature4"),
        t("pricing.plusFeature5"),
      ],
      popular: true,
      cta: t("pricing.plusCta"),
    },
    {
      key: "pro",
      name: t("pricing.proName"),
      tag: null as string | null,
      price: t("pricing.proPrice"),
      priceSuffix: null as string | null,
      description: t("pricing.proDesc"),
      includesLabel: t("pricing.proIncludes"),
      features: [
        t("pricing.proFeature1"),
        t("pricing.proFeature2"),
        t("pricing.proFeature3"),
        t("pricing.proFeature4"),
        t("pricing.proFeature5"),
      ],
      popular: false,
      cta: t("pricing.proCta"),
    },
  ];

  return (
    <section id="pricing" className="section-alt noise-overlay relative py-16 sm:py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("pricing.eyebrow")}
          title={t("pricing.title")}
          description={t("pricing.description")}
        />

        <div className="grid items-stretch gap-6 sm:gap-8 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <SectionReveal key={plan.key} delay={i * 0.12} className="h-full">
              <m.div
                whileHover={{ y: -10, scale: plan.popular ? 1.02 : 1.01 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "pricing-card relative flex h-full flex-col rounded-2xl p-5 sm:p-8",
                  plan.popular ? "pricing-popular mt-6 pt-8 sm:mt-0 sm:pt-8" : "glass premium-card",
                )}
              >
                {(plan.popular || plan.tag) && (
                  <div className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2">
                    <m.span
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-primary/40"
                    >
                      {plan.popular && <Sparkles className="h-3 w-3" />}
                      {plan.popular ? t("pricing.mostPopular") : plan.tag}
                    </m.span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-deep-navy">{plan.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{plan.description}</p>
                </div>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight text-deep-navy sm:text-4xl">
                    {plan.price}
                  </span>
                  {plan.priceSuffix ? (
                    <span className="text-sm font-medium text-muted">{plan.priceSuffix}</span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col">
                  {plan.includesLabel && (
                    <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">
                      {plan.includesLabel}
                    </p>
                  )}
                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.features.map((feature) => (
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
                    variant={plan.popular ? "primary" : "secondary"}
                    className="mt-auto w-full"
                  >
                    {plan.cta}
                  </MagneticButton>
                </div>
              </m.div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
