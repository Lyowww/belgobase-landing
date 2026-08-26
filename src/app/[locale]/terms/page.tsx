import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal/LegalPage";
import { isLocale } from "@/i18n/config";
import { buildCanonicalUrl, buildLanguageAlternates, buildLocalizedPath } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const title = locale === "nl" ? "Pilotvoorwaarden en Gebruiksvoorwaarden v1.0" : "Pilot Terms and Acceptable Use - Dutch version controls";
  const description = locale === "nl" ? "De juridisch leidende Pilotvoorwaarden en Gebruiksvoorwaarden van BelgoBase, versie 1.0." : "English summary of the BelgoBase pilot terms. The Dutch version 1.0 is legally controlling.";
  return {
    title,
    description,
    alternates: { canonical: "./", languages: buildLanguageAlternates("terms") },
    openGraph: { title, description, url: buildCanonicalUrl(buildLocalizedPath(locale, "terms")) },
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <LegalPage locale={locale} kind="terms" />;
}
