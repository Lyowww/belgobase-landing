"use client";
import { useTranslations } from "@/providers/TranslationsProvider";
export function Industries() {
 const { t } = useTranslations();
 return <section id="industries" className="design-section"><div className="design-container">
  <div className="design-section-heading"><p className="design-eyebrow">03 / {t("nav.industries")}</p><div><h2 className="design-title">{t("industries.title")}</h2><p className="design-intro">{t("industries.description")}</p></div></div>
  <div className="design-audiences">{["sales","service","local"].map((key,i)=><article key={key}><span className="design-step-number">0{i+1}</span><h3>{t(`industries.${key}Title`)}</h3><p>{t(`industries.${key}Subtitle`)}</p><ul>{[1,2].map(n=><li key={n}>{t(`industries.${key}Benefit${n}`)}</li>)}</ul></article>)}</div>
 </div></section>;
}
