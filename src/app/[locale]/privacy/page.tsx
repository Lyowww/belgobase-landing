import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal/LegalPage";
import { isLocale } from "@/i18n/config";
import { buildCanonicalUrl, buildLanguageAlternates, buildLocalizedPath } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const title = locale === "nl" ? "Privacyverklaring | BelgoBase" : "Privacy Notice | BelgoBase";
  const description = locale === "nl"
    ? "Hoe NovaVenture Group BV, handelend onder de naam BelgoBase, persoonsgegevens verwerkt en welke rechten betrokkenen hebben."
    : "Read or download the current BelgoBase privacy notice. The published document is available in Dutch.";
  return {
    title,
    description,
    alternates: { canonical: "./", languages: buildLanguageAlternates("privacy") },
    openGraph: { title, description, url: buildCanonicalUrl(buildLocalizedPath(locale, "privacy")) },
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <LegalPage locale={locale} kind="privacy" />;
}
