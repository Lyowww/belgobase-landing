"use client";

import { m } from "framer-motion";
import { Rocket, Briefcase, Building } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";

export function Industries() {
  const { t } = useTranslations();

  const industries = [
    {
      icon: Rocket,
      title: t("industries.salesTitle"),
      subtitle: t("industries.salesSubtitle"),
      benefits: [t("industries.salesBenefit1"), t("industries.salesBenefit2")],
    },
    {
      icon: Briefcase,
      title: t("industries.serviceTitle"),
      subtitle: t("industries.serviceSubtitle"),
      benefits: [t("industries.serviceBenefit1"), t("industries.serviceBenefit2")],
    },
    {
      icon: Building,
      title: t("industries.localTitle"),
      subtitle: t("industries.localSubtitle"),
      benefits: [t("industries.localBenefit1"), t("industries.localBenefit2")],
    },
  ];

  return (
    <section id="industries" className="noise-overlay relative bg-surface py-16 sm:py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("industries.eyebrow")}
          title={t("industries.title")}
          description={t("industries.description")}
        />

        <div className="mb-12 grid gap-6 md:grid-cols-3">
          {industries.map((industry, i) => (
            <SectionReveal key={industry.title} delay={i * 0.12}>
              <m.div
                whileHover={{ y: -6, scale: 1.01 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="gradient-border group h-full rounded-2xl p-5 sm:p-8"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 transition-all group-hover:from-primary/20 group-hover:to-accent/20">
                  <industry.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-deep-navy">
                  {industry.title}
                </h3>
                <p className="mb-5 text-base leading-7 text-muted">{industry.subtitle}</p>
                <ul className="space-y-2">
                  {industry.benefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-center gap-2 text-sm text-deep-navy"
                    >
                      {benefit}
                    </li>
                  ))}
                </ul>
              </m.div>
            </SectionReveal>
          ))}
        </div>


      </div>
    </section>
  );
}
