import type { Locale } from "@/i18n/config";
import { buildCanonicalUrl, buildLocalizedPath, getRequestPathname } from "@/lib/seo/metadata";
import { siteUrl } from "@/lib/site";

type JsonLdProps = {
  locale: Locale;
  title: string;
  description: string;
};

export async function JsonLd({ locale, title, description }: JsonLdProps) {
  const pathname = await getRequestPathname(buildLocalizedPath(locale));

  // The layout renders this component for every localized route. Page-specific
  // structured data belongs on the route it describes, so keep this homepage
  // graph off legal pages and the private workspace.
  if (pathname !== buildLocalizedPath(locale)) return null;

  const url = buildCanonicalUrl(pathname);
  const nl = locale === "nl";

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "VideoObject",
        "@id": `${url}/#prospecting-demo`,
        name: nl ? "Vind passende bedrijven met BelgoBase" : locale === "fr" ? "Trouvez des entreprises adaptées avec BelgoBase" : "Find suitable companies with BelgoBase",
        description: nl
          ? "Echte productdemonstratie: van gesprek en bevestigde criteria naar 239 bedrijven in postcode 2800 met minstens 20 VTE en de daadwerkelijke Excel-export."
          : locale === "fr" ? "Démonstration réelle : de la conversation et des critères confirmés à 239 entreprises du code postal 2800 avec au moins 20 ETP et à l’export Excel réel." : "Real product demonstration: from conversation and confirmed criteria to 239 companies in postcode 2800 with at least 20 FTE and the actual Excel export.",
        thumbnailUrl: `${siteUrl}/product/belgobase-prospectiepijn-20261005.jpg`,
        contentUrl: `${siteUrl}/product/belgobase-prospectiepijn-20261005.mp4`,
        uploadDate: "2026-10-05",
        inLanguage: "nl-NL",
        duration: "PT1M58.963S",
        isFamilyFriendly: true,
      },
      {
        "@type": "VideoObject",
        "@id": `${url}/#list-cleanup-demo`,
        name: nl ? "Heb je al lijsten? Haal eruit wat erin zit." : locale === "fr" ? "Vous avez déjà des listes ? Tirez parti de leur contenu." : "Already have lists? Get more from what is in them.",
        description: nl
          ? "Echte desktopproef met bestaande Excelbestanden: lijsten samenbrengen, belinformatie indelen en onzekere gegevens laten controleren. Persoonsgegevens zijn afgeschermd."
          : locale === "fr" ? "Essai réel de la version de bureau avec des fichiers Excel existants : réunir les listes, classer les informations d’appel et vérifier les données incertaines. Données personnelles masquées." : "Real desktop trial with existing Excel files: merging lists, classifying calling information and reviewing uncertain data. Personal data is concealed.",
        thumbnailUrl: `${siteUrl}/product/belgobase-lijsten-20260929.jpg`,
        contentUrl: `${siteUrl}/product/belgobase-lijsten-20260929.mp4`,
        uploadDate: "2026-09-29T00:00:00Z",
        inLanguage: "nl-NL",
        duration: "PT1M36.15S",
        isFamilyFriendly: true,
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "BelgoBase",
        url: siteUrl,
        description,
        areaServed: {
          "@type": "Country",
          name: "Belgium",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "BelgoBase",
        description: title,
        inLanguage: `${locale}-BE`,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${url}/#webpage`,
        url,
        name: title,
        description,
        isPartOf: { "@id": `${siteUrl}/#website` },
        inLanguage: `${locale}-BE`,
      },
    ],
  };

  const serializedSchema = JSON.stringify(schema).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializedSchema }}
    />
  );
}
