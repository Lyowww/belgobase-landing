"use client";

import { motion } from "framer-motion";
import { ClipboardList } from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";
import { smoothEase } from "@/lib/motion";

const outputRows = [
  {
    name: "Company A non-profit",
    meta: "Brussels · NACE 91110",
    segment: "International non-profit association",
    score: 10,
  },
  {
    name: "Organization B",
    meta: "Brussels · NACE 84110",
    segment: "Public sector",
    score: 9,
  },
  {
    name: "Association C non-profit",
    meta: "Ixelles · NACE 94120",
    segment: "Members' association",
    score: 9,
  },
  {
    name: "Company D NV",
    meta: "Brussels · NACE 68201",
    segment: "Large NV",
    score: 8,
  },
];

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
      {score} / 10
    </span>
  );
}

export function LookalikeVisualization() {
  const { t } = useTranslations();

  const sampleRows = [
    { label: t("leadPreview.lookalikeSampleTypeLabel"), value: t("leadPreview.lookalikeSampleTypeValue") },
    { label: t("leadPreview.lookalikeSampleInputLabel"), value: t("leadPreview.lookalikeSampleInputValue") },
    { label: t("leadPreview.lookalikeSampleGoalLabel"), value: t("leadPreview.lookalikeSampleGoalValue") },
    { label: t("leadPreview.lookalikeSampleOutputLabel"), value: t("leadPreview.lookalikeSampleOutputValue") },
    { label: t("leadPreview.lookalikeSampleDeliveryLabel"), value: t("leadPreview.lookalikeSampleDeliveryValue") },
  ];

  return (
    <div className="flex flex-col gap-3">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, ease: smoothEase }}
        className="premium-card overflow-hidden rounded-xl border border-border/60 bg-surface"
      >
        <div className="border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
              <ClipboardList className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-deep-navy">
                {t("leadPreview.lookalikeSampleTitle")}
              </h4>
              <p className="text-xs text-muted">{t("leadPreview.lookalikeSampleSubtitle")}</p>
            </div>
          </div>
        </div>

        <dl className="divide-y divide-border/40">
          {sampleRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <dt className="text-xs text-muted">{row.label}</dt>
              <dd className="text-right text-xs font-medium text-deep-navy">{row.value}</dd>
            </div>
          ))}
        </dl>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay: 0.08, ease: smoothEase }}
        className="premium-card overflow-hidden rounded-xl border border-border/60 bg-surface"
      >
        <div className="flex items-center justify-between gap-2 bg-[#1a1f2e] px-4 py-2">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-white/90 uppercase">
            {t("leadPreview.lookalikeOutputTitle")}
          </span>
          <span className="shrink-0 rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            {t("leadPreview.lookalikeOutputBadge")}
          </span>
        </div>

        <div className="hidden sm:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border/50 bg-[#f5f0e8]/80 dark:bg-[#1e2438]/80">
                <th className="px-4 py-2 text-[10px] font-semibold tracking-wider text-muted uppercase">
                  {t("leadPreview.lookalikeOutputColCompany")}
                </th>
                <th className="px-3 py-2 text-[10px] font-semibold tracking-wider text-muted uppercase">
                  {t("leadPreview.lookalikeOutputColSegment")}
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold tracking-wider text-muted uppercase">
                  {t("leadPreview.lookalikeOutputColScore")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {outputRows.map((row) => (
                <tr key={row.name} className="transition-colors hover:bg-primary/[0.03]">
                  <td className="px-4 py-2">
                    <p className="text-xs font-semibold text-deep-navy">{row.name}</p>
                    <p className="text-[11px] text-muted">{row.meta}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-deep-navy/80">{row.segment}</td>
                  <td className="px-3 py-2 text-right">
                    <ScoreBadge score={row.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-border/40 sm:hidden">
          {outputRows.map((row) => (
            <div
              key={row.name}
              className="flex items-start justify-between gap-2 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-deep-navy">{row.name}</p>
                <p className="text-[11px] text-muted">{row.meta}</p>
                <p className="mt-1 text-[11px] text-deep-navy/80">{row.segment}</p>
              </div>
              <ScoreBadge score={row.score} />
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
