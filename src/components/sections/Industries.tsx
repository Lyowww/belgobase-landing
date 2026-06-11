"use client";

import { m } from "framer-motion";
import { Rocket, Briefcase, Building, X } from "lucide-react";
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

  const notFit = [
    t("industries.notFit1"),
    t("industries.notFit2"),
    t("industries.notFit3"),
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
                <p className="mb-5 text-sm text-muted">{industry.subtitle}</p>
                <ul className="space-y-2">
                  {industry.benefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-center gap-2 text-sm text-deep-navy"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        ✓
                      </span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </m.div>
            </SectionReveal>
          ))}
        </div>

        <SectionReveal>
          <div className="premium-card rounded-2xl border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-5 sm:p-8 md:p-10">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                <X className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-deep-navy">
                {t("industries.notFitTitle")}
              </h3>
            </div>
            <ul className="grid gap-3 md:grid-cols-3">
              {notFit.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-muted"
                >
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
