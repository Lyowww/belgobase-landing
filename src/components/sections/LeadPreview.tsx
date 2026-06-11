"use client";

import { motion } from "framer-motion";
import { Building2, BarChart3, Check, Mail } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { StaggerItem, StaggerReveal } from "@/components/ui/StaggerReveal";
import { LeadExplorerVisualization } from "@/components/visuals/LeadExplorerVisualization";
import { LookalikeVisualization } from "@/components/visuals/LookalikeVisualization";
import { useTranslations } from "@/providers/TranslationsProvider";
import { hoverLiftSubtle, smoothEase } from "@/lib/motion";

export function LeadPreview() {
  const { t } = useTranslations();

  const included = [
    {
      icon: Building2,
      title: t("leadPreview.companyDetailsTitle"),
      description: t("leadPreview.companyDetailsDesc"),
    },
    {
      icon: BarChart3,
      title: t("leadPreview.sectorDataTitle"),
      description: t("leadPreview.sectorDataDesc"),
    },
    {
      icon: Mail,
      title: t("leadPreview.contactDetailsTitle"),
      description: t("leadPreview.contactDetailsDesc"),
    },
    {
      icon: BarChart3,
      title: t("leadPreview.companyInsightsTitle"),
      description: t("leadPreview.companyInsightsDesc"),
    },
  ];

  const lookalikeInsights = [
    t("leadPreview.lookalike1"),
    t("leadPreview.lookalike2"),
    t("leadPreview.lookalike3"),
    t("leadPreview.lookalike4"),
    t("leadPreview.lookalike5"),
  ];

  return (
    <section
      id="lead-preview"
      className="section-alt noise-overlay relative py-16 sm:py-24 md:py-32"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[10%] left-[8%] h-48 w-48 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute right-[6%] bottom-[12%] h-56 w-56 rounded-full bg-accent/8 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("leadPreview.eyebrow")}
          title={t("leadPreview.title")}
          description={t("leadPreview.description")}
        />

        <div className="grid min-w-0 items-start gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-12">
          <SectionReveal direction="left">
            <h3 className="mb-3 text-base font-semibold text-deep-navy sm:mb-4 sm:text-lg">
              {t("leadPreview.includedTitle")}
            </h3>
            <StaggerReveal className="grid gap-3 sm:grid-cols-2">
              {included.map((item) => (
                <StaggerItem key={item.title}>
                  <motion.div
                    whileHover={hoverLiftSubtle}
                    className="premium-card rounded-xl p-3.5 sm:p-4"
                  >
                    <item.icon className="mb-2 h-4 w-4 text-primary" />
                    <h4 className="mb-0.5 text-sm font-semibold text-deep-navy">
                      {item.title}
                    </h4>
                    <p className="text-xs leading-relaxed text-muted">
                      {item.description}
                    </p>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerReveal>
          </SectionReveal>

          <SectionReveal direction="right" delay={0.1}>
            <LeadExplorerVisualization />
          </SectionReveal>
        </div>

        <div className="my-8 h-px bg-border/50 sm:my-10" />

        <div className="grid min-w-0 items-start gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-12">
          <SectionReveal direction="left" delay={0.05}>
            <div className="premium-card rounded-xl p-4 sm:p-5">
              <h3 className="mb-1.5 text-base font-semibold text-deep-navy sm:text-lg">
                {t("leadPreview.lookalikeTitle")}
              </h3>
              <p className="mb-4 text-sm text-muted">
                {t("leadPreview.lookalikeDescription")}
              </p>
              <p className="mb-2.5 text-xs font-medium tracking-wider text-primary uppercase">
                {t("leadPreview.lookalikeEyebrow")}
              </p>
              <ul className="space-y-2">
                {lookalikeInsights.map((insight, i) => (
                  <motion.li
                    key={insight}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05, duration: 0.35, ease: smoothEase }}
                    className="flex items-start gap-2 text-sm text-deep-navy"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                      <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    <span>{insight}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </SectionReveal>

          <SectionReveal direction="right" delay={0.1}>
            <LookalikeVisualization />
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
