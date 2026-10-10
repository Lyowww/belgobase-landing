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
          <h1 id="homepage-title">{t("hero.titleLine1")} <span>{t("hero.titleLine2")}</span></h1>
          <p className="homepage-intro">{t("hero.enrichment")}</p>
          <p className="homepage-intro homepage-product-summary">{t("hero.productSummary")}</p>
          <a href="#contact" className="homepage-primary-cta">
            {t("hero.primaryCta")}<ArrowRight size={19} aria-hidden="true" />
          </a>
        </div>
        <div className="homepage-hero-video">
          <HeroVisualization />
        </div>
      </div>
    </section>
  );
}
