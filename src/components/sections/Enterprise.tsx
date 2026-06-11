"use client";

import { m } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { EnterpriseVisualization } from "@/components/visuals/EnterpriseVisualization";
import { useTranslations } from "@/providers/TranslationsProvider";

export function Enterprise() {
  const { t } = useTranslations();

  const features = [
    t("enterprise.feature1"),
    t("enterprise.feature2"),
    t("enterprise.feature3"),
    t("enterprise.feature4"),
    t("enterprise.feature5"),
  ];

  return (
    <section
      id="enterprise"
      className="relative overflow-hidden bg-[#060a14] py-16 sm:py-24 md:py-32 dark:bg-[#040810]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute right-1/4 bottom-0 h-80 w-80 rounded-full bg-accent/20 blur-[100px]" />
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
            <p className="mb-4 text-sm font-medium tracking-[0.2em] text-accent uppercase">
              {t("enterprise.eyebrow")}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-white sm:text-3xl md:text-4xl lg:text-5xl">
              {t("enterprise.title")}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/60">
              {t("enterprise.description")}
            </p>

            <ul className="mt-8 space-y-3.5">
              {features.map((feature, i) => (
                <m.li
                  key={feature}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className="flex items-center gap-3 text-sm text-white/80 sm:text-base"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20">
                    <Check className="h-3 w-3 text-accent" />
                  </span>
                  {feature}
                </m.li>
              ))}
            </ul>

            <div className="mt-10">
              <MagneticButton
                href="#contact"
                className="!bg-white !text-[#060a14] !shadow-lg !shadow-accent/20 hover:!bg-white/90"
              >
                {t("enterprise.talkToUs")}
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
            </div>
          </SectionReveal>

          <SectionReveal direction="right" delay={0.15}>
            <EnterpriseVisualization />
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
