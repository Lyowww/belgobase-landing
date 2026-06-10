"use client";

import { Check, Minus } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-primary" />
    ) : (
      <Minus className="mx-auto h-4 w-4 text-border" />
    );
  }
  return <span className="text-sm text-deep-navy">{value}</span>;
}

function MobilePlanValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="h-4 w-4 shrink-0 text-primary" />
    ) : (
      <Minus className="h-4 w-4 shrink-0 text-border" />
    );
  }
  return <span className="text-sm font-medium text-deep-navy">{value}</span>;
}

export function PlanComparison() {
  const { t } = useTranslations();

  const features = [
    {
      name: t("comparison.companyCount"),
      starter: "500",
      growth: "2,000",
      scale: "5,000",
    },
    {
      name: t("comparison.contactEnrichment"),
      starter: t("comparison.basic"),
      growth: t("comparison.full"),
      scale: t("comparison.premium"),
    },
    {
      name: t("comparison.deliveryTime"),
      starter: t("comparison.hours24"),
      growth: t("comparison.hours"),
      scale: t("comparison.hours4"),
    },
    {
      name: t("comparison.sectorFiltering"),
      starter: true,
      growth: true,
      scale: true,
    },
    {
      name: t("comparison.naceFiltering"),
      starter: false,
      growth: true,
      scale: true,
    },
    {
      name: t("comparison.revenueFilters"),
      starter: false,
      growth: true,
      scale: true,
    },
    {
      name: t("comparison.clientExclusion"),
      starter: true,
      growth: true,
      scale: true,
    },
    {
      name: t("comparison.lookalikeAnalysis"),
      starter: false,
      growth: false,
      scale: true,
    },
    {
      name: t("comparison.dedicatedReview"),
      starter: false,
      growth: false,
      scale: true,
    },
    {
      name: t("comparison.prioritySupport"),
      starter: false,
      growth: true,
      scale: true,
    },
  ];

  const plans = [
    { key: "starter" as const, name: t("pricing.starterName"), highlight: false },
    { key: "growth" as const, name: t("pricing.growthName"), highlight: true },
    { key: "scale" as const, name: t("pricing.scaleName"), highlight: false },
  ];

  return (
    <section
      id="comparison"
      className="noise-overlay relative bg-surface py-16 sm:py-24 md:py-32"
    >
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("comparison.eyebrow")}
          title={t("comparison.title")}
          description={t("comparison.description")}
        />

        <SectionReveal>
          <div className="space-y-4 md:hidden">
            {plans.map((plan) => (
              <div
                key={plan.key}
                className={cn(
                  "premium-card overflow-hidden",
                  plan.highlight && "border-primary bg-primary/5",
                )}
              >
                <div
                  className={cn(
                    "border-b px-4 py-3",
                    plan.highlight
                      ? "border-primary/20 bg-primary/10"
                      : "border-border bg-light-bg/50",
                  )}
                >
                  <h3
                    className={cn(
                      "text-sm font-semibold",
                      plan.highlight ? "text-primary" : "text-deep-navy",
                    )}
                  >
                    {plan.name}
                    {plan.highlight && (
                      <span className="ml-2 text-xs font-normal text-primary/80">
                        · {t("comparison.mostPopularShort")}
                      </span>
                    )}
                  </h3>
                </div>
                <ul className="divide-y divide-border/40">
                  {features.map((feature) => (
                    <li
                      key={feature.name}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="min-w-0 flex-1 text-xs text-muted">
                        {feature.name}
                      </span>
                      <MobilePlanValue value={feature[plan.key]} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionReveal>

        <SectionReveal>
          <div className="premium-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-border bg-light-bg/80">
                    <th className="sticky left-0 z-10 min-w-[180px] bg-light-bg/95 px-4 py-4 text-left text-sm font-semibold text-deep-navy backdrop-blur-sm lg:px-6">
                      {t("comparison.feature")}
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-deep-navy lg:px-6">
                      {t("pricing.starterName")}
                    </th>
                    <th className="relative bg-primary/5 px-4 py-4 text-center text-sm font-semibold text-primary lg:px-6">
                      <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
                      {t("pricing.growthName")}
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-deep-navy lg:px-6">
                      {t("pricing.scaleName")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature, i) => (
                    <tr
                      key={feature.name}
                      className={cn(
                        "border-b border-border/40 transition-colors hover:bg-primary/5",
                        i % 2 === 0 ? "bg-surface" : "bg-light-bg/30",
                      )}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-3 text-sm text-muted lg:px-6 lg:py-4">
                        {feature.name}
                      </td>
                      <td className="px-4 py-3 text-center lg:px-6 lg:py-4">
                        <CellValue value={feature.starter} />
                      </td>
                      <td className="bg-primary/5 px-4 py-3 text-center lg:px-6 lg:py-4">
                        <CellValue value={feature.growth} />
                      </td>
                      <td className="px-4 py-3 text-center lg:px-6 lg:py-4">
                        <CellValue value={feature.scale} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
