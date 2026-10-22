"use client";
import { ArrowUpRight } from "lucide-react";
import { getUseCase, useCaseSlugs } from "@/lib/seo/use-cases";
import { useTranslations } from "@/providers/TranslationsProvider";
export function Results() {
 const {locale,t}=useTranslations();
 const copy={nl:{title:"Wat wilt u met BelgoBase bereiken?",more:"Bekijk alle 15 mogelijkheden"},fr:{title:"Que souhaitez-vous accomplir avec BelgoBase ?",more:"Voir les 15 possibilités"},en:{title:"What would you like to achieve with BelgoBase?",more:"View all 15 capabilities"}}[locale];
 return <section id="database" className="design-section design-applications"><div className="design-container">
  <div className="design-section-heading"><p className="design-eyebrow">04 / {t("nav.results")}</p><h2 className="design-title">{copy.title}</h2></div>
  <div className="design-application-list">{useCaseSlugs.map((slug,i)=>{const data=getUseCase(locale,slug);return <a key={slug} href={`/${locale}/${slug}`}><span className="design-application-number">0{i+1}</span><h3>{data.title}</h3><p>{data.description}</p><ArrowUpRight aria-hidden="true" /></a>;})}</div>
  <a href={`/${locale}/mogelijkheden`} className="design-text-link">{copy.more}<ArrowUpRight size={18} aria-hidden="true" /></a>
 </div></section>;
}
