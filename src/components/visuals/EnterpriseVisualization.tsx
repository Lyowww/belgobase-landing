"use client";

import { m } from "framer-motion";
import { Building2, Network, Phone, UserRound, Users } from "lucide-react";
import { useActiveInView } from "@/hooks/useActiveInView";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";
import { useTranslations } from "@/providers/TranslationsProvider";

const orbitNodes = [
  { role: "CEO", angle: -70, radius: 38, delay: 0.3 },
  { role: "CFO", angle: -10, radius: 42, delay: 0.45 },
  { role: "CTO", angle: 50, radius: 36, delay: 0.6 },
  { role: "VP Sales", angle: 110, radius: 40, delay: 0.75 },
  { role: "Board", angle: 170, radius: 37, delay: 0.9 },
  { role: "COO", angle: 230, radius: 41, delay: 1.05 },
];

const executiveCards = [
  {
    name: "Lorem Ipsum",
    role: "Lorem ipsum",
    company: "Lorem ipsum dolor",
    signal: "Lorem ipsum",
    delay: 0.8,
    position: "top-[10%] right-[4%] sm:right-[6%]",
  },
  {
    name: "Lorem Ipsum",
    role: "Dolor sit",
    company: "Consectetur elit",
    signal: "Lorem ipsum",
    delay: 1.1,
    position: "top-[42%] left-[2%] sm:left-[4%]",
    hideOnMobile: true,
  },
  {
    name: "Lorem Ipsum",
    role: "Sed eiusmod",
    company: "Ut labore et",
    signal: "Lorem ipsum",
    delay: 1.4,
    position: "bottom-[14%] right-[6%] sm:right-[8%]",
  },
];

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

