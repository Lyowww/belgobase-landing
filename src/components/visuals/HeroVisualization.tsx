"use client";

import { motion } from "framer-motion";
import { Building2, Mail, MapPin, TrendingUp } from "lucide-react";

const floatingCards = [
  {
    name: "TechFlow BVBA",
    sector: "IT Services",
    revenue: "€2.4M",
    location: "Antwerp",
    delay: 0,
    hideOnMobile: false,
  },
  {
    name: "Brussels Legal SPRL",
    sector: "Legal Services",
    revenue: "€890K",
    location: "Brussels",
    delay: 0.5,
    hideOnMobile: true,
  },
  {
    name: "Ghent Manufacturing NV",
    sector: "Manufacturing",
    revenue: "€12.1M",
    location: "Ghent",
    delay: 1,
    hideOnMobile: false,
  },
];

const nodes = [
  { cx: 50, cy: 50, r: 4 },
  { cx: 150, cy: 80, r: 5 },
  { cx: 250, cy: 45, r: 4 },
  { cx: 100, cy: 150, r: 6 },
  { cx: 200, cy: 130, r: 4 },
  { cx: 280, cy: 170, r: 5 },
  { cx: 60, cy: 220, r: 4 },
  { cx: 180, cy: 240, r: 5 },
  { cx: 300, cy: 100, r: 4 },
];

const connections = [
  [0, 1], [1, 2], [0, 3], [3, 4], [4, 5], [3, 6], [4, 7], [2, 8], [5, 8], [1, 4],
];

export function HeroVisualization() {
  return (
    <div className="relative h-[min(360px,70vw)] w-full min-w-0 sm:h-[420px] lg:h-[560px]">
      <div className="absolute inset-0 rounded-xl border border-border/60 bg-white/40 shadow-2xl shadow-primary/5 backdrop-blur-sm sm:rounded-2xl">
        <div className="absolute inset-0 overflow-hidden rounded-xl sm:rounded-2xl">
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative flex h-full min-w-0 flex-col p-3 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate text-[11px] font-medium text-muted sm:text-xs">
                Live · 2M+ KBO Companies
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary sm:px-2.5 sm:py-1 sm:text-xs">
              Intelligence Engine
            </span>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border/40 bg-light-bg/50 sm:rounded-xl">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 340 280"
              preserveAspectRatio="xMidYMid slice"
            >
              {connections.map(([from, to], i) => (
                <motion.line
                  key={i}
                  x1={nodes[from].cx}
                  y1={nodes[from].cy}
                  x2={nodes[to].cx}
                  y2={nodes[to].cy}
                  stroke="url(#lineGradient)"
                  strokeWidth="1"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 1.5, delay: i * 0.1 }}
                />
              ))}
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4DA3FF" />
                  <stop offset="100%" stopColor="#0A66C2" />
                </linearGradient>
              </defs>
              {nodes.map((node, i) => (
                <motion.circle
                  key={i}
                  cx={node.cx}
                  cy={node.cy}
                  r={node.r}
                  fill="#0A66C2"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.8 }}
                  transition={{ delay: 0.3 + i * 0.08, type: "spring" }}
                />
              ))}
            </svg>

            {floatingCards.map((card, i) => (
              <motion.div
                key={card.name}
                className={`glass absolute max-w-[calc(100%-1rem)] rounded-lg p-2 shadow-lg sm:max-w-none sm:rounded-xl sm:p-3 ${
                  card.hideOnMobile ? "hidden sm:block" : ""
                } w-[130px] sm:w-[160px] md:w-[180px]`}
                style={{
                  top: `${12 + i * (card.hideOnMobile ? 35 : 22)}%`,
                  right: i % 2 === 0 ? "4%" : "20%",
                  left: i === 2 ? "4%" : undefined,
                }}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0, y: [0, -6, 0] }}
                transition={{
                  opacity: { delay: 0.8 + card.delay, duration: 0.6 },
                  x: { delay: 0.8 + card.delay, duration: 0.6 },
                  y: {
                    delay: 2 + card.delay,
                    duration: 4 + i,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }}
              >
                <div className="flex items-start gap-1.5 sm:gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 sm:h-7 sm:w-7 sm:rounded-lg">
                    <Building2 className="h-3 w-3 text-primary sm:h-3.5 sm:w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-semibold text-deep-navy sm:text-xs">
                      {card.name}
                    </p>
                    <p className="truncate text-[9px] text-muted sm:text-[10px]">
                      {card.sector}
                    </p>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-1 text-[9px] sm:mt-2 sm:text-[10px]">
                  <span className="flex min-w-0 items-center gap-0.5 truncate text-muted">
                    <MapPin className="h-2 w-2 shrink-0 sm:h-2.5 sm:w-2.5" />
                    <span className="truncate">{card.location}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 font-medium text-emerald-600">
                    <TrendingUp className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                    {card.revenue}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:gap-3">
            {[
              { label: "Companies", value: "2M+", icon: Building2 },
              { label: "Match Rate", value: "94%", icon: TrendingUp },
              { label: "Contacts", value: "850K+", icon: Mail },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-md border border-border/50 bg-white/60 px-1.5 py-1.5 text-center sm:rounded-lg sm:px-3 sm:py-2"
              >
                <stat.icon className="mx-auto mb-0.5 h-3 w-3 text-primary sm:mb-1 sm:h-3.5 sm:w-3.5" />
                <p className="text-xs font-semibold text-deep-navy sm:text-sm">
                  {stat.value}
                </p>
                <p className="truncate text-[9px] text-muted sm:text-[10px]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
