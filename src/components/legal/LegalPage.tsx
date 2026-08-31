import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Footer } from "@/components/layout/Footer";
import type { Locale } from "@/i18n/config";

export type LegalKind = "terms" | "privacy" | "cookies" | "legal";

type LegalDocument = {
  title: string;
  version: string;
  href: string;
};

type LegalCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  languageNotice?: string;
  publishedLabel: string;
  publishedDate: string;
  readLabel: string;
  downloadLabel: string;
  documents: LegalDocument[];
};

const copy: Record<Locale, Record<LegalKind, LegalCopy>> = {
  nl: {
    terms: {
      eyebrow: "Juridische documenten",
      title: "Algemene Voorwaarden en Gebruiksvoorwaarden",
      intro: "Hier kunt u de volledige voorwaarden van BelgoBase als PDF lezen of downloaden.",
      publishedLabel: "Gepubliceerd",
      publishedDate: "31 augustus 2026",
      readLabel: "PDF lezen",
      downloadLabel: "PDF downloaden",
      documents: [
        {
          title: "BelgoBase Algemene Voorwaarden B2B",
          version: "Versie 1.1",
          href: "/legal/2026-08-31/belgobase-algemene-voorwaarden-b2b-v1.1.pdf",
        },
        {
          title: "BelgoBase Gebruiksvoorwaarden",
          version: "Versie 1.1",
          href: "/legal/2026-08-31/belgobase-gebruiksvoorwaarden-v1.1.pdf",
        },
      ],
    },
    privacy: {
      eyebrow: "Juridisch document",
      title: "Privacyverklaring",
      intro: "Hier kunt u de volledige privacyverklaring van BelgoBase als PDF lezen of downloaden.",
      publishedLabel: "Gepubliceerd",
      publishedDate: "31 augustus 2026",
      readLabel: "PDF lezen",
      downloadLabel: "PDF downloaden",
      documents: [
        {
          title: "BelgoBase Privacyverklaring",
          version: "Versie 1.1",
          href: "/legal/2026-08-31/belgobase-privacyverklaring-v1.1.pdf",
        },
      ],
    },
    cookies: {
      eyebrow: "Juridisch document",
      title: "Cookieverklaring",
      intro: "Hier kunt u de volledige cookieverklaring van BelgoBase als PDF lezen of downloaden.",
      publishedLabel: "Gepubliceerd",
      publishedDate: "31 augustus 2026",
      readLabel: "PDF lezen",
      downloadLabel: "PDF downloaden",
      documents: [
        {
          title: "BelgoBase Cookieverklaring",
          version: "Versie 1.0",
          href: "/legal/2026-08-31/belgobase-cookieverklaring-v1.0.pdf",
        },
      ],
    },
    legal: {
      eyebrow: "Juridisch document",
      title: "Wettelijke vermeldingen",
      intro: "Hier kunt u de volledige juridische informatie over de website en de aanbieder als PDF lezen of downloaden.",
      publishedLabel: "Gepubliceerd",
      publishedDate: "31 augustus 2026",
      readLabel: "PDF lezen",
      downloadLabel: "PDF downloaden",
      documents: [
        {
          title: "BelgoBase Website Legal Notice",
          version: "Versie 1.0",
          href: "/legal/2026-08-31/belgobase-website-legal-notice-v1.0.pdf",
        },
      ],
    },
  },
  en: {
    terms: {
      eyebrow: "Legal documents",
      title: "B2B Terms and Acceptable Use Terms",
      intro: "You can read or download the complete BelgoBase terms as PDF documents below.",
      languageNotice: "The currently published and controlling documents are available in Dutch.",
      publishedLabel: "Published",
      publishedDate: "31 August 2026",
      readLabel: "Read PDF",
      downloadLabel: "Download PDF",
      documents: [
        {
          title: "BelgoBase Algemene Voorwaarden B2B",
          version: "Version 1.1 (Dutch)",
          href: "/legal/2026-08-31/belgobase-algemene-voorwaarden-b2b-v1.1.pdf",
        },
        {
          title: "BelgoBase Gebruiksvoorwaarden",
          version: "Version 1.1 (Dutch)",
          href: "/legal/2026-08-31/belgobase-gebruiksvoorwaarden-v1.1.pdf",
        },
      ],
    },
    privacy: {
      eyebrow: "Legal document",
      title: "Privacy Notice",
      intro: "You can read or download the complete BelgoBase privacy notice as a PDF below.",
      languageNotice: "The currently published and controlling document is available in Dutch.",
      publishedLabel: "Published",
      publishedDate: "31 August 2026",
      readLabel: "Read PDF",
      downloadLabel: "Download PDF",
      documents: [
        {
          title: "BelgoBase Privacyverklaring",
          version: "Version 1.1 (Dutch)",
          href: "/legal/2026-08-31/belgobase-privacyverklaring-v1.1.pdf",
        },
      ],
    },
    cookies: {
      eyebrow: "Legal document",
      title: "Cookie Notice",
      intro: "You can read or download the complete BelgoBase cookie notice as a PDF below.",
      languageNotice: "The currently published and controlling document is available in Dutch.",
      publishedLabel: "Published",
      publishedDate: "31 August 2026",
      readLabel: "Read PDF",
      downloadLabel: "Download PDF",
      documents: [
        {
          title: "BelgoBase Cookieverklaring",
          version: "Version 1.0 (Dutch)",
          href: "/legal/2026-08-31/belgobase-cookieverklaring-v1.0.pdf",
        },
      ],
    },
    legal: {
      eyebrow: "Legal document",
      title: "Legal Notice",
      intro: "You can read or download the complete legal information about the website and its provider as a PDF below.",
      languageNotice: "The currently published and controlling document is available in Dutch.",
      publishedLabel: "Published",
      publishedDate: "31 August 2026",
      readLabel: "Read PDF",
      downloadLabel: "Download PDF",
      documents: [
        {
          title: "BelgoBase Website Legal Notice",
          version: "Version 1.0 (Dutch)",
          href: "/legal/2026-08-31/belgobase-website-legal-notice-v1.0.pdf",
        },
      ],
    },
  },
};

export function LegalPage({ locale, kind }: { locale: Locale; kind: LegalKind }) {
  const text = copy[locale][kind];

  return (
    <>
      <header className="border-b border-border bg-surface/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href={`/${locale}`} className="flex items-center gap-2 text-lg font-semibold text-deep-navy">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">B</span>
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
            {text.languageNotice && (
              <p className="mt-5 max-w-3xl rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-muted">
                {text.languageNotice}
              </p>
            )}
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-4xl space-y-5 px-4 sm:px-6 lg:px-8">
            {text.documents.map((document) => (
              <article key={document.href} className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-deep-navy sm:text-2xl">{document.title}</h2>
                    <p className="mt-2 text-sm text-muted">
                      {document.version} · {text.publishedLabel} {text.publishedDate}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <a href={document.href} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      {text.readLabel}
                    </a>
                    <a href={document.href} download className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-deep-navy transition-colors hover:bg-surface-hover">
                      <Download className="h-4 w-4" aria-hidden="true" />
                      {text.downloadLabel}
                    </a>
                  </div>
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
