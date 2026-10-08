import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog/BlogArticle";
import { blogArticles, getBlogArticle } from "@/lib/blog/articles";
import { buildCanonicalUrl } from "@/lib/seo/metadata";
import { siteUrl } from "@/lib/site";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return blogArticles.map((article) => ({ locale: "nl", slug: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (locale !== "nl") return {};

  const article = getBlogArticle(slug);
  if (!article) return {};

  const url = buildCanonicalUrl(`/nl/blog/${article.slug}`);

  return {
    title: `${article.title} | BelgoBase`,
    description: article.description,
    authors: [{ name: article.author }],
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      locale: "nl_BE",
      url,
      siteName: "BelgoBase",
      publishedTime: article.publishedAt,
      authors: [article.author],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
    },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  if (locale !== "nl") notFound();

  const article = getBlogArticle(slug);
  if (!article) notFound();

  const articleUrl = buildCanonicalUrl(`/nl/blog/${article.slug}`);
  const indexUrl = buildCanonicalUrl("/nl/blog");
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${articleUrl}#article`,
        headline: article.title,
        description: article.description,
        datePublished: article.publishedAt,
        dateModified: article.publishedAt,
        inLanguage: "nl-BE",
        mainEntityOfPage: { "@id": articleUrl },
        author: { "@type": "Organization", name: article.author, url: siteUrl },
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${articleUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "BelgoBase", item: `${siteUrl}/nl` },
          { "@type": "ListItem", position: 2, name: "Blog", item: indexUrl },
          { "@type": "ListItem", position: 3, name: article.title, item: articleUrl },
        ],
      },
    ],
  };
  const serializedStructuredData = JSON.stringify(structuredData).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializedStructuredData }}
      />
      <BlogArticle article={article} />
    </>
  );
}
