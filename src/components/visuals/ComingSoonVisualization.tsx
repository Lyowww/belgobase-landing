"use client";

import { m } from "framer-motion";
import { Building2, Mail, Radar, Sparkles, TrendingUp } from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";

const orbitDots = [
  { angle: 0, delay: 0 },
  { angle: 72, delay: 0.4 },
  { angle: 144, delay: 0.8 },
  { angle: 216, delay: 1.2 },
  { angle: 288, delay: 1.6 },
];

export function ComingSoonVisualization() {
  const { t } = useTranslations();

  const stats = [
    { label: t("hero.vizCompanies"), value: "2M+", icon: Building2 },
    { label: t("hero.vizMatchRate"), value: "94%", icon: TrendingUp },
    { label: t("hero.vizContacts"), value: "850K+", icon: Mail },
  ];

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="gradient-border premium-card relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--glow-primary),transparent_55%)]"
          aria-hidden="true"
        />

        <div className="relative flex flex-col items-center">
          <div className="relative flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
            <m.div
              className="absolute inset-0 rounded-full border border-primary/15"
              animate={{ rotate: 360 }}
              transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
            />
            <m.div
              className="absolute inset-4 rounded-full border border-dashed border-accent/25"
              animate={{ rotate: -360 }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            />
            <m.div
              className="absolute inset-8 rounded-full bg-primary/5"
              animate={{ scale: [1, 1.04, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            {orbitDots.map((dot) => (
              <m.div
                key={dot.angle}
                className="absolute h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--glow-accent)]"
                style={{
                  transform: `rotate(${dot.angle}deg) translateY(-72px)`,
                }}
                animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1.1, 0.85] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: dot.delay,
                }}
              />
            ))}

            <div className="glass relative z-10 flex h-24 w-24 flex-col items-center justify-center rounded-2xl shadow-lg shadow-primary/10 sm:h-28 sm:w-28">
              <Radar className="h-8 w-8 text-primary sm:h-9 sm:w-9" />
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted sm:text-xs">
                {t("comingSoon.vizLabel")}
              </span>
            </div>
          </div>

          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-6 flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-sm font-medium text-primary"
          >
            <Sparkles className="h-4 w-4" />
            {t("comingSoon.vizStatus")}
          </m.div>

          <div className="mt-8 grid w-full grid-cols-3 gap-3">
            {stats.map((stat, index) => (
              <m.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
                className="glass rounded-xl px-2 py-3 text-center sm:px-3 sm:py-4"
              >
                <stat.icon className="mx-auto mb-1.5 h-4 w-4 text-primary sm:h-5 sm:w-5" />
                <p className="text-base font-bold text-deep-navy sm:text-lg">{stat.value}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted sm:text-xs">
                  {stat.label}
                </p>
              </m.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
