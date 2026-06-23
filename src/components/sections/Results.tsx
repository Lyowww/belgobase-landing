"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  DatabaseEstimateForm,
  INDUSTRY_OPTIONS,
} from "@/components/forms/DatabaseEstimateForm";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";

const STAT_BOXES = [
  { key: "it", labelKey: "database.statIt" as const, count: "45,700+" },
  { key: "realEstate", labelKey: "database.statRealEstate" as const, count: "43,000+" },
  { key: "dropdown", labelKey: null, count: null },
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
    <div className="flex min-h-[88px] flex-col justify-center rounded-xl border border-white/8 bg-[#222222] px-4 py-3.5 sm:min-h-[96px] sm:px-5 sm:py-4">
      <p className="text-xs text-zinc-400 sm:text-sm">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {count}
        <span className="ml-1.5 text-sm font-normal text-zinc-500">
          {availableLabel}
        </span>
      </p>
    </div>
  );
}

function InlineIndustrySelect({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex min-h-[88px] flex-col justify-center rounded-xl border border-white/8 bg-[#222222] px-4 py-3.5 sm:min-h-[96px] sm:px-5 sm:py-4">
      <label htmlFor="database-inline-industry" className="sr-only">
        {placeholder}
      </label>
      <select
        id="database-inline-industry"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full appearance-none bg-transparent pr-6 text-sm font-medium outline-none",
          value ? "text-white" : "text-zinc-500",
        )}
      >
        <option value="" disabled className="bg-[#222222] text-zinc-500">
          {placeholder}
        </option>
        {INDUSTRY_OPTIONS.map((option) => (
          <option key={option} value={option} className="bg-[#222222] text-white">
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-5 h-4 w-4 -translate-y-1/2 text-zinc-500 sm:right-6"
        aria-hidden
      />
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
          <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-2xl shadow-black/30 sm:rounded-3xl">
            <div className="px-5 py-6 sm:px-8 sm:py-8">
              <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                {t("database.cardTitle")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:text-base">
                {t("database.cardDescription")}
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:mt-8 lg:grid-cols-5">
                {STAT_BOXES.map((box) =>
                  box.key === "dropdown" ? (
                    <InlineIndustrySelect
                      key={box.key}
                      value={industry}
                      onChange={setIndustry}
                      placeholder={t("database.inlineIndustryPlaceholder")}
                    />
                  ) : (
                    <StatBox
                      key={box.key}
                      label={t(box.labelKey!)}
                      count={box.count!}
                      availableLabel={t("database.available")}
                    />
                  ),
                )}
              </div>
            </div>

            <div className="border-t border-white/8 px-5 py-6 sm:px-8 sm:py-8">
              <DatabaseEstimateForm industry={industry} onIndustryChange={setIndustry} />
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
