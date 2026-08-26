import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import type { Locale } from "@/i18n/config";

type LegalKind = "terms" | "privacy";

type LegalCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  languageNotice?: string;
  summaryTitle: string;
  summary: string[];
  allowedTitle?: string;
  allowed?: string[];
  prohibitedTitle?: string;
  prohibited?: string[];
  detailTitle: string;
  details: { title: string; body: string }[];
  fullTitle: string;
  fullIntro: string;
  txtLabel: string;
  pdfLabel: string;
  accessNotice: string;
};

const downloads: Record<LegalKind, { txt: string; pdf: string }> = {
  terms: {
    txt: "/legal/v1.0/belgobase-pilotvoorwaarden-en-gebruiksvoorwaarden-v1.0.txt",
    pdf: "/legal/v1.0/belgobase-pilotvoorwaarden-en-gebruiksvoorwaarden-v1.0.pdf",
  },
  privacy: {
    txt: "/legal/v1.0/belgobase-privacyverklaring-pilot-v1.0.txt",
    pdf: "/legal/v1.0/belgobase-privacyverklaring-pilot-v1.0.pdf",
  },
};

const copy: Record<Locale, Record<LegalKind, LegalCopy>> = {
  nl: {
    terms: {
      eyebrow: "Juridisch document - versie 1.0 - 26 augustus 2026",
      title: "Pilotvoorwaarden en Gebruiksvoorwaarden",
      intro:
        "Deze voorwaarden regelen de kosteloze, zakelijke BelgoBase-pilot en het gebruik door de benoemde gebruiker. De Nederlandse versie is juridisch leidend.",
      summaryTitle: "Kernsamenvatting",
      summary: [
        "De pilot duurt 30 kalenderdagen, is kosteloos en wordt niet automatisch verlengd of betalend.",
        "De pilot is beperkt tot 1 benoemde gebruiker op 1 toegewezen apparaat voor interne professionele evaluatie.",
        "Resultaten zijn een hulpmiddel en moeten voor zakelijke beslissingen bij de authentieke bron worden gecontroleerd.",
        "Er is geen SLA, productiegarantie, uploadfunctie, API of integratie inbegrepen.",
        "Gewone beëindiging wordt eerst redelijk besproken; daarna kan elke partij schriftelijk opzeggen met 5 werkdagen opzegtermijn.",
      ],
      allowedTitle: "Wel toegestaan",
      allowed: [
        "Normale handmatige filters en zoekfuncties gebruiken voor interne evaluatie.",
        "Beperkte resultaten bekijken en, wanneer vrijgegeven, intern exporteren voor die evaluatie.",
        "Bron, peildatum, werking en gegevenskwaliteit controleren.",
        "Feedback en beveiligingsproblemen vertrouwelijk melden.",
      ],
      prohibitedTitle: "Niet toegestaan",
      prohibited: [
        "Direct marketing, spam, massaprospectie of profilering van natuurlijke personen.",
        "Wederverkoop, publicatie, doorlevering of opname in een externe databank, CRM of datawarehouse.",
        "Scraping, crawling, bots, macro's, bulkextractie, API-calls of omzeiling van limieten en beveiliging.",
        "AI-training, embeddings, externe modelanalyse of bouw van een concurrerende dataset of dienst.",
        "Delen van account, installer, activatiemiddel of export met onbevoegden.",
      ],
      detailTitle: "Belangrijke contractgrenzen",
      details: [
        {
          title: "KBO en NBB",
          body: "Publicatie van deze tekst geeft geen bronrecht en garandeert niet dat een bron in de pilot beschikbaar is. KBO-persoonsgegevens mogen niet voor direct marketing worden gebruikt. Records buiten de nieuwste gebruikte volledige KBO Open Data-snapshot worden niet als actueel getoond of geëxporteerd. NBB-data wordt alleen aangeboden nadat de concrete rechten en technische toegang bewezen zijn.",
        },
        {
          title: "Aansprakelijkheid",
          body: "Voor deze kosteloze pilot geldt geen vooraf bepaald geldelijk aansprakelijkheidsplafond. De gewone wettelijke regels over fout, schade, causaliteit, voorzienbaarheid, schadebeperking en bewijs blijven gelden. Uitsluitingen gelden niet waar dwingend recht dat verbiedt, waaronder bij bedrog, opzet of zware fout.",
        },
        {
          title: "Aanvaarding en toegang",
          body: "Een installerklik ondersteunt alleen bewijs van de gebruikershandeling. Hij bewijst niet dat de gebruiker de onderneming mocht verbinden en activeert geen data. Voor toegang zijn een vooraf bevestigde zakelijke pilot en de toepasselijke technische controles nodig.",
        },
        {
          title: "Recht en geschillen",
          body: "Belgisch recht is van toepassing. Geschillen worden behandeld door de rechtbank die volgens het gemeen recht bevoegd is, nadat partijen waar redelijk eerst overlegden.",
        },
      ],
      fullTitle: "Volledige bindende tekst",
      fullIntro:
        "Lees en bewaar de volledige tekst voor aanvaarding. De tekstversie hieronder en de PDF dragen hetzelfde versienummer; de definitieve releasebestanden worden bytevast aan de aanvaarding gekoppeld.",
      txtLabel: "Download volledige tekst (TXT)",
      pdfLabel: "Download volledige voorwaarden (PDF)",
      accessNotice:
        "Publicatie van deze voorwaarden geeft geen pilottoegang, licentie, activatie of recht op KBO- of NBB-data.",
    },
    privacy: {
      eyebrow: "Privacyverklaring - versie 1.0 - 26 augustus 2026",
      title: "Privacyverklaring voor de BelgoBase-pilot",
      intro:
        "Deze verklaring legt uit hoe NovaVenture Group BV persoonsgegevens verwerkt voor aanvraag, bevestiging, installatie, beveiliging, ondersteuning en evaluatie van de BelgoBase-pilot.",
      summaryTitle: "In het kort",
      summary: [
        "Kennisname van deze verklaring is geen toestemming; per doel geldt een passende rechtsgrond.",
        "We verwerken beperkte zakelijke contact-, contract-, licentie-, apparaat-, gebruiks-, beveiligings- en supportgegevens.",
        "Normale audit bewaart geen requestpayloads, volledige headers, credentials of tokens voor zover technisch bewezen.",
        "De pilot is geen uploaddienst. Stuur geen databestanden of onnodige persoonsgegevens.",
        "Direct marketing met productresultaten is verboden.",
      ],
      detailTitle: "Belangrijke privacy-informatie",
      details: [
        {
          title: "Doelen en rechtsgronden",
          body: "BelgoBase verwerkt gegevens voor uitvoering en beheer van de zakelijke pilot, beveiliging, ondersteuning, productevaluatie, contractbewijs en wettelijke verplichtingen. De rechtsgrond hangt af van het concrete doel en kan overeenkomst, gerechtvaardigd belang of een wettelijke verplichting zijn.",
        },
        {
          title: "Bewaring",
          body: "Gegevens worden niet langer bewaard dan redelijk nodig. Normale productrequestaudit is begrensd tot 180 dagen of 500.000 rijen; opgeloste beveiligingsalerts tot 730 dagen of 100.000 rijen, telkens wat eerst optreedt. Contract- en incidentbewijs kan volgens toepasselijke bewijs-, verjarings- of wettelijke termijnen langer nodig zijn.",
        },
        {
          title: "Leveranciers en doorgifte",
          body: "Technische leveranciers krijgen alleen noodzakelijke toegang voor afgesproken doeleinden. Deze verklaring doet geen onbewezen belofte over een vaste opslagregio, DPA-status of doorgiftemechanisme. Een doorgifte buiten de EER vereist een geldige wettelijke grondslag en passende waarborgen.",
        },
        {
          title: "Websitevoorkeuren en browseropslag",
          body: "De website gebruikt belgobase-theme in localStorage en een cookie voor de huidige, standaard of gekozen light/dark/system-weergave; localStorage blijft tot de gebruiker of browser haar wijzigt of wist, de cookie maximaal 1 jaar. belgobase-resolved bewaart de actuele light/dark-weergave in een cookie maximaal 1 jaar. NEXT_LOCALE bewaart na taalkeuze nl/en in een cookie maximaal 1 jaar. Browseropslag kan worden gewist. Codecontrole vond in deze release geen analytics-, advertentie- of marketingtrackers. Toekomstige niet-functionele tracking, of gebruik waarvoor voorafgaande toestemming wettelijk vereist is, vraagt een aparte geldige keuze vóór gebruik.",
        },
        {
          title: "Uw rechten",
          body: "Afhankelijk van de wettelijke voorwaarden kunt u inzage, verbetering, verwijdering, beperking, overdraagbaarheid of bezwaar vragen via legal@belgobase.be. Beveiligingsincidenten meldt u via security@belgobase.be.",
        },
      ],
      fullTitle: "Volledige privacyverklaring",
      fullIntro:
        "De volledige Nederlandstalige versie is hieronder leesbaar en in een duurzaam formaat beschikbaar.",
      txtLabel: "Download privacyverklaring (TXT)",
      pdfLabel: "Download privacyverklaring (PDF)",
      accessNotice:
        "Publicatie van deze verklaring geeft geen pilottoegang of recht op een specifieke gegevensbron.",
    },
  },
  en: {
    terms: {
      eyebrow: "Legal document - version 1.0 - 26 August 2026",
      title: "Pilot Terms and Acceptable Use Rules",
      intro:
        "This page explains the free business pilot and its permitted use. The binding version 1.0 is currently available in Dutch only.",
      languageNotice:
        "Important: this English page is an informative summary. The Dutch document supplied for acceptance is legally controlling.",
      summaryTitle: "Key summary",
      summary: [
        "The pilot lasts 30 calendar days, is free, and does not renew or become paid automatically.",
        "It is limited to 1 named user on 1 assigned device for internal professional evaluation.",
        "Results are an aid and must be verified at the authentic source before business decisions.",
        "No SLA, production guarantee, uploads, API or integrations are included.",
        "Ordinary termination is discussed reasonably first; either party may then give 5 business days' written notice.",
      ],
      allowedTitle: "Permitted",
      allowed: [
        "Use normal manual filters and searches for internal evaluation.",
        "Review limited results and, where enabled, export them internally for that evaluation.",
        "Check source, reference date, operation and data quality.",
        "Report feedback and security issues confidentially.",
      ],
      prohibitedTitle: "Not permitted",
      prohibited: [
        "Direct marketing, spam, mass prospecting or profiling natural persons.",
        "Resale, publication, onward supply or inclusion in an external database, CRM or data warehouse.",
        "Scraping, crawling, bots, macros, bulk extraction, API calls or bypassing limits and security.",
        "AI training, embeddings, external model analysis or building a competing dataset or service.",
        "Sharing accounts, installers, activation means or exports with unauthorized persons.",
      ],
      detailTitle: "Important boundaries",
      details: [
        {
          title: "Source rights",
          body: "Publication creates no source right and does not guarantee that KBO or NBB data is available. KBO personal data may not be used for direct marketing. NBB data is offered only after the concrete rights and access have been proven.",
        },
        {
          title: "Acceptance and access",
          body: "An installer click supports evidence of a user action only. It does not prove company authority and does not activate data. A separately confirmed business pilot and applicable technical checks remain required.",
        },
        {
          title: "Controlling language",
          body: "The Dutch version 1.0 dated 26 August 2026 controls. Do not accept this English summary as a replacement for the Dutch contract text.",
        },
      ],
      fullTitle: "Full controlling text",
      fullIntro: "Read and retain the full Dutch text before acceptance.",
      txtLabel: "Download controlling Dutch text (TXT)",
      pdfLabel: "Download controlling Dutch terms (PDF)",
      accessNotice:
        "Publication does not grant pilot access, a licence, activation, or rights to KBO or NBB data.",
    },
    privacy: {
      eyebrow: "Privacy notice - version 1.0 - 26 August 2026",
      title: "Privacy Notice for the BelgoBase Pilot",
      intro:
        "This page summarizes how NovaVenture Group BV processes personal data for the BelgoBase pilot. The controlling version 1.0 is currently available in Dutch only.",
      languageNotice:
        "Important: this English page is an informative summary. The Dutch privacy notice supplied to users is controlling.",
      summaryTitle: "In brief",
      summary: [
        "Acknowledging the notice is not consent; each purpose uses an appropriate legal basis.",
        "We process limited business contact, contract, licence, device, usage, security and support data.",
        "Normal audit does not store request payloads, full headers, credentials or tokens where technically verified.",
        "The pilot is not an upload service. Do not send datasets or unnecessary personal data.",
        "Direct marketing with product results is prohibited.",
      ],
      detailTitle: "Important privacy information",
      details: [
        {
          title: "Purposes and legal bases",
          body: "Data is used for pilot performance and administration, security, support, evaluation, evidence and legal obligations. The legal basis depends on the purpose and may be contract, legitimate interests or a legal obligation.",
        },
        {
          title: "Retention",
          body: "Normal product request audit is capped at 180 days or 500,000 rows; resolved security alerts at 730 days or 100,000 rows, whichever occurs first. Evidence may require a different lawful period.",
        },
        {
          title: "Website preferences and browser storage",
          body: "The website uses belgobase-theme in localStorage and a cookie for the current, default or selected light/dark/system display; localStorage remains until the user or browser changes or clears it, while the cookie lasts up to 1 year. belgobase-resolved stores the resolved light/dark display in a cookie for up to 1 year. NEXT_LOCALE stores nl/en after a language choice in a cookie for up to 1 year. Browser storage can be cleared. Code review found no analytics, advertising or marketing trackers in this release. Future non-functional tracking, or use that legally requires prior consent, requires a separate valid choice before use. This English summary remains informative; the Dutch v1.0 notice controls.",
        },
        {
          title: "Your rights",
          body: "Subject to legal conditions, requests for access, correction, deletion, restriction, portability or objection can be sent to legal@belgobase.be. Security incidents can be reported to security@belgobase.be.",
        },
      ],
      fullTitle: "Full controlling privacy notice",
      fullIntro: "Read and retain the full Dutch version made available below.",
      txtLabel: "Download controlling Dutch notice (TXT)",
      pdfLabel: "Download controlling Dutch notice (PDF)",
      accessNotice:
        "Publication does not grant pilot access or rights to a particular data source.",
    },
  },
};

