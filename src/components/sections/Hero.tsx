"use client";

import { ArrowRight } from "lucide-react";
import { ProductShowcase } from "@/components/marketing/ProductShowcase";
import { heroCopy } from "@/components/marketing/marketing-copy";
import { useTranslations } from "@/providers/TranslationsProvider";
import styles from "./Hero.module.css";

export function Hero() {
  const { locale } = useTranslations();
  const copy = heroCopy[locale];

  return (
    <section className={styles.hero} aria-labelledby="homepage-title">
      <div className={styles.container}>
        <div className={styles.introduction}>
          <div className={styles.headingGroup}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 id="homepage-title" className={styles.title}>
              <span>{copy.titleLead}</span>
              <span>{copy.titleResult}</span>
            </h1>
          </div>

          <div className={styles.action}>
            <p className={styles.summary}>{copy.summary}</p>
            <a href="#contact" className={styles.primaryCta}>
              <span>{copy.primaryCta}</span>
              <ArrowRight className={styles.ctaIcon} size={19} aria-hidden="true" />
            </a>
            <p className={styles.expectation}>{copy.expectation}</p>
          </div>
        </div>

        <div className={styles.productEvidence}>
          <ProductShowcase locale={locale} variant="workspace" />
        </div>
      </div>
    </section>
  );
}
