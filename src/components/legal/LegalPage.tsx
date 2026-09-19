import { Download, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Footer } from "@/components/layout/Footer";
import type { Locale } from "@/i18n/config";

export type LegalKind = "terms" | "privacy" | "cookies" | "legal";
type DocumentLanguage = "nl" | "fr" | "en";

type LegalDocument = { basename: string; title: Record<Locale, string> };
type LegalCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  acceptanceNotice: string;
  publishedLabel: string;
  publishedDate: string;
  versionLabel: string;
  readLabel: string;
  downloadLabel: string;
};

const documentLanguages: Array<{ code: DocumentLanguage; label: string }> = [
  { code: "nl", label: "Nederlands" },
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

const documents: Record<LegalKind, LegalDocument[]> = {
  terms: [
    {
      basename: "belgobase-algemene-voorwaarden-b2b",
      title: { nl: "BelgoBase Algemene Voorwaarden B2B", en: "BelgoBase B2B General Terms and Conditions" },
    },
    {
      basename: "belgobase-gebruiksvoorwaarden",
      title: { nl: "BelgoBase Gebruiksvoorwaarden", en: "BelgoBase Terms of Use" },
    },
  ],
  privacy: [{ basename: "belgobase-privacyverklaring", title: { nl: "BelgoBase Privacyverklaring", en: "BelgoBase Privacy Notice" } }],
  cookies: [{ basename: "belgobase-cookieverklaring", title: { nl: "BelgoBase Cookie- en opslagverklaring", en: "BelgoBase Cookie and Storage Notice" } }],
  legal: [{ basename: "belgobase-website-legal-notice", title: { nl: "BelgoBase Wettelijke vermeldingen", en: "BelgoBase Website Legal Notice" } }],
};

const sharedCopy: Record<Locale, Omit<LegalCopy, "eyebrow" | "title" | "intro">> = {
  nl: {
    acceptanceNotice: "Publicatie op deze website vormt op zichzelf geen contractaanvaarding. Bij registratie of contractaanvaarding gelden de versie en documentidentiteit die u daar uitdrukkelijk worden getoond.",
    publishedLabel: "Gepubliceerd",
    publishedDate: "19 september 2026",
    versionLabel: "Versie 1.2",
    readLabel: "PDF lezen",
    downloadLabel: "PDF downloaden",
  },
  en: {
    acceptanceNotice: "Publication on this website does not by itself constitute contract acceptance. During registration or contract acceptance, the version and document identity expressly shown there apply.",
    publishedLabel: "Published",
    publishedDate: "19 September 2026",
    versionLabel: "Version 1.2",
    readLabel: "Read PDF",
    downloadLabel: "Download PDF",
  },
};

const pageCopy: Record<Locale, Record<LegalKind, Pick<LegalCopy, "eyebrow" | "title" | "intro">>> = {
  nl: {
    terms: {
      eyebrow: "Juridische documenten",
      title: "Algemene Voorwaarden en Gebruiksvoorwaarden",
      intro: "Hier kunt u de volledige voorwaarden van BelgoBase in het Nederlands, Frans of Engels als PDF lezen of downloaden.",
    },
    privacy: {
      eyebrow: "Juridisch document",
      title: "Privacyverklaring",
      intro: "Hier kunt u de volledige privacyverklaring van BelgoBase in het Nederlands, Frans of Engels lezen of downloaden.",
    },
    cookies: {
      eyebrow: "Juridisch document",
      title: "Cookie- en opslagverklaring",
      intro: "Hier kunt u de volledige cookie- en opslagverklaring van BelgoBase in het Nederlands, Frans of Engels lezen of downloaden.",
    },
    legal: {
      eyebrow: "Juridisch document",
      title: "Wettelijke vermeldingen",
      intro: "Hier kunt u de volledige juridische informatie over de website en de aanbieder in het Nederlands, Frans of Engels lezen of downloaden.",
    },
  },
  en: {
    terms: {
      eyebrow: "Legal documents",
      title: "B2B Terms and Acceptable Use Terms",
      intro: "Read or download the complete BelgoBase terms in Dutch, French or English below.",
    },
    privacy: {
      eyebrow: "Legal document",
      title: "Privacy Notice",
      intro: "Read or download the complete BelgoBase privacy notice in Dutch, French or English below.",
    },
    cookies: {
      eyebrow: "Legal document",
      title: "Cookie and Storage Notice",
      intro: "Read or download the complete BelgoBase cookie and storage notice in Dutch, French or English below.",
    },
    legal: {
      eyebrow: "Legal document",
      title: "Legal Notice",
      intro: "Read or download the complete legal information about the website and its provider in Dutch, French or English below.",
    },
  },
};

export function LegalPage({ locale, kind }: { locale: Locale; kind: LegalKind }) {
  const text: LegalCopy = { ...sharedCopy[locale], ...pageCopy[locale][kind] };

  return (
    <>
      <header className="border-b border-border bg-surface/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href={`/${locale}`} aria-label="BelgoBase" className="flex items-center gap-2 text-lg font-semibold text-deep-navy">
            <Image src="/brand/belgobase-bb-logo.png" alt="" aria-hidden="true" width={32} height={32} className="h-8 w-8 rounded-lg" />
            BelgoBase
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="min-h-[65vh] bg-background">
        <section className="border-b border-border bg-surface py-14 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">{text.eyebrow}</p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-deep-navy sm:text-5xl">{text.title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-muted sm:text-lg">{text.intro}</p>
            <p className="mt-5 max-w-3xl rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-muted">
              {text.acceptanceNotice}
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-4xl space-y-5 px-4 sm:px-6 lg:px-8">
            {documents[kind].map((document) => (
              <article key={document.basename} className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
                <h2 className="text-xl font-bold text-deep-navy sm:text-2xl">{document.title[locale]}</h2>
                <p className="mt-2 text-sm text-muted">
                  {text.versionLabel} · {text.publishedLabel} {text.publishedDate}
                </p>
                <div className="mt-6 grid gap-4">
                  {documentLanguages.map((language) => {
                    const href = `/legal/current/${language.code}/${document.basename}.pdf`;
                    return (
                      <div key={language.code} className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-semibold text-deep-navy" lang={language.code}>{language.label}</p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <a href={href} target="_blank" rel="noreferrer" hrefLang={language.code} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            {text.readLabel}
                          </a>
                          <a href={href} download hrefLang={language.code} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-deep-navy transition-colors hover:bg-surface-hover">
                            <Download className="h-4 w-4" aria-hidden="true" />
                            {text.downloadLabel}
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
