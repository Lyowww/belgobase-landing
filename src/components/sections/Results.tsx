"use client";

import { m } from "framer-motion";
import { TrendingUp, Clock, Target, Users } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";
import { hoverLiftSubtle } from "@/lib/motion";

export function Results() {
  const { t } = useTranslations();

  const results = [
    {
      icon: TrendingUp,
      metric: 72,
      suffix: "%",
      label: t("results.engagementLabel"),
      description: t("results.engagementDesc"),
    },
    {
      icon: Clock,
      metric: 80,
      suffix: "%",
      label: t("results.timeLabel"),
      description: t("results.timeDesc"),
    },
    {
      icon: Target,
      metric: 94,
      suffix: "%",
      label: t("results.accuracyLabel"),
      description: t("results.accuracyDesc"),
    },
    {
      icon: Users,
      metric: 3,
      suffix: "x",
      label: t("results.meetingsLabel"),
      description: t("results.meetingsDesc"),
    },
  ];

  return (
    <section id="results" className="noise-overlay relative bg-surface py-16 sm:py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("results.eyebrow")}
          title={t("results.title")}
          description={t("results.description")}
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((result, i) => (
            <SectionReveal key={result.label} delay={i * 0.1}>
              <m.div
                whileHover={hoverLiftSubtle}
                className="premium-card group h-full rounded-2xl bg-gradient-to-b from-card to-light-bg/50 p-5 sm:p-8"
              >
                <m.div
                  whileHover={{ scale: 1.08, rotate: 3 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15"
                >
                  <result.icon className="h-5 w-5 text-primary" />
                </m.div>
                <p className="text-3xl font-semibold tracking-tight text-deep-navy sm:text-4xl">
                  <AnimatedCounter value={result.metric} suffix={result.suffix} />
                </p>
                <p className="mt-2 text-sm font-semibold text-deep-navy">
                  {result.label}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {result.description}
                </p>
              </m.div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
