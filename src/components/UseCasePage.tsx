import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getUseCase, useCaseSlugs, type UseCaseSlug } from "@/lib/seo/use-cases";
import { getBlogArticle } from "@/lib/blog/articles";
import { buildCanonicalUrl, buildLanguageAlternates, buildLocalizedPath } from "@/lib/seo/metadata";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductShowcase } from "@/components/marketing/ProductShowcase";
import styles from "./UseCasePage.module.css";

type Props = { params: Promise<{ locale: string }> };

const guideSlugs: Record<UseCaseSlug, string[]> = {
  "bedrijven-zoeken": ["database-belgische-bedrijven-kiezen", "prospectielijst-belgische-bedrijven-maken"],
  prospectielijsten: ["prospectielijst-belgische-bedrijven-maken"],
  "klantenbestand-analyseren": ["dubbele-bedrijven-excel-belteam"],
  bedrijfsanalyse: ["database-belgische-bedrijven-kiezen"],
};

const pageCopy: Record<Locale, {
  eyebrow: Record<UseCaseSlug, string>;
  hero: Record<UseCaseSlug, { heading: string; summary: string }>;
  task: string;
  process: string;
  result: string;
  criteria: string;
  prices: string;
  demo: string;
  guides: string;
  related: string;
  guideLanguage: string;
}> = {
  nl: {
    eyebrow: {
      "bedrijven-zoeken": "Gerichte bedrijfsselectie",
      prospectielijsten: "Van doelgroep naar Excel",
      "klantenbestand-analyseren": "Uw klantenbestand als context",
      bedrijfsanalyse: "Eén bedrijf helder beoordelen",
    },
    hero: {
      "bedrijven-zoeken": {
        heading: "Vind Belgische bedrijven. Op uw criteria.",
        summary: "Bespreek uw doelgroep, controleer de selectie en kies welke bedrijven en gegevens u naar Excel exporteert.",
      },
      prospectielijsten: {
        heading: "Uw doelgroep. Uw volgende prospectielijst.",
        summary: "Zet regio, activiteit en omvang om in een controleerbare selectie die uw team zelf beoordeelt en naar Excel exporteert.",
      },
      "klantenbestand-analyseren": {
        heading: "Uw klantenbestand. Een scherper vertrekpunt.",
        summary: "Gebruik uw Excel- of CSV-lijst als context, controleer de voorgestelde doelgroep en zoek Belgische bedrijven op bevestigde criteria.",
      },
      bedrijfsanalyse: {
        heading: "Bedrijfsgegevens. Helder naast elkaar.",
        summary: "Bekijk beschikbare activiteit, personeel en financiële historiek samen voordat u een bedrijf selecteert of uw lijst verfijnt.",
      },
    },
    task: "Een concrete taak",
    process: "In drie controleerbare stappen",
    result: "Wat u overhoudt",
    criteria: "Waarop u de selectie controleert",
    prices: "Bekijk prijzen",
    demo: "Bekijk hoe BelgoBase werkt",
    guides: "Verder lezen vóór u uw lijst gebruikt",
    related: "Andere toepassingen",
    guideLanguage: "",
  },
  fr: {
    eyebrow: {
      "bedrijven-zoeken": "Sélection ciblée d’entreprises",
      prospectielijsten: "De la cible à Excel",
      "klantenbestand-analyseren": "Votre fichier clients comme contexte",
      bedrijfsanalyse: "Évaluer clairement une entreprise",
    },
    hero: {
      "bedrijven-zoeken": {
        heading: "Trouvez des entreprises belges. Selon vos critères.",
        summary: "Définissez votre cible, contrôlez la sélection et choisissez les entreprises et données à exporter vers Excel.",
      },
      prospectielijsten: {
        heading: "Votre cible. Votre prochaine liste de prospection.",
        summary: "Transformez région, activité et taille en une sélection contrôlable que votre équipe vérifie avant l’export vers Excel.",
      },
      "klantenbestand-analyseren": {
        heading: "Votre fichier clients. Un point de départ plus précis.",
        summary: "Utilisez votre fichier Excel ou CSV comme contexte, vérifiez la cible proposée et recherchez des entreprises belges selon des critères confirmés.",
      },
      bedrijfsanalyse: {
        heading: "Les données d’une entreprise. Clairement regroupées.",
        summary: "Consultez l’activité, le personnel et l’historique financier disponibles avant de sélectionner une entreprise ou d’affiner votre liste.",
      },
    },
    task: "Une tâche concrète",
    process: "Trois étapes contrôlables",
    result: "Votre résultat",
    criteria: "Les critères à contrôler",
    prices: "Voir les prix",
    demo: "Voir comment fonctionne BelgoBase",
    guides: "À lire avant d’utiliser votre liste",
    related: "Autres applications",
    guideLanguage: " (guide en néerlandais)",
  },
  en: {
    eyebrow: {
      "bedrijven-zoeken": "Targeted company selection",
      prospectielijsten: "From target market to Excel",
      "klantenbestand-analyseren": "Your customer file as context",
      bedrijfsanalyse: "Assess one company clearly",
    },
    hero: {
      "bedrijven-zoeken": {
        heading: "Find Belgian companies. On your criteria.",
        summary: "Define your target market, review the selection and choose which companies and fields to export to Excel.",
      },
      prospectielijsten: {
        heading: "Your target market. Your next prospect list.",
        summary: "Turn location, activity and size into a reviewable selection your team checks before exporting it to Excel.",
      },
      "klantenbestand-analyseren": {
        heading: "Your customer file. A sharper starting point.",
        summary: "Use your Excel or CSV file as context, review the proposed target market and find Belgian companies using confirmed criteria.",
      },
      bedrijfsanalyse: {
        heading: "Company data. Clearly side by side.",
        summary: "Review available activity, staff and financial history together before selecting a company or refining your list.",
      },
    },
    task: "A concrete task",
    process: "Three reviewable steps",
    result: "Your result",
    criteria: "What to review the selection against",
    prices: "View pricing",
    demo: "See how BelgoBase works",
    guides: "Read more before using your list",
    related: "Other use cases",
    guideLanguage: " (Dutch-language guide)",
  },
};

