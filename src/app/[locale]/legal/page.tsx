import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal/LegalPage";
import { isLocale } from "@/i18n/config";
import { buildCanonicalUrl, buildLanguageAlternates, buildLocalizedPath } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const title = locale === "nl" ? "Wettelijke vermeldingen | BelgoBase" : "Legal Notice | BelgoBase";
  const description = locale === "nl"
    ? "Juridische informatie over de BelgoBase-website, de aanbieder en de toepasselijke voorwaarden."
    : "Read or download the current legal notice for the BelgoBase website. The published document is available in Dutch.";
  return {
    title,
    description,
    alternates: { canonical: "./", languages: buildLanguageAlternates("legal") },
    openGraph: { title, description, url: buildCanonicalUrl(buildLocalizedPath(locale, "legal")) },
  };
}

export default async function LegalNoticePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <LegalPage locale={locale} kind="legal" />;
}
