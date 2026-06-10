"use client";

import { motion } from "framer-motion";
import {
  Network,
  Crown,
  BarChart3,
  HeadphonesIcon,
  ArrowRight,
} from "lucide-react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";

export function Enterprise() {
  const { t } = useTranslations();

  const features = [
    {
      icon: Crown,
      title: t("enterprise.executiveTitle"),
      description: t("enterprise.executiveDesc"),
    },
    {
      icon: Network,
      title: t("enterprise.mappingTitle"),
      description: t("enterprise.mappingDesc"),
    },
    {
      icon: BarChart3,
      title: t("enterprise.intelligenceTitle"),
      description: t("enterprise.intelligenceDesc"),
    },
    {
      icon: HeadphonesIcon,
      title: t("enterprise.managerTitle"),
      description: t("enterprise.managerDesc"),
    },
  ];

  return (
    <section
      id="enterprise"
      className="relative overflow-hidden bg-[#060a14] py-16 sm:py-24 md:py-32 dark:bg-[#040810]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute right-1/4 bottom-0 h-80 w-80 rounded-full bg-accent/15 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 sm:gap-16 lg:grid-cols-2">
          <SectionReveal direction="left">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-accent">
              {t("enterprise.eyebrow")}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-white sm:text-3xl md:text-4xl lg:text-5xl">
              {t("enterprise.titleLine1")}
              <br />
              <span className="text-gradient-accent">{t("enterprise.titleHighlight")}</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/60">
              {t("enterprise.description")}
            </p>
            <div className="mt-8">
              <MagneticButton
                href="#contact"
                className="!bg-white !text-[#060a14] !shadow-white/10 hover:!bg-white/90"
              >
                {t("enterprise.talkToSales")}
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
            </div>
          </SectionReveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature, i) => (
              <SectionReveal key={feature.title} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="glass rounded-2xl border-white/10 bg-white/5 p-4 transition-colors hover:border-accent/30 hover:bg-white/8 sm:p-6"
                >
                  <feature.icon className="mb-4 h-6 w-6 text-accent" />
                  <h3 className="mb-2 font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">
                    {feature.description}
                  </p>
                </motion.div>
              </SectionReveal>
            ))}
          </div>
        </div>

        <SectionReveal delay={0.3}>
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-sm sm:mt-16">
            <div className="relative h-36 overflow-hidden rounded-xl sm:h-48 md:h-56">
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 800 200"
                preserveAspectRatio="xMidYMid slice"
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const x1 = 50 + (i % 4) * 200;
                  const y1 = 30 + Math.floor(i / 4) * 70;
                  const x2 = x1 + 80 + (i % 3) * 20;
                  const y2 = y1 + 40 - (i % 2) * 30;
                  return (
                    <motion.line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#4DA3FF"
                      strokeWidth="0.5"
                      opacity="0.3"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, delay: i * 0.1 }}
                    />
                  );
                })}
                {Array.from({ length: 8 }).map((_, i) => (
                  <motion.circle
                    key={`node-${i}`}
                    cx={100 + (i % 4) * 180}
                    cy={50 + Math.floor(i / 4) * 90}
                    r="4"
                    fill="#0A66C2"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <p className="text-center text-xs font-medium text-white/40 sm:text-sm">
                  {t("enterprise.networkLabel")}
                </p>
              </div>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
