import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal/LegalPage";
import { isLocale } from "@/i18n/config";
import { buildCanonicalUrl, buildLanguageAlternates, buildLocalizedPath } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const title = locale === "nl" ? "Cookieverklaring | BelgoBase" : "Cookie Notice | BelgoBase";
  const description = locale === "nl"
    ? "Welke cookies en vergelijkbare browseropslag BelgoBase gebruikt en hoe bezoekers hun voorkeuren beheren."
    : "Read or download the current BelgoBase cookie notice. The published document is available in Dutch.";
  return {
    title,
    description,
    alternates: { canonical: "./", languages: buildLanguageAlternates("cookies") },
    openGraph: { title, description, url: buildCanonicalUrl(buildLocalizedPath(locale, "cookies")) },
  };
}

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <LegalPage locale={locale} kind="cookies" />;
}
