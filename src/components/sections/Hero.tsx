"use client";

import { ArrowRight } from "lucide-react";
import { HeroVisualization } from "@/components/visuals/HeroVisualization";
import { useTranslations } from "@/providers/TranslationsProvider";

export function Hero() {
  const { t } = useTranslations();

  return (
    <section className="relative overflow-hidden bg-[#f7f8f4] pb-16 pt-[calc(6.5rem+env(safe-area-inset-top,0px))] dark:bg-[#071124] sm:pb-24 sm:pt-24 lg:pb-20 lg:pt-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(37,99,235,0.08),transparent)] dark:bg-[linear-gradient(180deg,rgba(50,107,255,0.10),transparent)]"
      />

      <div className="relative mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-1 lg:gap-8">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mt-4 text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.04em] text-deep-navy text-balance sm:text-5xl lg:text-[3.1rem] xl:text-[3.65rem]">
              {t("hero.titleLine1")}
              {t("hero.titleHighlight") ? (
                <>
                  {" "}
                  <span className="text-primary">{t("hero.titleHighlight")}</span>
                </>
              ) : null}
              {t("hero.titleLine2") ? <span className="block">{t("hero.titleLine2")}</span> : null}
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              {t("hero.description")}
            </p>

            <div className="mt-6 flex justify-center flex-col gap-3 sm:flex-row sm:items-center">
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

          <div className="mx-auto w-full max-w-6xl min-w-0">
            <HeroVisualization />
          </div>
        </div>

      </div>
    </section>
  );
}
