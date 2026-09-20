"use client";

import { m } from "framer-motion";
import { Building2, BarChart3, FileSpreadsheet, Sparkles } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { StaggerItem, StaggerReveal } from "@/components/ui/StaggerReveal";
import { LeadExplorerVisualization } from "@/components/visuals/LeadExplorerVisualization";
import { useTranslations } from "@/providers/TranslationsProvider";
import { hoverLiftSubtle } from "@/lib/motion";

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
      icon: FileSpreadsheet,
      title: t("leadPreview.contactDetailsTitle"),
      description: t("leadPreview.contactDetailsDesc"),
    },
    {
      icon: Sparkles,
      title: t("leadPreview.companyInsightsTitle"),
      description: t("leadPreview.companyInsightsDesc"),
    },
  ];

  return (
    <section
      id="lead-preview"
      className="section-alt relative overflow-hidden py-16 sm:py-24 md:py-28"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("leadPreview.eyebrow")}
          title={t("leadPreview.title")}
          description={t("leadPreview.description")}
        />

        <SectionReveal className="mx-auto mb-10 max-w-6xl sm:mb-14">
          <LeadExplorerVisualization />
        </SectionReveal>

        <SectionReveal delay={0.05}>
          <div className="mb-3 text-center sm:mb-5">
            <h3 className="text-base font-semibold text-deep-navy sm:text-lg">
              {t("leadPreview.includedTitle")}
            </h3>
          </div>
          <StaggerReveal className="mx-auto grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {included.map((item) => (
              <StaggerItem key={item.title}>
                <m.div
                  whileHover={hoverLiftSubtle}
                  className="flex h-full flex-col items-start rounded-xl border border-border bg-surface p-5 text-left shadow-[0_12px_32px_-28px_rgba(15,35,70,0.55)]"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/12 to-accent/8 ring-1 ring-primary/10">
                    <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <h4 className="mb-1 text-sm font-semibold text-deep-navy">{item.title}</h4>
                  <p className="text-xs leading-relaxed text-muted">{item.description}</p>
                </m.div>
              </StaggerItem>
            ))}
          </StaggerReveal>
        </SectionReveal>
      </div>
    </section>
  );
}
