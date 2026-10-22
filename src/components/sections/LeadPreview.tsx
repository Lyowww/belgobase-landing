"use client";
import { useTranslations } from "@/providers/TranslationsProvider";
export function LeadPreview() {
 const { t } = useTranslations();
 return <section id="lead-preview" className="design-section design-evidence"><div className="design-container design-evidence-grid">
  <div><p className="design-eyebrow">02 / {t("leadPreview.eyebrow")}</p><h2 className="design-title">{t("leadPreview.title")}</h2><p className="design-intro">{t("leadPreview.description")}</p></div>
  <div className="design-fact-list">{["companyDetails","sectorData","contactDetails","companyInsights"].map((key,i)=><div key={key}><span aria-hidden="true">0{i+1}</span><div><h3>{t(`leadPreview.${key}Title`)}</h3><p>{t(`leadPreview.${key}Desc`)}</p></div></div>)}</div>
 </div></section>;
}
