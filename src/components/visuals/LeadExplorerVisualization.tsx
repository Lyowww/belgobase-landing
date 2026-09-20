"use client";

import Image from "next/image";
import { BarChart3, FileSpreadsheet, Landmark } from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";

export function LeadExplorerVisualization() {
  const { locale } = useTranslations();
  const copy =
    locale === "nl"
      ? {
          eyebrow: "Echte productweergave",
          title: "Financiële bedrijfsanalyse in BelgoBase",
          caption: "Echte BelgoBase-interface met duidelijk fictieve voorbeeldgegevens.",
          badges: ["NBB-jaarrekeningen", "Financiële kerncijfers", "Export naar Excel"],
        }
      : {
          eyebrow: "Actual product view",
          title: "Company financial analysis in BelgoBase",
          caption:
            "Genuine BelgoBase interface with clearly fictional example data; interface shown in Dutch.",
          badges: ["NBB annual accounts", "Financial indicators", "Excel export"],
        };
  const icons = [Landmark, BarChart3, FileSpreadsheet];

  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_70px_-38px_rgba(9,31,72,0.65)] sm:rounded-3xl">
      <div className="flex flex-col gap-5 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{copy.eyebrow}</p>
          <h3 className="mt-1.5 text-lg font-semibold text-deep-navy sm:text-xl">{copy.title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {copy.badges.map((badge, index) => {
            const Icon = icons[index];
            return (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-light-bg px-2.5 py-1.5 text-[11px] font-medium text-muted"
              >
                <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {badge}
              </span>
            );
          })}
        </div>
      </div>

      <div className="bg-[#e8edf4] p-1.5 sm:p-2.5">
        <Image
          src="/product/belgobase-financial.webp"
          alt={locale === "nl" ? "BelgoBase-bedrijfsfiche met omzet, resultaat, VTE en historische grafiek; fictieve voorbeeldcijfers" : "BelgoBase company profile with revenue, profit, FTE and historical chart; fictional example figures"}
          width={1600}
          height={1000}
          sizes="(min-width: 1280px) 1024px, (min-width: 768px) 88vw, 94vw"
          className="h-auto w-full rounded-lg border border-black/5"
        />
      </div>

      <figcaption className="border-t border-border px-5 py-3 text-center text-xs leading-5 text-muted sm:px-7 sm:text-sm">
        {copy.caption}
      </figcaption>
    </figure>
  );
}
