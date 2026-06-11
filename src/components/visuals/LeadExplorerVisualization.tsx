"use client";

import { motion } from "framer-motion";
import { Filter, Mail, MapPin, Phone, Search } from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";
import { smoothEase } from "@/lib/motion";

const sampleRows = [
  {
    name: "InnoTech Solutions BVBA",
    vat: "BE 0123.456.789",
    sector: "62.01 - Software",
    city: "Leuven",
    email: "info@innotech.be",
    phone: "+32 16 123 456",
    match: 98,
  },
  {
    name: "Capital Advisory SPRL",
    vat: "BE 0987.654.321",
    sector: "69.20 - Accounting",
    city: "Brussels",
    email: "contact@capitaladv.be",
    phone: "+32 2 456 7890",
    match: 96,
  },
  {
    name: "Flanders Logistics NV",
    vat: "BE 0456.789.012",
    sector: "49.41 - Freight",
    city: "Antwerp",
    email: "sales@flogistics.be",
    phone: "+32 3 234 5678",
    match: 94,
  },
  {
    name: "Ghent Digital NV",
    vat: "BE 0654.321.098",
    sector: "62.02 - IT consultancy",
    city: "Ghent",
    email: "growth@ghentdigital.be",
    phone: "+32 9 876 5432",
    match: 91,
  },
];

export function LeadExplorerVisualization() {
  const { t } = useTranslations();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: smoothEase }}
      className="premium-card min-w-0 overflow-hidden shadow-lg shadow-primary/5"
    >
      <div className="flex items-center gap-3 border-b border-border/60 bg-light-bg/80 px-4 py-2.5 sm:px-5 sm:py-3">
        <div className="flex shrink-0 gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <span className="truncate text-xs font-medium text-muted">
          {t("leadPreview.explorerTitle")}
        </span>
        <span className="ml-auto hidden items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 sm:inline-flex dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {t("leadPreview.liveLabel")}
        </span>
      </div>

      <div className="border-b border-border/40 px-3 py-2.5 sm:px-4">
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-xs text-muted">
              {t("leadPreview.searchPlaceholder")}
            </span>
          </div>
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-muted"
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("leadPreview.filters")}</span>
          </button>
        </div>
      </div>

      <div className="divide-y divide-border/30 sm:hidden">
        {sampleRows.map((row, i) => (
          <motion.div
            key={row.vat}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
            className="px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-deep-navy">{row.name}</p>
              <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {row.match}%
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">{row.vat}</p>
            <p className="mt-1.5 text-xs text-deep-navy">{row.sector}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <MapPin className="h-3 w-3 shrink-0" />
              {row.city}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/30 pt-2 text-xs">
              <span className="flex items-center gap-1 text-deep-navy">
                <Mail className="h-3 w-3 shrink-0 text-primary" />
                {row.email}
              </span>
              <span className="flex items-center gap-1 text-muted">
                <Phone className="h-3 w-3 shrink-0" />
                {row.phone}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-light-bg/50 text-xs text-muted">
              <th className="px-4 py-2 font-medium">{t("leadPreview.tableCompany")}</th>
              <th className="px-4 py-2 font-medium">{t("leadPreview.tableSector")}</th>
              <th className="px-4 py-2 font-medium">{t("leadPreview.tableContact")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("leadPreview.tableMatch")}</th>
            </tr>
          </thead>
          <tbody>
            {sampleRows.map((row, i) => (
              <motion.tr
                key={row.vat}
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="border-b border-border/30 transition-colors hover:bg-primary/5"
              >
                <td className="px-4 py-2.5">
                  <p className="text-sm font-medium text-deep-navy">{row.name}</p>
                  <p className="text-xs text-muted">{row.vat}</p>
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-xs text-deep-navy">{row.sector}</p>
                  <p className="flex items-center gap-1 text-xs text-muted">
                    <MapPin className="h-3 w-3" />
                    {row.city}
                  </p>
                </td>
                <td className="px-4 py-2.5">
                  <p className="flex items-center gap-1 text-xs text-deep-navy">
                    <Mail className="h-3 w-3 shrink-0 text-primary" />
                    {row.email}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <Phone className="h-3 w-3 shrink-0" />
                    {row.phone}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="inline-flex rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {row.match}%
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 bg-light-bg/50 px-4 py-2 text-[11px] text-muted sm:text-xs">
        <span>{t("leadPreview.showingMatches")}</span>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
          {t("leadPreview.dataCompleteness")}
        </span>
      </div>
    </motion.div>
  );
}
