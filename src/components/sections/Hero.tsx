"use client";

import { ArrowRight, Database, FileSpreadsheet, MapPin } from "lucide-react";
import { HeroVisualization } from "@/components/visuals/HeroVisualization";
import { useTranslations } from "@/providers/TranslationsProvider";

export function Hero() {
  const { t } = useTranslations();

  const trustIndicators = [
    { icon: Database, label: t("hero.trustNoSignup"), sub: t("hero.trustNoSignupSub") },
    { icon: FileSpreadsheet, label: t("hero.trustUpdated"), sub: t("hero.trustUpdatedSub") },
    { icon: MapPin, label: t("hero.trustBelgium"), sub: t("hero.trustBelgiumSub") },
  ];

  return (
    <section className="relative overflow-hidden bg-[#f7f8f4] pb-16 pt-[calc(6.5rem+env(safe-area-inset-top,0px))] dark:bg-[#071124] sm:pb-24 sm:pt-32 lg:pb-28 lg:pt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(37,99,235,0.08),transparent)] dark:bg-[linear-gradient(180deg,rgba(50,107,255,0.10),transparent)]"
      />

      <div className="relative mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 xl:gap-12">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3.5 py-2 text-xs font-semibold text-primary sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              {t("hero.badge")}
            </span>

            <h1 className="mt-6 text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.04em] text-deep-navy text-balance sm:text-5xl lg:text-[3.1rem] xl:text-[3.65rem]">
              {t("hero.titleLine1")}
              {t("hero.titleHighlight") ? (
                <>
                  {" "}
                  <span className="text-primary">{t("hero.titleHighlight")}</span>
                </>
              ) : null}
              {t("hero.titleLine2") ? <span className="block">{t("hero.titleLine2")}</span> : null}
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              {t("hero.description")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#contact"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_30px_-14px_rgba(10,102,194,0.85)] transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-base"
              >
                {t("hero.primaryCta")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#product-demonstration"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-surface px-7 py-3.5 text-sm font-semibold text-deep-navy transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-base"
              >
                {t("hero.secondaryCta")}
              </a>
            </div>
          </div>

          <div className="min-w-0">
            <HeroVisualization />
          </div>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:mt-14">
          {trustIndicators.map((indicator) => (
            <div key={indicator.label} className="flex items-start gap-3 bg-surface px-5 py-4 sm:px-6 sm:py-5">
              <indicator.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-deep-navy">{indicator.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{indicator.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
