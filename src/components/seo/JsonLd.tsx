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

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "VideoObject",
        "@id": `${url}/#product-demo`,
        name: locale === "nl" ? "BelgoBase: van Excelchaos naar overzicht" : "BelgoBase: from Excel chaos to clarity",
        description: locale === "nl"
          ? "Echte desktopproef met tien Excelbestanden: lijsten samenbrengen, belinformatie indelen en een AI-profiel beoordelen. Gegevens afgeschermd."
          : "Real desktop trial with ten Excel files: merging lists, categorising calling information and reviewing an AI profile. Data concealed; Dutch narration.",
        thumbnailUrl: `${siteUrl}/product/belgobase-excel-20260929.jpg`,
        contentUrl: `${siteUrl}/product/belgobase-excel-20260929.mp4`,
        uploadDate: "2026-09-29T13:40:00Z",
        inLanguage: "nl-NL",
        duration: "PT2M27.417S",
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
        inLanguage: locale === "nl" ? "nl-BE" : "en-BE",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${url}/#webpage`,
        url,
        name: title,
        description,
        isPartOf: { "@id": `${siteUrl}/#website` },
        inLanguage: locale === "nl" ? "nl-BE" : "en-BE",
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
