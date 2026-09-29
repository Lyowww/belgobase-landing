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
        name: nl ? "Vind passende bedrijven met BelgoBase" : "Find suitable companies with BelgoBase",
        description: nl
          ? "Demonstratie met fictieve voorbeeldgegevens: van gesprek over aanbod en doelgroep naar een voorstel, bedrijvenlijst, contactgegevens en Excel-export."
          : "Demonstration with fictional example data: from a conversation about your offer and target market to a proposal, company list, contact details and Excel export.",
        thumbnailUrl: `${siteUrl}/product/belgobase-guided-poster.webp`,
        contentUrl: `${siteUrl}/product/belgobase-overview-20260929.mp4`,
        uploadDate: "2026-09-29T00:00:00Z",
        inLanguage: "nl-NL",
        duration: "PT1M37.81S",
        isFamilyFriendly: true,
      },
      {
        "@type": "VideoObject",
        "@id": `${url}/#list-cleanup-demo`,
        name: nl ? "Heb je al lijsten? Haal eruit wat erin zit." : "Already have lists? Get more from what is in them.",
        description: nl
          ? "Echte desktopproef met bestaande Excelbestanden: lijsten samenbrengen, belinformatie indelen en onzekere gegevens laten controleren. Persoonsgegevens zijn afgeschermd."
          : "Real desktop trial with existing Excel files: merging lists, classifying calling information and reviewing uncertain data. Personal data is concealed.",
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
        inLanguage: nl ? "nl-BE" : "en-BE",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${url}/#webpage`,
        url,
        name: title,
        description,
        isPartOf: { "@id": `${siteUrl}/#website` },
        inLanguage: nl ? "nl-BE" : "en-BE",
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
