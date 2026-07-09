"use client";

import { Check, Minus } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";

function CellValue({
  value,
  label,
}: {
  value: boolean;
  label: string;
}) {
  return (
    <span className="inline-flex items-center justify-center" title={label}>
      {value ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </span>
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-border/30">
          <Minus className="h-4 w-4 text-muted/50" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </span>
      )}
    </span>
  );
}

export function PlanComparison() {
  const { t } = useTranslations();

  const features = [
    {
      name: t("comparison.belgianDatabase"),
      minimum: true,
      plus: true,
      pro: true,
    },
    {
      name: t("comparison.kboFilters"),
      minimum: true,
      plus: true,
      pro: true,
    },
    {
      name: t("comparison.savedSearches"),
      minimum: true,
      plus: true,
      pro: true,
    },
    {
      name: t("comparison.exportLists"),
      minimum: true,
      plus: true,
      pro: true,
    },
    {
      name: t("comparison.clientExclusion"),
      minimum: true,
      plus: true,
      pro: true,
    },
    {
      name: t("comparison.nbbFilters"),
      minimum: false,
      plus: true,
      pro: true,
    },
    {
      name: t("comparison.revenueHeadcount"),
      minimum: false,
      plus: true,
      pro: true,
    },
    {
      name: t("comparison.payrollSignals"),
      minimum: false,
      plus: true,
      pro: true,
    },
    {
      name: t("comparison.contactDiscovery"),
      minimum: false,
      plus: true,
      pro: true,
    },
    {
      name: t("comparison.multiUser"),
      minimum: false,
      plus: false,
      pro: true,
    },
    {
      name: t("comparison.crmSupport"),
      minimum: false,
      plus: false,
      pro: true,
    },
    {
      name: t("comparison.priorityOnboarding"),
      minimum: false,
      plus: false,
      pro: true,
    },
    {
      name: t("comparison.dedicatedSupport"),
      minimum: false,
      plus: false,
      pro: true,
    },
  ];

  const plans = [
    { key: "minimum" as const, name: t("pricing.minimumName"), highlight: false },
    { key: "plus" as const, name: t("pricing.plusName"), highlight: true },
    { key: "pro" as const, name: t("pricing.proName"), highlight: false },
  ];

  const availableLabel = t("comparison.available");
  const unavailableLabel = t("comparison.unavailable");

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
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-primary/5"
                    >
                      <span className="min-w-0 flex-1 text-xs text-muted">
                        {feature.name}
                      </span>
                      <CellValue
                        value={feature[plan.key]}
                        label={feature[plan.key] ? availableLabel : unavailableLabel}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionReveal>

        <SectionReveal>
          <div className="premium-card hidden overflow-hidden md:block">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[560px]">
                <thead className="sticky top-0 z-20">
                  <tr className="border-b border-border bg-light-bg/95 backdrop-blur-md">
                    <th className="sticky left-0 z-30 min-w-[200px] bg-light-bg/95 px-4 py-4 text-left text-sm font-semibold text-deep-navy backdrop-blur-md lg:px-6">
                      {t("comparison.feature")}
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-deep-navy lg:px-6">
                      {t("pricing.minimumName")}
                    </th>
                    <th className="relative bg-primary/5 px-4 py-4 text-center text-sm font-semibold text-primary lg:px-6">
                      <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
                      {t("pricing.plusName")}
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-deep-navy lg:px-6">
                      {t("pricing.proName")}
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
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-3.5 text-sm text-muted lg:px-6 lg:py-4">
                        {feature.name}
                      </td>
                      <td className="px-4 py-3.5 text-center lg:px-6 lg:py-4">
                        <CellValue
                          value={feature.minimum}
                          label={feature.minimum ? availableLabel : unavailableLabel}
                        />
                      </td>
                      <td className="bg-primary/5 px-4 py-3.5 text-center lg:px-6 lg:py-4">
                        <CellValue
                          value={feature.plus}
                          label={feature.plus ? availableLabel : unavailableLabel}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-center lg:px-6 lg:py-4">
                        <CellValue
                          value={feature.pro}
                          label={feature.pro ? availableLabel : unavailableLabel}
                        />
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
