"use client";
import { ArrowUpRight } from "lucide-react";
import { getUseCase, useCaseSlugs } from "@/lib/seo/use-cases";
import { useTranslations } from "@/providers/TranslationsProvider";
export function Results() {
  const { locale } = useTranslations();
  const nl = locale === "nl";
  return <section id="database" className="bg-surface py-16 sm:py-24">
    <div className="mx-auto max-w-7xl px-5 sm:px-8">
      <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-deep-navy sm:text-4xl">{nl ? "Kies de toepassing die bij uw werk past" : locale === "fr" ? "Choisissez l’application adaptée à votre travail" : "Choose the application that fits your work"}</h2>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {useCaseSlugs.map(slug => {
          const data = getUseCase(locale, slug);
          return <a key={slug} href={`/${locale}/${slug}`} className="group rounded-2xl border border-border p-6 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary sm:p-8">
            <ArrowUpRight className="mb-6 h-6 w-6 text-primary" aria-hidden="true" />
            <h3 className="text-xl font-semibold leading-7 text-deep-navy">{data.heading ?? data.title}</h3>
            <p className="mt-4 text-base leading-7 text-muted">{data.description}</p>
            <span className="mt-6 block font-semibold text-primary">{nl ? "Bekijk de toepassing" : locale === "fr" ? "Voir l’application" : "View this application"} →</span>
          </a>;
        })}
      </div>
      <a href={`/${locale}/mogelijkheden`} className="mt-8 inline-flex items-center gap-2 font-semibold text-primary hover:underline">
        {nl ? "Bekijk alle 15 mogelijkheden" : locale === "fr" ? "Voir les 15 possibilités" : "View all 15 capabilities"} <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  </section>;
}
