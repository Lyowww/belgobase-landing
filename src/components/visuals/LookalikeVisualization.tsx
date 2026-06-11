"use client";

import { m } from "framer-motion";
import {
  ArrowDown,
  Building2,
  ClipboardList,
  Sparkles,
  Zap,
} from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";
import { smoothEase } from "@/lib/motion";

const outputRows = [
  {
    name: "Company A non-profit",
    meta: "Brussels · NACE 91110",
    segment: "International non-profit association",
    score: 10,
    rank: 1,
  },
  {
    name: "Organization B",
    meta: "Brussels · NACE 84110",
    segment: "Public sector",
    score: 9,
    rank: 2,
  },
  {
    name: "Association C non-profit",
    meta: "Ixelles · NACE 94120",
    segment: "Members' association",
    score: 9,
    rank: 3,
  },
  {
    name: "Company D NV",
    meta: "Brussels · NACE 68201",
    segment: "Large NV",
    score: 8,
    rank: 4,
  },
];

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border/50 sm:w-20">
        <m.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: smoothEase }}
        />
      </div>
      <span className="min-w-[2.5rem] text-right text-[11px] font-bold text-primary">
        {score} / {max}
      </span>
    </div>
  );
}

export function LookalikeVisualization() {
  const { t } = useTranslations();

  const sampleRows = [
    { label: t("leadPreview.lookalikeSampleTypeLabel"), value: t("leadPreview.lookalikeSampleTypeValue"), icon: Sparkles },
    { label: t("leadPreview.lookalikeSampleInputLabel"), value: t("leadPreview.lookalikeSampleInputValue"), icon: ClipboardList },
    { label: t("leadPreview.lookalikeSampleGoalLabel"), value: t("leadPreview.lookalikeSampleGoalValue"), icon: Zap },
    { label: t("leadPreview.lookalikeSampleOutputLabel"), value: t("leadPreview.lookalikeSampleOutputValue"), icon: Building2 },
    { label: t("leadPreview.lookalikeSampleDeliveryLabel"), value: t("leadPreview.lookalikeSampleDeliveryValue"), icon: Zap },
  ];

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: smoothEase }}
      className="relative min-w-0"
    >
      <div className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-bl from-amber-500/8 via-transparent to-primary/8 blur-2xl" />

      <div className="gradient-border relative overflow-hidden rounded-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_100%_0%,rgba(251,191,36,0.08),transparent_60%)]" />

        <div className="relative border-b border-border/50 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 ring-1 ring-amber-500/20">
              <ClipboardList className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-deep-navy sm:text-base">
                {t("leadPreview.lookalikeSampleTitle")}
              </h4>
              <p className="mt-0.5 text-xs text-muted">{t("leadPreview.lookalikeSampleSubtitle")}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
            {sampleRows.map((row, i) => (
              <m.div
                key={row.label}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: smoothEase }}
                className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-surface/60 px-3 py-2.5"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/8">
                  <row.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted">{row.label}</p>
                  <p className="truncate text-xs font-medium text-deep-navy">{row.value}</p>
                </div>
              </m.div>
            ))}
          </div>
        </div>

        <div className="relative flex justify-center py-2">
          <div className="flex flex-col items-center gap-0.5">
            <div className="h-6 w-px bg-gradient-to-b from-border to-primary/40" />
            <m.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/20 bg-primary/10"
            >
              <ArrowDown className="h-3.5 w-3.5 text-primary" />
            </m.div>
            <div className="h-6 w-px bg-gradient-to-b from-primary/40 to-border" />
          </div>
        </div>

        <div className="relative border-t border-border/50">
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#1a1f2e] via-[#1e2438] to-[#1a1f2e] px-4 py-2.5 sm:px-5">
            <span className="text-[10px] font-semibold tracking-[0.15em] text-white/90 uppercase">
              {t("leadPreview.lookalikeOutputTitle")}
            </span>
            <span className="shrink-0 rounded-full border border-amber-400/50 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
              {t("leadPreview.lookalikeOutputBadge")}
            </span>
          </div>

          <div className="hidden items-center gap-4 border-b border-border/40 bg-light-bg/30 px-4 py-2 text-[10px] font-semibold tracking-wider text-muted uppercase sm:grid sm:grid-cols-[1fr_1fr_auto] sm:px-5">
            <span>{t("leadPreview.lookalikeOutputColCompany")}</span>
            <span>{t("leadPreview.lookalikeOutputColSegment")}</span>
            <span className="text-right">{t("leadPreview.lookalikeOutputColScore")}</span>
          </div>

          <div className="divide-y divide-border/30">
            {outputRows.map((row, i) => (
              <m.div
                key={row.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.4, ease: smoothEase }}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/[0.03] sm:grid sm:grid-cols-[1fr_1fr_auto] sm:gap-4 sm:px-5 sm:py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/12 to-accent/8 text-[11px] font-bold text-primary ring-1 ring-primary/10">
                    #{row.rank}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-deep-navy sm:text-sm">{row.name}</p>
                    <p className="text-[11px] text-muted">{row.meta}</p>
                  </div>
                </div>

                <p className="hidden truncate text-xs text-deep-navy/80 sm:block">{row.segment}</p>

                <div className="ml-auto shrink-0 sm:ml-0">
                  <ScoreBar score={row.score} />
                </div>

                <p className="col-span-full text-[11px] text-deep-navy/80 sm:hidden">{row.segment}</p>
              </m.div>
            ))}
          </div>
        </div>
      </div>
    </m.div>
  );
}
