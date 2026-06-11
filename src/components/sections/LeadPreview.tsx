"use client";

import { m } from "framer-motion";
import { Building2, BarChart3, Check, Mail, Sparkles } from "lucide-react";
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
      icon: Sparkles,
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
      className="section-alt noise-overlay relative overflow-hidden py-16 sm:py-24 md:py-32"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[8%] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/6 blur-3xl" />
        <div className="absolute top-[35%] -left-16 h-56 w-56 rounded-full bg-accent/6 blur-3xl" />
        <div className="absolute right-0 bottom-[20%] h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("leadPreview.eyebrow")}
          title={t("leadPreview.title")}
          description={t("leadPreview.description")}
        />

        <SectionReveal className="mx-auto mb-10 max-w-5xl sm:mb-14">
          <LeadExplorerVisualization />
        </SectionReveal>

        <SectionReveal delay={0.05}>
          <div className="mb-3 text-center sm:mb-5">
            <h3 className="text-base font-semibold text-deep-navy sm:text-lg">
              {t("leadPreview.includedTitle")}
            </h3>
          </div>
          <StaggerReveal className="mx-auto grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {included.map((item) => (
              <StaggerItem key={item.title}>
                <m.div
                  whileHover={hoverLiftSubtle}
                  className="premium-card flex h-full flex-col items-center rounded-xl p-4 text-center sm:p-5"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/12 to-accent/8 ring-1 ring-primary/10">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h4 className="mb-1 text-sm font-semibold text-deep-navy">{item.title}</h4>
                  <p className="text-xs leading-relaxed text-muted">{item.description}</p>
                </m.div>
              </StaggerItem>
            ))}
          </StaggerReveal>
        </SectionReveal>

        <div className="my-12 h-px bg-border/50 sm:my-16" />

        <div className="grid min-w-0 items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <SectionReveal direction="left" delay={0.05}>
            <div className="premium-card relative overflow-hidden rounded-2xl p-5 sm:p-6">
              <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/8 blur-2xl" />

              <h3 className="mb-2 text-base font-semibold text-deep-navy sm:text-lg">
                {t("leadPreview.lookalikeTitle")}
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-muted">
                {t("leadPreview.lookalikeDescription")}
              </p>

              <p className="mb-3 text-xs font-semibold tracking-wider text-primary uppercase">
                {t("leadPreview.lookalikeEyebrow")}
              </p>

              <ul className="space-y-2.5">
                {lookalikeInsights.map((insight, i) => (
                  <m.li
                    key={insight}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05, duration: 0.35, ease: smoothEase }}
                    className="flex items-center gap-3 rounded-lg border border-border/30 bg-light-bg/50 px-3 py-2.5 text-sm text-deep-navy"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
                      <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    <span>{insight}</span>
                  </m.li>
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
