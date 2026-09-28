"use client";

import { ArrowRight } from "lucide-react";
import { HeroVisualization } from "@/components/visuals/HeroVisualization";
import { useTranslations } from "@/providers/TranslationsProvider";

export function Hero() {
  const { t } = useTranslations();

  return (
    <section className="relative overflow-hidden bg-[#f7f8f4] pb-16 pt-[calc(5rem+env(safe-area-inset-top,0px))] dark:bg-[#071124] sm:pb-24 sm:pt-24 lg:pb-20 lg:pt-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(37,99,235,0.08),transparent)] dark:bg-[linear-gradient(180deg,rgba(50,107,255,0.10),transparent)]"
      />

      <div className="relative mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-5 lg:grid-cols-1 lg:gap-6">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mt-0 text-[1.8rem] font-semibold leading-[1.02] tracking-[-0.04em] text-deep-navy text-balance sm:text-4xl lg:text-[2.7rem]">
              {t("hero.titleLine1")}
              {t("hero.titleHighlight") ? (
                <>
                  {" "}
                  <span className="text-primary">{t("hero.titleHighlight")}</span>
                </>
              ) : null}
              {t("hero.titleLine2") ? <span className="block">{t("hero.titleLine2")}</span> : null}
            </h1>

          </div>
          <div className="mx-auto w-full max-w-[min(64rem,calc(160svh_-_18rem))] min-w-0">
            <HeroVisualization />
          </div>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-base leading-7 text-muted sm:text-lg sm:leading-8">{t("hero.description")}</p>
            <a href="#contact" className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-white hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              {t("hero.primaryCta")}<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
