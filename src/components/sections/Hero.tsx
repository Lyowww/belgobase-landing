"use client";

import { m } from "framer-motion";
import { ArrowRight, UserCheck, RefreshCw, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { AmbientGlow, AnimatedGrid } from "@/components/visuals/AmbientBackground";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { useTranslations } from "@/providers/TranslationsProvider";
import { useMousePosition } from "@/hooks/useMousePosition";

const HeroVisualization = dynamic(
  () =>
    import("@/components/visuals/HeroVisualization").then((m) => ({
      default: m.HeroVisualization,
    })),
  {
    loading: () => (
      <div
        className="min-h-[420px] w-full animate-pulse rounded-2xl bg-border/30 sm:min-h-[480px] lg:min-h-[580px]"
        aria-hidden="true"
      />
    ),
  },
);

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

export function Hero() {
  const { t } = useTranslations();
  const { x, y, enabled } = useMousePosition();

  const trustIndicators = [
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
    <section className="noise-overlay mesh-hero relative overflow-hidden pt-24 pb-16 sm:pt-28 sm:pb-20 md:pt-36 md:pb-28">
      <AnimatedGrid />
      <AmbientGlow className="left-[10%] top-[15%] h-[400px] w-[400px]" color="accent" />
      <AmbientGlow className="right-[5%] top-[5%] h-[350px] w-[350px]" color="primary" />

      {enabled && (
        <m.div
          className="pointer-events-none absolute h-[300px] w-[300px] rounded-full bg-accent/8 blur-[80px] will-change-transform sm:h-[500px] sm:w-[500px] sm:blur-[100px]"
          animate={{ x: x * 0.02 - 150, y: y * 0.02 - 150 }}
          transition={{ type: "spring", stiffness: 50, damping: 30 }}
        />
      )}

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid min-w-0 items-stretch gap-8 sm:gap-12 lg:grid-cols-2 lg:gap-16">
          <m.div
            variants={container}
            initial="hidden"
            animate="show"
            className="min-w-0"
          >
            <m.div variants={item}>
              <span className="glass inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-primary shadow-sm sm:px-4 sm:text-sm">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="truncate">{t("hero.badge")}</span>
              </span>
            </m.div>

            <m.h1
              variants={item}
              className="mt-6 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-balance text-deep-navy sm:mt-8 sm:text-4xl sm:leading-[1.08] md:text-5xl lg:text-6xl"
            >
              {t("hero.titleLine1")}{" "}
              <span className="text-gradient-accent">{t("hero.titleHighlight")}</span>
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>
              {t("hero.titleLine2")}
            </m.h1>

            <m.p
              variants={item}
              className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:mt-6 sm:text-lg md:text-xl"
            >
              {t("hero.description")}
            </m.p>

            <m.div variants={item} className="mt-6 sm:mt-8">
              <MagneticButton
                href="#contact"
                className="w-full !min-w-[13rem] !px-8 !py-3.5 !text-sm sm:w-auto sm:!min-w-[15rem] sm:!px-10 sm:!text-base"
              >
                {t("hero.accessSample")}
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </MagneticButton>
            </m.div>

            <m.div
              variants={item}
              className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-4"
            >
              {trustIndicators.map((indicator) => (
                <div
                  key={indicator.label}
                  className="glass premium-card flex items-start gap-3 p-3 sm:p-4"
                >
                  <indicator.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-deep-navy">
                      {indicator.label}
                    </p>
                    <p className="text-xs leading-relaxed text-muted">{indicator.sub}</p>
                  </div>
                </div>
              ))}
            </m.div>
          </m.div>

          <m.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-w-0"
          >
            <HeroVisualization />
          </m.div>
        </div>
      </div>
    </section>
  );
}
