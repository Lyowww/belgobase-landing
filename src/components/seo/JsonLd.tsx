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
        name: locale === "nl" ? "BelgoBase: van gesprek naar prospectielijst" : "BelgoBase: from conversation to prospect list",
        description: locale === "nl"
          ? "Productdemonstratie van gesprek, klantenlijst uploaden, bedrijfsselectie, beschikbare contactgegevens controleren en Excel-export. Fictieve voorbeeldgegevens."
          : "Product demonstration of conversation, customer list upload, company selection, available contact research and Excel export. Fictional sample data; interface in Dutch.",
        thumbnailUrl: `${siteUrl}/product/belgobase-journey-poster.webp`,
        contentUrl: `${siteUrl}/product/belgobase-journey-demo.mp4`,
        uploadDate: "2026-09-27T21:00:00Z",
        inLanguage: "nl-BE",
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
