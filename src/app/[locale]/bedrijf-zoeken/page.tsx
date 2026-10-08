import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { CompanyLookup } from "@/components/public-company/CompanyLookup";
import { companyCopy } from "@/lib/public-company/copy";
import { buildCanonicalUrl, buildLanguageAlternates } from "@/lib/seo/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = companyCopy[locale];
  return {
    title: `${copy.title} — KBO en NBB | BelgoBase`, description: copy.intro,
    alternates: { canonical: buildCanonicalUrl(`/${locale}/bedrijf-zoeken`), languages: buildLanguageAlternates("bedrijf-zoeken") },
    openGraph: { title: copy.title, description: copy.intro, type: "website", url: buildCanonicalUrl(`/${locale}/bedrijf-zoeken`) },
  };
}

export default async function CompanyPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <CompanyLookup locale={locale} />;
}