export function createUseCaseMetadata(slug: UseCaseSlug) {
  return async ({ params }: Props): Promise<Metadata> => {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    const data = getUseCase(locale, slug);
    const url = buildCanonicalUrl(buildLocalizedPath(locale, slug));
    return {
      title: `${data.title} | BelgoBase`, description: data.description,
      alternates: { canonical: url, languages: buildLanguageAlternates(slug) },
      openGraph: { title: data.title, description: data.description, url, type: "website", images: ["/product/belgobase-journey-poster.webp"] },
      twitter: { card: "summary_large_image", title: data.title, description: data.description, images: ["/product/belgobase-journey-poster.webp"] },
    };
  };
}

export async function UseCasePage({ params, slug }: Props & { slug: UseCaseSlug }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const data = getUseCase(locale, slug);
  const copy = pageCopy[locale];
  const isCompanySearch = slug === "bedrijven-zoeken";
  const showcaseVariant = slug === "bedrijfsanalyse" ? "financial" : slug === "klantenbestand-analyseren" ? "workspace" : "selection";

  return <div className={`marketing-site ${styles.page}`}>
    <Header />
    <main>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <a href={`/${locale}`} className={styles.back}>← BelgoBase</a>
            <p className={styles.eyebrow}>{copy.eyebrow[slug]}</p>
            <h1>{copy.hero[slug].heading}</h1>
            <p className={styles.intro}>{copy.hero[slug].summary}</p>
            <div className={styles.heroActions}>
              <a href={`/${locale}${isCompanySearch ? "#contact" : "#product-demonstration"}`} className={styles.primaryAction}>
                {isCompanySearch ? data.primaryCta : copy.demo} <span aria-hidden="true">→</span>
              </a>
              {isCompanySearch && <a href={`/${locale}#product-demonstration`} className={styles.secondaryAction}>
                {isCompanySearch ? data.secondaryCta : copy.demo} <span aria-hidden="true">→</span>
              </a>}
              <a href={`/${locale}#pricing`} className={styles.priceLink}>{copy.prices} →</a>
            </div>
            {data.ctaMicrocopy && <p className={styles.microcopy}>{data.ctaMicrocopy}</p>}
          </div>
          <div className={styles.product}>
            <ProductShowcase locale={locale} variant={showcaseVariant} compact />
          </div>
        </div>
      </section>

      <div className={styles.content}>
        <blockquote className={styles.task}>
          <p>{copy.task}</p>
          <div className={styles.taskBody}>
            <q>{data.question}</q>
            <p className={styles.taskIntro}>{data.intro}</p>
          </div>
        </blockquote>

        <section className={styles.process} aria-labelledby="use-case-process">
          <h2 id="use-case-process" className={styles.sectionLabel}>{copy.process}</h2>
          <ol>
            {data.steps.map(([title, body], index) => <li key={title}>
              <span className={styles.stepNumber}>0{index + 1}</span>
              <div><h3>{title}</h3><p>{body}</p></div>
            </li>)}
          </ol>
        </section>

        <section className={styles.result}>
          <h2 className={styles.sectionLabel}>{copy.result}</h2>
          <p>{data.result}</p>
          <div className={styles.resultActions}>
            <a href={`/${locale}#contact`} className={styles.resultPrimary}>
              {data.primaryCta ?? (locale === "nl" ? "Bekijk het met uw eigen vraag" : locale === "fr" ? "Voir avec votre propre question" : "See it with your own question")} →
            </a>
            <a href={`/${locale}#product-demonstration`} className={styles.resultSecondary}>
              {data.secondaryCta ?? copy.demo} →
            </a>
          </div>
        </section>

        {data.criteria && <section className={styles.criteria}>
          <h2 className={styles.sectionLabel}>{copy.criteria}</h2>
          <div className={styles.criteriaGrid}>
            {data.criteria.map(([title, body]) => <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>)}
          </div>
        </section>}

        <aside className={styles.boundary}>
          <span aria-hidden="true">i</span>
          <p>{data.boundary}</p>
        </aside>

        <section className={styles.guides}>
          <h2 className={styles.sectionLabel}>{copy.guides}</h2>
          <div>
            {guideSlugs[slug].map(guideSlug => {
              const article = getBlogArticle(guideSlug);
              if (!article) return null;
              return <a key={guideSlug} href={`/nl/blog/${article.slug}`} hrefLang="nl">{article.title}{copy.guideLanguage} →</a>;
            })}
          </div>
        </section>

        <nav aria-label={copy.related} className={styles.related}>
          <h2 className={styles.sectionLabel}>{copy.related}</h2>
          <div>
            {useCaseSlugs.filter(other => other !== slug).map(other => <a key={other} href={`/${locale}/${other}`}>{getUseCase(locale, other).heading ?? getUseCase(locale, other).title} →</a>)}
          </div>
        </nav>
      </div>
    </main>
    <Footer />
  </div>;
}
