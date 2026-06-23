"use client";

import { useState } from "react";
import {
  DatabaseEstimateForm,
} from "@/components/forms/DatabaseEstimateForm";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";

const STAT_BOXES = [
  { key: "it", labelKey: "database.statIt" as const, count: "45,700+" },
  { key: "realEstate", labelKey: "database.statRealEstate" as const, count: "43,000+" },
  { key: "horeca", labelKey: "database.statHoreca" as const, count: "56,500+" },
  {
    key: "marketing",
    labelKey: "database.statMarketing" as const,
    count: "13,600+",
  },
] as const;

function StatBox({
  label,
  count,
  availableLabel,
}: {
  label: string;
  count: string;
  availableLabel: string;
}) {
  return (
    <div className="premium-card flex min-h-[5.5rem] flex-col justify-center rounded-xl px-4 py-3.5 sm:min-h-[6rem] sm:px-5 sm:py-4">
      <p className="text-xs text-muted sm:text-sm">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-deep-navy sm:text-2xl">
        {count}
        <span className="ml-1.5 text-xs font-normal text-muted sm:text-sm">
          {availableLabel}
        </span>
      </p>
    </div>
  );
}

export function Results() {
  const { t } = useTranslations();
  const [industry, setIndustry] = useState("");

  return (
    <section id="database" className="noise-overlay relative bg-surface py-16 sm:py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("database.eyebrow")}
          title={t("database.title")}
          description={t("database.description")}
        />

        <SectionReveal delay={0.1}>
          <div className="form-surface mx-auto max-w-4xl rounded-2xl sm:rounded-3xl">
            <div className="px-5 py-6 sm:px-8 sm:py-8">
              <h3 className="text-lg font-semibold tracking-tight text-deep-navy sm:text-xl">
                {t("database.cardTitle")}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                {t("database.cardDescription")}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-4">
                {STAT_BOXES.map((box) => (
                  <StatBox
                    key={box.key}
                    label={t(box.labelKey)}
                    count={box.count}
                    availableLabel={t("database.available")}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-border px-5 py-6 sm:px-8 sm:py-8">
              <DatabaseEstimateForm industry={industry} onIndustryChange={setIndustry} />
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
