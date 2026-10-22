"use client";
import { ArrowRight, Check } from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";
export function Pricing() {
 const {t}=useTranslations();
 return <section id="pricing" className="design-section design-pricing"><div className="design-container design-pricing-grid">
  <div><p className="design-eyebrow">05 / {t("nav.pricing")}</p><h2 className="design-title">{t("pricing.title")}</h2><p className="design-intro">{t("pricing.description")}</p><div className="design-price"><strong>{t("pricing.packagePrice")}</strong><span>{t("pricing.packagePriceSuffix")}</span></div><p className="design-payment">{t("pricing.packagePayment")}</p><p className="design-pricing-note">{t("pricing.packageRecurring")}</p><a href="#contact" className="design-button design-button-light">{t("pricing.packageCta")}<ArrowRight size={18} aria-hidden="true" /></a></div>
  <div className="design-package"><p className="design-eyebrow">{t("pricing.packageBadge")}</p><h3>{t("pricing.packageName")}</h3><p>{t("pricing.packageDescription")}</p><p className="design-package-label">{t("pricing.packageIncludes")}</p><ul>{[1,2,3,4,5,6,7,8].map(n=><li key={n}><Check size={17} aria-hidden="true" />{t(`pricing.packageFeature${n}`)}</li>)}</ul></div>
 </div></section>;
}
