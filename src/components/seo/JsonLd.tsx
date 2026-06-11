import type { Locale } from "@/i18n/config";
import { siteUrl } from "@/lib/site";

type JsonLdProps = {
  locale: Locale;
  title: string;
  description: string;
};

export function JsonLd({ locale, title, description }: JsonLdProps) {
  const url = `${siteUrl}/${locale}`;

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
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

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
