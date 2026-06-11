"use client";

import { m } from "framer-motion";
import { MapPin, RefreshCw, UserCheck } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { FloatingToolbar } from "@/components/layout/FloatingToolbar";
import { Header } from "@/components/layout/Header";
import { AmbientGlow, AnimatedGrid } from "@/components/visuals/AmbientBackground";
import { ComingSoonVisualization } from "@/components/visuals/ComingSoonVisualization";
import { useMousePosition } from "@/hooks/useMousePosition";
import { useTranslations } from "@/providers/TranslationsProvider";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ComingSoon() {
  const { t } = useTranslations();
  const { x, y, enabled } = useMousePosition();

  const highlights = [
    {
      icon: UserCheck,
      label: t("hero.trustNoSignup"),
      sub: t("hero.trustNoSignupSub"),
    },
    {
      icon: RefreshCw,
      label: t("hero.trustUpdated"),
      sub: t("hero.trustUpdatedSub"),
    },
    {
      icon: MapPin,
      label: t("hero.trustBelgium"),
      sub: t("hero.trustBelgiumSub"),
    },
  ];

  return (
    <>
      <Header variant="comingSoon" />
      <FloatingToolbar />

      <div className="noise-overlay mesh-hero relative min-h-screen overflow-hidden">
        <AnimatedGrid />
        <AmbientGlow className="left-[8%] top-[12%] h-[380px] w-[380px]" color="accent" />
        <AmbientGlow className="right-[6%] top-[8%] h-[320px] w-[320px]" color="primary" />
        <AmbientGlow className="bottom-[10%] left-[35%] h-[280px] w-[280px]" color="accent" />

        {enabled && (
          <m.div
            className="pointer-events-none absolute h-[280px] w-[280px] rounded-full bg-accent/8 blur-[80px] will-change-transform sm:h-[420px] sm:w-[420px] sm:blur-[100px]"
            animate={{ x: x * 0.02 - 140, y: y * 0.02 - 140 }}
            transition={{ type: "spring", stiffness: 50, damping: 30 }}
          />
        )}

        <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 pt-28 pb-12 sm:px-6 sm:pt-32 sm:pb-16 lg:px-8">
          <m.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-1 flex-col items-center text-center"
          >
            <m.div variants={item}>
              <span className="glass inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-primary shadow-sm sm:px-4 sm:text-sm">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="truncate">{t("comingSoon.badge")}</span>
              </span>
            </m.div>

            <m.h1
              variants={item}
              className="mt-6 max-w-3xl text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-balance text-deep-navy sm:mt-8 sm:text-4xl sm:leading-[1.08] md:text-5xl lg:text-6xl"
            >
              {t("comingSoon.titleLine1")}{" "}
              <span className="text-gradient-accent">{t("comingSoon.titleHighlight")}</span>
              <br />
              {t("comingSoon.titleLine2")}
            </m.h1>

            <m.p
              variants={item}
              className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:mt-6 sm:text-lg md:text-xl"
            >
              {t("comingSoon.description")}
            </m.p>

            <m.div variants={item} className="mt-10 w-full sm:mt-12">
              <ComingSoonVisualization />
            </m.div>

            <m.div
              variants={item}
              className="mt-10 grid w-full max-w-3xl gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-4"
            >
              {highlights.map((highlight) => (
                <div
                  key={highlight.label}
                  className="glass premium-card flex items-start gap-3 p-3 text-left sm:p-4"
                >
                  <highlight.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-deep-navy">{highlight.label}</p>
                    <p className="text-xs leading-relaxed text-muted">{highlight.sub}</p>
                  </div>
                </div>
              ))}
            </m.div>
          </m.div>
        </main>

        <Footer />
      </div>
    </>
  );
}
