"use client";

import { motion } from "framer-motion";
import { Building2, Mail, MapPin, Radar, TrendingUp, Zap } from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";

const cities = [
  { name: "Antwerp", x: 58, y: 16 },
  { name: "Bruges", x: 20, y: 22 },
  { name: "Ghent", x: 32, y: 34 },
  { name: "Brussels", x: 48, y: 44, hub: true },
  { name: "Liège", x: 78, y: 36 },
  { name: "Charleroi", x: 50, y: 64 },
];

const connections: [number, number][] = [
  [0, 3],
  [1, 2],
  [2, 3],
  [3, 4],
  [3, 5],
  [0, 2],
  [4, 5],
];

const leadCards = [
  {
    name: "TechFlow BVBA",
    sector: "IT Services",
    revenue: "€2.4M",
    location: "Antwerp",
    delay: 0.6,
    position: "top-[8%] right-[4%] sm:right-[6%]",
  },
  {
    name: "Brussels Legal SPRL",
    sector: "Legal Services",
    revenue: "€890K",
    location: "Brussels",
    delay: 1,
    position: "top-[38%] left-[2%] sm:left-[4%]",
    hideOnMobile: true,
  },
  {
    name: "Ghent Manufacturing NV",
    sector: "Manufacturing",
    revenue: "€12.1M",
    location: "Ghent",
    delay: 1.4,
    position: "bottom-[22%] right-[8%] sm:right-[10%]",
  },
];

export function HeroVisualization() {
  const { t } = useTranslations();

  const stats = [
    { label: t("hero.vizCompanies"), value: "2M+", icon: Building2 },
    { label: t("hero.vizMatchRate"), value: "94%", icon: TrendingUp },
    { label: t("hero.vizContacts"), value: "850K+", icon: Mail },
  ];

  return (
    <div className="relative flex h-full min-h-[420px] w-full min-w-0 sm:min-h-[480px] lg:min-h-[580px]">
      <div className="gradient-border relative flex h-full w-full flex-col overflow-hidden rounded-2xl sm:rounded-3xl">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl sm:rounded-3xl">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col p-4 sm:p-5 lg:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="truncate text-xs font-medium text-muted sm:text-sm">
                {t("hero.vizLive")}
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary sm:px-3 sm:text-xs">
              <Radar className="h-3 w-3" />
              {t("hero.vizEngine")}
            </span>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/50 bg-light-bg/60 sm:rounded-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,color-mix(in_srgb,var(--primary-blue)_8%,transparent),transparent_65%)]" />

            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="heroLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="var(--primary-blue)" stopOpacity="0.9" />
                </linearGradient>
                <radialGradient id="heroHubGrad">
                  <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="var(--primary-blue)" stopOpacity="0.4" />
                </radialGradient>
              </defs>

              <motion.ellipse
                cx="48"
                cy="44"
                rx="28"
                ry="22"
                fill="none"
                stroke="url(#heroLineGrad)"
                strokeWidth="0.3"
                strokeDasharray="2 2"
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: 0.35, rotate: 360 }}
                transition={{
                  opacity: { duration: 1 },
                  rotate: { duration: 40, repeat: Infinity, ease: "linear" },
                }}
              />

              {connections.map(([from, to], i) => {
                const a = cities[from];
                const b = cities[to];
                return (
                  <motion.line
                    key={`${from}-${to}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="url(#heroLineGrad)"
                    strokeWidth="0.35"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.45 }}
                    transition={{ duration: 1.2, delay: 0.2 + i * 0.1 }}
                  />
                );
              })}

              {cities.map((city, i) => (
                <g key={city.name}>
                  {city.hub && (
                    <>
                      <motion.circle
                        cx={city.x}
                        cy={city.y}
                        r="6"
                        fill="none"
                        stroke="var(--primary-blue)"
                        strokeWidth="0.3"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
                      />
                      <motion.circle
                        cx={city.x}
                        cy={city.y}
                        r="3.5"
                        fill="url(#heroHubGrad)"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                      />
                    </>
                  )}
                  {!city.hub && (
                    <motion.circle
                      cx={city.x}
                      cy={city.y}
                      r="1.8"
                      fill="var(--primary-blue)"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 0.85 }}
                      transition={{ delay: 0.3 + i * 0.08, type: "spring" }}
                    />
                  )}
                  <motion.text
                    x={city.x}
                    y={city.y + (city.hub ? 6.5 : 5)}
                    textAnchor="middle"
                    className="fill-deep-navy text-[2.8px] font-medium opacity-70 sm:text-[2.5px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.7 }}
                    transition={{ delay: 0.8 + i * 0.05 }}
                  >
                    {city.name}
                  </motion.text>
                </g>
              ))}

              {connections.slice(0, 4).map(([from, to], i) => {
                const a = cities[from];
                const b = cities[to];
                return (
                  <motion.circle
                    key={`pulse-${from}-${to}`}
                    r="0.8"
                    fill="var(--accent-blue)"
                    initial={{ opacity: 0 }}
                    animate={{
                      cx: [a.x, b.x],
                      cy: [a.y, b.y],
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                      duration: 2.5,
                      delay: 1.5 + i * 0.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                );
              })}
            </svg>

            <motion.div
              className="glass absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full px-3 py-1.5 shadow-lg sm:px-4 sm:py-2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <Zap className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
              <span className="whitespace-nowrap text-[10px] font-semibold text-deep-navy sm:text-xs">
                {t("hero.vizScanning")}
              </span>
            </motion.div>

            {leadCards.map((card) => (
              <motion.div
                key={card.name}
                className={`glass absolute max-w-[calc(100%-1.5rem)] rounded-xl p-2.5 shadow-xl sm:max-w-none sm:p-3 ${
                  card.hideOnMobile ? "hidden sm:block" : ""
                } w-[140px] sm:w-[168px] ${card.position}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: [0, -5, 0] }}
                transition={{
                  opacity: { delay: card.delay, duration: 0.6 },
                  y: {
                    delay: card.delay + 1,
                    duration: 4.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-deep-navy sm:text-xs">
                      {card.name}
                    </p>
                    <p className="truncate text-[10px] text-muted">{card.sector}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-1 text-[10px]">
                  <span className="flex min-w-0 items-center gap-0.5 truncate text-muted">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{card.location}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-2.5 w-2.5" />
                    {card.revenue}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="premium-card rounded-xl px-2 py-2.5 text-center sm:px-3 sm:py-3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + i * 0.1, duration: 0.5 }}
              >
                <stat.icon className="mx-auto mb-1 h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
                <p className="text-sm font-bold text-deep-navy sm:text-base">{stat.value}</p>
                <p className="truncate text-[10px] text-muted sm:text-xs">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
