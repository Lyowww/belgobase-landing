"use client";

import { Building2, FileSpreadsheet, Landmark, MapPinned } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useTranslations } from "@/providers/TranslationsProvider";

export function SocialProof() {
  const { t } = useTranslations();

  const metrics = [
    { icon: Building2, display: t("socialProof.metric1Value"), label: t("socialProof.metric1Label") },
    { icon: Landmark, display: t("socialProof.metric2Value"), label: t("socialProof.metric2Label") },
    { icon: MapPinned, display: t("socialProof.metric3Value"), label: t("socialProof.metric3Label") },
    { icon: FileSpreadsheet, display: t("socialProof.metric4Value"), label: t("socialProof.metric4Label") },
  ];

  return (
    <section id="social-proof" className="relative bg-surface py-16 sm:py-24 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("socialProof.eyebrow")}
          title={t("socialProof.title")}
          description={t("socialProof.description")}
        />

        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="bg-surface px-5 py-7 sm:px-6 sm:py-8">
              <metric.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-5 text-2xl font-semibold tracking-tight text-deep-navy sm:text-3xl">
                {metric.display}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">{metric.label}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
