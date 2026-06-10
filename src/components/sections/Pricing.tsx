"use client";

import { motion } from "framer-motion";
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
      name: t("pricing.starterName"),
      price: "€299",
      period: t("pricing.perList"),
      leads: t("pricing.starterLeads"),
      description: t("pricing.starterDesc"),
      features: [
        t("pricing.starterFeature1"),
        t("pricing.starterFeature2"),
        t("pricing.starterFeature3"),
        t("pricing.starterFeature4"),
        t("pricing.starterFeature5"),
      ],
      popular: false,
    },
    {
      name: t("pricing.growthName"),
      price: "€799",
      period: t("pricing.perList"),
      leads: t("pricing.growthLeads"),
      description: t("pricing.growthDesc"),
      features: [
        t("pricing.growthFeature1"),
        t("pricing.growthFeature2"),
        t("pricing.growthFeature3"),
        t("pricing.growthFeature4"),
        t("pricing.growthFeature5"),
        t("pricing.growthFeature6"),
      ],
      popular: true,
    },
    {
      name: t("pricing.scaleName"),
      price: "€1,499",
      period: t("pricing.perList"),
      leads: t("pricing.scaleLeads"),
      description: t("pricing.scaleDesc"),
      features: [
        t("pricing.scaleFeature1"),
        t("pricing.scaleFeature2"),
        t("pricing.scaleFeature3"),
        t("pricing.scaleFeature4"),
        t("pricing.scaleFeature5"),
        t("pricing.scaleFeature6"),
      ],
      popular: false,
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

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <SectionReveal key={plan.name} delay={i * 0.12}>
              <motion.div
                whileHover={{ y: -8 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "relative h-full rounded-2xl p-5 sm:p-8",
                  plan.popular
                    ? "pricing-popular mt-4 pt-8 sm:mt-0 sm:pt-8"
                    : "premium-card",
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-white shadow-lg shadow-primary/30">
                      <Sparkles className="h-3 w-3" />
                      {t("pricing.mostPopular")}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-deep-navy">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted">{plan.leads}</p>
                </div>

                <div className="mb-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight text-deep-navy sm:text-4xl">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted">{plan.period}</span>
                </div>
                <p className="mb-8 text-sm text-muted">{plan.description}</p>

                <ul className="mb-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-deep-navy"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <MagneticButton
                  href="#contact"
                  variant={plan.popular ? "primary" : "secondary"}
                  className="w-full"
                >
                  {t("pricing.getStarted")}
                </MagneticButton>
              </motion.div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
