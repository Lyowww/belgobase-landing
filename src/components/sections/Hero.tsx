"use client";

import { ArrowRight, Check } from "lucide-react";
import { HeroVisualization } from "@/components/visuals/HeroVisualization";
import { useTranslations } from "@/providers/TranslationsProvider";

export function Hero() {
  const { t } = useTranslations();
  return (
    <section className="homepage-hero" aria-labelledby="homepage-title">
      <div className="homepage-hero-inner">
        <div className="homepage-hero-copy">
          <p className="homepage-eyebrow">{t("hero.badge")}</p>
          <h1 id="homepage-title">{t("hero.titleLine1")} <span>{t("hero.titleLine2")}</span></h1>
          <p className="homepage-intro">{t("hero.enrichment")}</p>
          <a href="#contact" className="homepage-primary-cta">
            {t("hero.primaryCta")}<ArrowRight size={19} aria-hidden="true" />
          </a>
          <p className="homepage-action-note">{t("hero.demoExpectation")}</p>
        </div>
        <div className="homepage-hero-video">
          <p className="homepage-video-label">{t("hero.videoLabel")}</p>
          <HeroVisualization />
        </div>
      </div>
      <ul className="homepage-benefits" aria-label={t("hero.benefitsLabel")}>
        {["benefit1", "benefit2", "benefit3"].map(key => <li key={key}><Check size={19} aria-hidden="true" />{t(`hero.${key}`)}</li>)}
      </ul>
    </section>
  );
}