function BulletList({ items, tone = "neutral" }: { items: string[]; tone?: "neutral" | "good" | "bad" }) {
  const marker = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-primary";
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6 text-foreground/80 sm:text-base">
          <span aria-hidden="true" className={`mt-2 h-2 w-2 shrink-0 rounded-full ${marker}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LegalPage({ locale, kind }: { locale: Locale; kind: LegalKind }) {
  const text = copy[locale][kind];
  const assets = downloads[kind];
  const labels = locale === "nl"
    ? { provider: "Aanbieder", enterprise: "Ondernemingsnummer", office: "Maatschappelijke zetel", contact: "Contact", trading: "handelend onder de naam", country: "België" }
    : { provider: "Provider", enterprise: "Enterprise number", office: "Registered office", contact: "Contact", trading: "trading as", country: "Belgium" };

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

      <main className="bg-background">
        <section className="border-b border-border bg-surface py-14 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">{text.eyebrow}</p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-deep-navy sm:text-5xl">{text.title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-muted sm:text-lg">{text.intro}</p>
            {text.languageNotice && (
              <p className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
                {text.languageNotice}
              </p>
            )}
            <dl className="mt-8 grid gap-3 rounded-2xl border border-border bg-background p-5 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold text-deep-navy">{labels.provider}</dt><dd className="mt-1 text-muted">NovaVenture Group BV, {labels.trading} BelgoBase</dd></div>
              <div><dt className="font-semibold text-deep-navy">{labels.enterprise}</dt><dd className="mt-1 text-muted">BE 1006.303.437</dd></div>
              <div><dt className="font-semibold text-deep-navy">{labels.office}</dt><dd className="mt-1 text-muted">Krommestraat 48, 2830 Willebroek, {labels.country}</dd></div>
              <div><dt className="font-semibold text-deep-navy">{labels.contact}</dt><dd className="mt-1 text-muted"><a className="text-primary underline" href="mailto:legal@belgobase.be">legal@belgobase.be</a> - <a className="text-primary underline" href="mailto:security@belgobase.be">security@belgobase.be</a></dd></div>
            </dl>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-4xl space-y-12 px-4 sm:px-6 lg:px-8">
            <section className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-deep-navy">{text.summaryTitle}</h2>
              <div className="mt-6"><BulletList items={text.summary} /></div>
            </section>

            {text.allowed && text.prohibited && (
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <h2 className="text-xl font-bold text-deep-navy">{text.allowedTitle}</h2>
                  <div className="mt-5"><BulletList items={text.allowed} tone="good" /></div>
                </section>
                <section className="rounded-3xl border border-red-200 bg-red-50/60 p-6 dark:border-red-900 dark:bg-red-950/20">
                  <h2 className="text-xl font-bold text-deep-navy">{text.prohibitedTitle}</h2>
                  <div className="mt-5"><BulletList items={text.prohibited} tone="bad" /></div>
                </section>
              </div>
            )}

            <section>
              <h2 className="text-2xl font-bold text-deep-navy">{text.detailTitle}</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {text.details.map((detail) => (
                  <article key={detail.title} className="rounded-2xl border border-border bg-surface p-5">
                    <h3 className="font-semibold text-deep-navy">{detail.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted">{detail.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-deep-navy">{text.fullTitle}</h2>
              <p className="mt-3 leading-7 text-muted">{text.fullIntro}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={assets.pdf} download className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">{text.pdfLabel}</a>
                <a href={assets.txt} download className="rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-deep-navy hover:bg-surface-hover">{text.txtLabel}</a>
              </div>
              <iframe
                className="mt-8 h-[48rem] w-full rounded-2xl border border-border bg-white"
                src={assets.txt}
                title={text.fullTitle}
              />
            </section>

            <p className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm font-medium leading-6 text-deep-navy">{text.accessNotice}</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