export function EnterpriseVisualization() {
  const { t } = useTranslations();
  const { ref, active } = useActiveInView();
  const { reduceMotionEffects, reduceVisualEffects } = usePerformanceMode();
  const hub = { x: 50, y: 50 };

  const stats = [
    { label: t("enterprise.vizExecutives"), value: "X+", icon: UserRound },
    { label: t("enterprise.vizConnections"), value: "X", icon: Network },
    { label: t("enterprise.vizDirectLines"), value: "X", icon: Phone },
  ];

  const cardSurface = reduceVisualEffects
    ? "border border-white/15 bg-[#0d1528]/95"
    : "border border-white/15 bg-[#0d1528]/90 backdrop-blur-md";

  return (
    <div ref={ref} className="viz-container relative w-full">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-1 mobile-backdrop-none backdrop-blur-sm">
        <div className="relative h-[18rem] overflow-hidden rounded-xl sm:h-[22rem] md:h-[26rem]">
          <div className="pointer-events-none absolute inset-0">
            <div
              className={`absolute -top-16 right-0 h-48 w-48 rounded-full bg-primary/20 ${
                reduceVisualEffects ? "mobile-blur-soft opacity-50" : "blur-3xl"
              }`}
            />
            <div
              className={`absolute -bottom-12 left-0 h-40 w-40 rounded-full bg-accent/15 ${
                reduceVisualEffects ? "mobile-blur-soft opacity-50" : "blur-3xl"
              }`}
            />
          </div>

          <div className="relative flex h-full flex-col p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  {!reduceMotionEffects && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
                  )}
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                <span className="truncate text-xs font-medium text-white/60 sm:text-sm">
                  {t("enterprise.vizLive")}
                </span>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-accent sm:px-3 sm:text-xs">
                <Users className="h-3 w-3" />
                {t("enterprise.vizEngine")}
              </span>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#0a1020]/80">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(77,163,255,0.12),transparent_65%)]" />

              {active && !reduceMotionEffects && (
                <>
                  <m.div
                    className="gpu-layer absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/20"
                    animate={{ rotate: 360, scale: [1, 1.04, 1] }}
                    transition={{
                      rotate: { duration: 28, repeat: Infinity, ease: "linear" },
                      scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                    }}
                  />
                  <m.div
                    className="gpu-layer absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-primary/20"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
                  />
                  <m.div
                    className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <m.div
                    className="gpu-layer absolute left-1/2 top-1/2 h-28 w-28 origin-bottom -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent 0deg, rgba(77,163,255,0.25) 40deg, transparent 80deg)",
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  />
                </>
              )}

              {!active && !reduceMotionEffects && (
                <>
                  <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/20" />
                  <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-primary/20" />
                  <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5 opacity-40" />
                </>
              )}

              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="enterpriseLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4DA3FF" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#0A66C2" stopOpacity="0.9" />
                  </linearGradient>
                  <radialGradient id="enterpriseHubGrad">
                    <stop offset="0%" stopColor="#4DA3FF" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#0A66C2" stopOpacity="0.35" />
                  </radialGradient>
                </defs>

                {orbitNodes.map((node, i) => {
                  const pos = polarToCartesian(hub.x, hub.y, node.radius, node.angle);
                  return (
                    <g key={node.role}>
                      <m.line
                        x1={hub.x}
                        y1={hub.y}
                        x2={pos.x}
                        y2={pos.y}
                        stroke="url(#enterpriseLineGrad)"
                        strokeWidth="0.35"
                        initial={{ pathLength: 0, opacity: 0 }}
                        whileInView={{ pathLength: 1, opacity: 0.5 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: node.delay }}
                      />
                      {active && !reduceMotionEffects && (
                          <m.circle
                            r="0.7"
                            fill="#4DA3FF"
                            initial={{ opacity: 0 }}
                            animate={{
                              cx: [hub.x, pos.x],
                              cy: [hub.y, pos.y],
                              opacity: [0, 1, 1, 0],
                            }}
                            transition={{
                              duration: 2.2,
                              delay: 1.2 + i * 0.35,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        )}
                      <m.circle
                        cx={pos.x}
                        cy={pos.y}
                        r="2.2"
                        fill="#0A66C2"
                        stroke="#4DA3FF"
                        strokeWidth="0.4"
                        initial={{ scale: 0, opacity: 0 }}
                        whileInView={{ scale: 1, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: node.delay, type: "spring", stiffness: 220 }}
                      />
                      {active && !reduceMotionEffects && (
                        <m.circle
                          cx={pos.x}
                          cy={pos.y}
                          r="3.5"
                          fill="none"
                          stroke="#4DA3FF"
                          strokeWidth="0.2"
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                          transition={{
                            duration: 2.5,
                            delay: node.delay + 0.5,
                            repeat: Infinity,
                            ease: "easeOut",
                          }}
                        />
                      )}
                    </g>
                  );
                })}

                {active && !reduceMotionEffects ? (
                  <m.circle
                    cx={hub.x}
                    cy={hub.y}
                    r="5"
                    fill="none"
                    stroke="#4DA3FF"
                    strokeWidth="0.35"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
                  />
                ) : (
                  <circle
                    cx={hub.x}
                    cy={hub.y}
                    r="5"
                    fill="none"
                    stroke="#4DA3FF"
                    strokeWidth="0.35"
                    opacity={0.3}
                  />
                )}
                <m.circle
                  cx={hub.x}
                  cy={hub.y}
                  r="3.2"
                  fill="url(#enterpriseHubGrad)"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                />
              </svg>

              <m.div
                className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-2xl px-3 py-2 shadow-[0_0_24px_rgba(77,163,255,0.2)] sm:px-4 sm:py-2.5 ${
                  reduceVisualEffects
                    ? "border border-white/15 bg-[#0d1528]/95"
                    : "border border-white/15 bg-white/10 backdrop-blur-md"
                }`}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.35, duration: 0.6 }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 sm:h-9 sm:w-9">
                  <Building2 className="h-4 w-4 text-accent sm:h-5 sm:w-5" />
                </div>
                <span className="whitespace-nowrap text-[10px] font-semibold text-white sm:text-xs">
                  {t("enterprise.vizTarget")}
                </span>
              </m.div>

              {executiveCards.map((card, index) => (
                <m.div
                  key={`${card.role}-${index}`}
                  className={`absolute max-w-[calc(100%-1.5rem)] rounded-xl p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:max-w-none sm:p-3 ${
                    card.hideOnMobile ? "hidden sm:block" : ""
                  } w-[148px] sm:w-[172px] ${card.position} ${cardSurface}`}
                  initial={{ opacity: 0, y: 16, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  animate={
                    active && !reduceMotionEffects
                      ? { y: [0, -6, 0] }
                      : { y: 0 }
                  }
                  transition={{
                    opacity: { delay: card.delay, duration: 0.6 },
                    y:
                      active && !reduceMotionEffects
                        ? {
                            delay: card.delay + 1,
                            duration: 5,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }
                        : { duration: 0.3 },
                    scale: { delay: card.delay, duration: 0.6 },
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                      <UserRound className="h-3.5 w-3.5 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-white sm:text-xs">
                        {card.name}
                      </p>
                      <p className="truncate text-[10px] text-white/50">{card.role}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-1 text-[10px]">
                    <span className="truncate text-white/45">{card.company}</span>
                    <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 font-medium text-accent">
                      {card.signal}
                    </span>
                  </div>
                </m.div>
              ))}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#060a14] via-[#060a14]/60 to-transparent px-4 pb-3 pt-10">
                <p className="text-center text-[10px] font-medium text-white/45 sm:text-xs">
                  {t("enterprise.networkLabel")}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
              {stats.map((stat, i) => (
                <m.div
                  key={stat.label}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5 text-center sm:px-3 sm:py-3"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.3 + i * 0.1, duration: 0.5 }}
                >
                  <stat.icon className="mx-auto mb-1 h-3.5 w-3.5 text-accent sm:h-4 sm:w-4" />
                  <p className="text-sm font-bold text-white sm:text-base">{stat.value}</p>
                  <p className="line-clamp-2 text-[10px] leading-tight text-white/45 sm:text-xs">
                    {stat.label}
                  </p>
                </m.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
