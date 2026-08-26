import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal/LegalPage";
import { isLocale } from "@/i18n/config";
import { buildCanonicalUrl, buildLanguageAlternates, buildLocalizedPath } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const title = locale === "nl" ? "Privacyverklaring BelgoBase-pilot v1.0" : "BelgoBase Pilot Privacy Notice - Dutch version controls";
  const description = locale === "nl" ? "Privacyverklaring voor de zakelijke BelgoBase-pilot, versie 1.0." : "English summary of the BelgoBase pilot privacy notice. The Dutch version 1.0 controls.";
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
