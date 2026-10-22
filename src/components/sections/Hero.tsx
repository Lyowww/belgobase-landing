"use client";

import { ArrowRight } from "lucide-react";
import { HeroVisualization } from "@/components/visuals/HeroVisualization";
import { useTranslations } from "@/providers/TranslationsProvider";

export function Hero() {
  const { t } = useTranslations();
  return (
    <section className="homepage-hero" aria-labelledby="homepage-title">
      <div className="homepage-hero-inner">
        <div className="homepage-hero-copy">
          <p className="homepage-audience">{t("hero.badge")}</p>
          <h1 id="homepage-title">{t("hero.titleLine1")} <span>{t("hero.titleLine2")}</span></h1>
          <p className="homepage-intro">{t("hero.productSummary")}</p>
          <a href="#contact" className="homepage-primary-cta">
            {t("hero.primaryCta")}<ArrowRight size={19} aria-hidden="true" />
          </a>
          <p className="homepage-demo-expectation">{t("hero.demoExpectation")}</p>
        </div>
        <div className="homepage-hero-video">
          <HeroVisualization />
        </div>
      </div>
    </section>
  );
}
