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
      intro: "Hier kunt u de privacyverklaring van BelgoBase lezen of downloaden. De aanvulling hieronder beschrijft Slim Zoeken en optioneel dicteren.",
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
      intro: "Read or download the BelgoBase privacy notice below. The supplement explains Smart Search and optional dictation.",
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
        {kind === "privacy" && (
          <section aria-labelledby="ai-privacy-title" className="pb-12 sm:pb-16">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <article className="space-y-5 rounded-3xl border border-border bg-surface p-6 text-base leading-7 text-muted sm:p-8">
                <h2 id="ai-privacy-title" className="text-2xl font-bold text-deep-navy">
                  {locale === "nl" ? "Aanvulling: Slim Zoeken en dicteren" : "Supplement: Smart Search and dictation"}
                </h2>
                <p className="text-sm">{locale === "nl" ? "16 september 2026 — aanvulling op de privacyverklaring hierboven." : "16 September 2026 — supplement to the privacy notice above."}</p>
                <p>{locale === "nl"
                  ? "Wanneer u in Slim Zoeken op Versturen klikt, stuurt BelgoBase uw zoektekst, eerdere zoekvragen in hetzelfde gesprek, de ondersteunde huidige filters en de context van eerdere voorstellen en keuzes via de BelgoBase-server naar OpenAI. Het doel is een filtervoorstel of verduidelijkingsvraag te maken. U controleert het voorstel en start zelf de zoekopdracht. De gewone zoekfilters kunt u ook zonder deze AI-functie gebruiken."
                  : "When you click Send in Smart Search, BelgoBase sends your search text, earlier queries in the same conversation, supported current filters and the context of previous suggestions and choices to OpenAI through the BelgoBase server. This produces a filter suggestion or clarification question. You review the suggestion and start the search yourself. You can also use the regular search filters without this AI feature."}</p>
                <p>{locale === "nl"
                  ? "Dicteren is optioneel. De opname begint bij Spreken. Na Stoppen of na maximaal 60 seconden wordt de opname via BelgoBase naar OpenAI gestuurd om tekst te maken. U kunt de tekst controleren en aanpassen voordat u op Versturen klikt. Neem geen vertrouwelijke of onnodige persoonsgegevens op in uw zoekvraag of opname."
                  : "Dictation is optional. Recording starts when you click Speak. After Stop, or after a maximum of 60 seconds, the recording is sent through BelgoBase to OpenAI for transcription. You can review and edit the text before clicking Send. Do not include confidential information or unnecessary personal data in your query or recording."}</p>
                <p>{locale === "nl"
                  ? "De opname- en transcriptiefuncties verwerken audio tijdelijk in geheugen en slaan deze niet als audiobestand op uw computer of de BelgoBase-server op. BelgoBase registreert technische gegevens voor toegang, werking en verbruiksbewaking, waaronder aanvraagnummer, tijdstip, status en verbruik. Nieuw gesprek wist de gesprekscontext in de app; het verwijdert geen gegevens die al naar OpenAI zijn verstuurd."
                  : "The recording and transcription functions process audio temporarily in memory and do not save it as an audio file on your computer or the BelgoBase server. BelgoBase records technical data for access, operation and usage monitoring, including request identifier, time, status and usage. New conversation clears the conversation context in the app; it does not delete data already sent to OpenAI."}</p>
                <p>{locale === "nl"
                  ? "OpenAI verwerkt de verstuurde gegevens als externe AI-aanbieder. BelgoBase schakelt het bewaren van gegenereerde zoekantwoorden voor later ophalen via de API uit. Dit is geen garantie dat OpenAI geen gegevens bewaart voor bijvoorbeeld misbruikcontrole. De bewaartermijnen verschillen per dienst. Meer informatie: "
                  : "OpenAI processes the submitted data as an external AI provider. BelgoBase disables storage of generated search responses for later API retrieval. This does not guarantee that OpenAI retains no data for purposes such as abuse monitoring. Retention periods differ by service. More information: "}
                  <a href="https://developers.openai.com/api/docs/guides/your-data" className="text-primary underline">{locale === "nl" ? "OpenAI: gegevensverwerking en bewaring" : "OpenAI: data controls and retention"}</a>.
                </p>
                <p>{locale === "nl" ? "Vragen over deze verwerking of uw privacyrechten: " : "Questions about this processing or your privacy rights: "}<a href="mailto:legal@belgobase.be" className="text-primary underline">legal@belgobase.be</a>.</p>
              </article>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
