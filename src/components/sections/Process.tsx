"use client";

import { ClipboardList, Euro, FileSpreadsheet } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useTranslations } from "@/providers/TranslationsProvider";

export function Process() {
  const { t } = useTranslations();

  const steps = [
    {
      number: "01",
      label: t("process.step1Label"),
      icon: ClipboardList,
      title: t("process.step1Title"),
      description: t("process.step1Description"),
    },
    {
      number: "02",
      label: t("process.step2Label"),
      icon: Euro,
      title: t("process.step2Title"),
      description: t("process.step2Description"),
    },
    {
      number: "03",
      label: t("process.step3Label"),
      icon: FileSpreadsheet,
      title: t("process.step3Title"),
      description: t("process.step3Description"),
    },
  ];

  return (
    <section id="process" className="section-alt relative py-16 sm:py-24 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("process.eyebrow")}
          title={t("process.title")}
          description={t("process.description")}
        />

        <ol className="grid gap-4 md:grid-cols-3 md:gap-5">
          {steps.map((step) => (
            <li
              key={step.number}
              className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-[0_16px_40px_-32px_rgba(15,35,70,0.45)] sm:p-7"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                  {step.number} · {step.label}
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
                  <step.icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <h3 className="mt-8 text-xl font-semibold tracking-tight text-deep-navy sm:text-2xl">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted sm:text-base sm:leading-7">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
