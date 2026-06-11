"use client";

import { m } from "framer-motion";
import {
  Building2,
  Database,
  Filter,
  Mail,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
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
    initials: "IS",
  },
  {
    name: "Capital Advisory SPRL",
    vat: "BE 0987.654.321",
    sector: "69.20 - Accounting",
    city: "Brussels",
    email: "contact@capitaladv.be",
    phone: "+32 2 456 7890",
    match: 96,
    initials: "CA",
  },
  {
    name: "Flanders Logistics NV",
    vat: "BE 0456.789.012",
    sector: "49.41 - Freight",
    city: "Antwerp",
    email: "sales@flogistics.be",
    phone: "+32 3 234 5678",
    match: 94,
    initials: "FL",
  },
  {
    name: "Ghent Digital NV",
    vat: "BE 0654.321.098",
    sector: "62.02 - IT consultancy",
    city: "Ghent",
    email: "growth@ghentdigital.be",
    phone: "+32 9 876 5432",
    match: 91,
    initials: "GD",
  },
];

function MatchRing({ match, size = 52 }: { match: number; size?: number }) {
  const stroke = 3;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (match / 100) * circumference;

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-border/60"
        />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#matchGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2, ease: smoothEase }}
        />
        <defs>
          <linearGradient id="matchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary-blue)" />
            <stop offset="100%" stopColor="var(--accent-blue)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-[11px] font-bold text-primary">{match}%</span>
    </div>
  );
}

function LeadCard({ row, index }: { row: (typeof sampleRows)[0]; index: number }) {
  return (
    <m.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: smoothEase }}
      whileHover={{ y: -3, transition: { duration: 0.25 } }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-surface/80 p-3.5 backdrop-blur-sm transition-shadow hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 sm:p-4"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-accent/[0.03] opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 text-xs font-bold text-primary ring-1 ring-primary/10">
          {row.initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-deep-navy">{row.name}</p>
          <p className="mt-0.5 text-[11px] text-muted">{row.vat}</p>
        </div>
        <MatchRing match={row.match} size={48} />
      </div>

      <div className="relative mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
          <Building2 className="h-3 w-3" />
          {row.sector}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-border/40 px-2 py-0.5 text-[10px] text-muted">
          <MapPin className="h-3 w-3" />
          {row.city}
        </span>
      </div>

      <div className="relative mt-3 grid grid-cols-1 gap-1 border-t border-border/40 pt-3 sm:grid-cols-2">
        <span className="flex items-center gap-1.5 truncate text-[11px] text-deep-navy">
          <Mail className="h-3 w-3 shrink-0 text-primary" />
          <span className="truncate">{row.email}</span>
        </span>
        <span className="flex items-center gap-1.5 truncate text-[11px] text-muted">
          <Phone className="h-3 w-3 shrink-0" />
          <span className="truncate">{row.phone}</span>
        </span>
      </div>
    </m.article>
  );
}

export function LeadExplorerVisualization() {
  const { t } = useTranslations();

  const stats = [
    { label: t("leadPreview.statCompanies"), value: "1,247", icon: Target },
    { label: t("leadPreview.statMatchRate"), value: "94%", icon: Sparkles },
    { label: t("leadPreview.statFields"), value: "18+", icon: Database },
  ];

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: smoothEase }}
      className="relative min-w-0"
    >
      <div className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-accent/10 blur-2xl" />

      <div className="gradient-border relative overflow-hidden rounded-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--glow-primary),transparent_70%)]" />

        <div className="relative border-b border-border/50 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-md shadow-primary/20">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-deep-navy">
                  {t("leadPreview.explorerTitle")}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    {t("leadPreview.liveLabel")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/60 bg-light-bg/80 px-3 py-2.5 shadow-inner shadow-black/[0.02]">
              <Search className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate text-xs text-muted">{t("leadPreview.searchPlaceholder")}</span>
            </div>
            <button
              type="button"
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border/60 bg-surface px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:border-primary/30 hover:text-primary"
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("leadPreview.filters")}</span>
            </button>
          </div>
        </div>

        <div className="relative grid grid-cols-3 divide-x divide-border/40 border-b border-border/40 bg-light-bg/40">
          {stats.map((stat, i) => (
            <m.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease: smoothEase }}
              className="flex flex-col items-center justify-center px-2 py-4 text-center sm:py-5"
            >
              <stat.icon className="mb-1.5 h-3.5 w-3.5 text-primary/70" />
              <p className="text-lg font-bold tracking-tight text-deep-navy sm:text-xl">{stat.value}</p>
              <p className="mt-0.5 text-[10px] font-medium text-muted sm:text-[11px]">{stat.label}</p>
            </m.div>
          ))}
        </div>

        <div className="relative p-3 sm:p-4">
          <div className="mb-3 hidden items-center justify-between px-1 sm:flex">
            <span className="text-[10px] font-semibold tracking-wider text-muted uppercase">
              {t("leadPreview.tableCompany")}
            </span>
            <div className="flex gap-6 text-[10px] font-semibold tracking-wider text-muted uppercase">
              <span>{t("leadPreview.tableSector")}</span>
              <span>{t("leadPreview.tableContact")}</span>
              <span>{t("leadPreview.tableMatch")}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
            {sampleRows.map((row, i) => (
              <LeadCard key={row.vat} row={row} index={i} />
            ))}
          </div>
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-light-bg/50 px-4 py-3 text-[11px] text-muted sm:px-5 sm:text-xs">
          <span>{t("leadPreview.showingMatches")}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t("leadPreview.dataCompleteness")}
          </span>
        </div>
      </div>
    </m.div>
  );
}
