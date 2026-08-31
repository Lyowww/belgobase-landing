import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal/LegalPage";
import { isLocale } from "@/i18n/config";
import { buildCanonicalUrl, buildLanguageAlternates, buildLocalizedPath } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const title = locale === "nl" ? "Algemene Voorwaarden B2B en Gebruiksvoorwaarden | BelgoBase" : "B2B Terms and Acceptable Use Terms | BelgoBase";
  const description = locale === "nl"
    ? "De voorwaarden voor zakelijke toegang tot en gebruik van BelgoBase, waaronder licentie, toegelaten gebruik, beëindiging en aansprakelijkheid."
    : "Read or download the current BelgoBase B2B terms and acceptable use terms. The published documents are available in Dutch.";
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
