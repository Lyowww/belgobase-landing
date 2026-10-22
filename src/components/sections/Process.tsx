"use client";
import { useTranslations } from "@/providers/TranslationsProvider";
export function Process() {
 const { t } = useTranslations();
 return <section id="process" className="design-section design-process"><div className="design-container">
  <div className="design-section-heading"><p className="design-eyebrow">01 / {t("nav.process")}</p><div><h2 className="design-title">{t("process.title")}</h2><p className="design-intro">{t("process.description")}</p></div></div>
  <ol className="design-steps">{[1,2,3].map(n => <li key={n}><span className="design-step-number">0{n}</span><h3>{t(`process.step${n}Title`)}</h3><p>{t(`process.step${n}Description`)}</p></li>)}</ol>
 </div></section>;
}
