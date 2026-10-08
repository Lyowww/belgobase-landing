import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex } from "@/components/blog/BlogIndex";
import { isLocale } from "@/i18n/config";
import { blogIndexCopy } from "@/lib/blog/index-copy";
import { buildCanonicalUrl, buildLanguageAlternates, buildLocalizedPath } from "@/lib/seo/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const copy = blogIndexCopy[locale];
  const path = buildLocalizedPath(locale, "blog");
  const url = buildCanonicalUrl(path);
  const title = `${copy.title} | BelgoBase Blog`;

  return {
    title,
    description: copy.intro,
    alternates: {
      canonical: url,
      languages: buildLanguageAlternates("blog"),
    },
    openGraph: {
      title,
      description: copy.intro,
      type: "website",
      locale: `${locale}_BE`,
      url,
      siteName: "BelgoBase",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: copy.intro,
    },
  };
}

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <BlogIndex locale={locale} />;
}
