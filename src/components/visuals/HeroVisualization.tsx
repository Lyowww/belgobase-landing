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
  },
  {
    name: "Brussels Legal SPRL",
    sector: "Legal Services",
    revenue: "€890K",
    location: "Brussels",
    delay: 0.5,
  },
  {
    name: "Ghent Manufacturing NV",
    sector: "Manufacturing",
    revenue: "€12.1M",
    location: "Ghent",
    delay: 1,
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
    <div className="relative h-[480px] w-full lg:h-[560px]">
      <div className="absolute inset-0 rounded-2xl border border-border/60 bg-white/40 shadow-2xl shadow-primary/5 backdrop-blur-sm">
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative flex h-full flex-col p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-muted">
                Live · 2M+ KBO Companies
              </span>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              Intelligence Engine
            </span>
          </div>

          <div className="relative flex-1 overflow-hidden rounded-xl border border-border/40 bg-light-bg/50">
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
                className="glass absolute w-[180px] rounded-xl p-3 shadow-lg"
                style={{
                  top: `${15 + i * 28}%`,
                  right: i % 2 === 0 ? "8%" : "25%",
                }}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0, y: [0, -6, 0] }}
                transition={{
                  opacity: { delay: 0.8 + card.delay, duration: 0.6 },
                  x: { delay: 0.8 + card.delay, duration: 0.6 },
                  y: { delay: 2 + card.delay, duration: 4 + i, repeat: Infinity, ease: "easeInOut" },
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-deep-navy">
                      {card.name}
                    </p>
                    <p className="text-[10px] text-muted">{card.sector}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-0.5 text-muted">
                    <MapPin className="h-2.5 w-2.5" />
                    {card.location}
                  </span>
                  <span className="flex items-center gap-0.5 font-medium text-emerald-600">
                    <TrendingUp className="h-2.5 w-2.5" />
                    {card.revenue}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Companies", value: "2M+", icon: Building2 },
              { label: "Match Rate", value: "94%", icon: TrendingUp },
              { label: "Contacts", value: "850K+", icon: Mail },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-border/50 bg-white/60 px-3 py-2 text-center"
              >
                <stat.icon className="mx-auto mb-1 h-3.5 w-3.5 text-primary" />
                <p className="text-sm font-semibold text-deep-navy">{stat.value}</p>
                <p className="text-[10px] text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
