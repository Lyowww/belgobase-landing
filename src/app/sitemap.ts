import type { MetadataRoute } from "next";
import { i18n } from "@/i18n/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://belgobase.com";

  return i18n.locales.map((locale) => ({
    url: `${baseUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 1,
    alternates: {
      languages: {
        en: `${baseUrl}/en`,
        nl: `${baseUrl}/nl`,
      },
    },
  }));
}
