"use client";
import { ProgressiveContactForm } from "@/components/forms/ProgressiveContactForm";
import { useTranslations } from "@/providers/TranslationsProvider";
export function FinalCTA() {
 const {t,locale}=useTranslations();
 return <section id="contact" className="design-section design-contact"><div className="design-container design-contact-grid">
  <div><p className="design-eyebrow">06 / {({nl:"Uw volgende stap",fr:"Votre prochaine étape",en:"Your next step"})[locale]}</p><h2 className="design-title">{t("finalCta.title")}{t("finalCta.titleHighlight") ? ` ${t("finalCta.titleHighlight")}` : ""}{t("finalCta.titleEnd") ? ` ${t("finalCta.titleEnd")}` : ""}</h2><p className="design-intro">{t("finalCta.description")}</p></div>
  <ProgressiveContactForm variant="default" />
 </div></section>;
}
