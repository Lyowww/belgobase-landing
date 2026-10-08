import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { blogArticles, formatBlogDate } from "@/lib/blog/articles";
import { blogIndexCopy } from "@/lib/blog/index-copy";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export function BlogIndex({ locale }: { locale: Locale }) {
  const copy = blogIndexCopy[locale];

  return (
    <div className="marketing-site min-h-screen bg-background">
      <Header />
      <main>
        <header className="mesh-hero border-b border-border px-5 pb-16 pt-32 sm:px-8 sm:pb-20 sm:pt-40">
          <div className="mx-auto max-w-5xl">
            <a href={`/${locale}`} className="text-base font-medium text-primary hover:underline">
              ← BelgoBase
            </a>
            <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {copy.eyebrow}
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-deep-navy sm:text-6xl">
              {copy.title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted">{copy.intro}</p>
            <p className="mt-5 max-w-3xl rounded-xl border border-primary/20 bg-surface/80 px-4 py-3 text-sm leading-6 text-foreground">
              {copy.languageNote}
            </p>
          </div>
        </header>

        <section aria-label={copy.eyebrow} className="mx-auto grid max-w-5xl gap-7 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2">
          {blogArticles.map((article) => (
            <article key={article.slug} className="premium-card flex h-full flex-col p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
                <span className="font-semibold text-primary">{copy.articleLanguage}</span>
                <span aria-hidden="true">•</span>
                <span>{article.readingTime}</span>
              </div>
              <h2 className="mt-5 text-2xl font-semibold leading-snug tracking-tight text-deep-navy sm:text-3xl">
                <Link href={`/nl/blog/${article.slug}`} className="hover:text-primary">
                  {article.title}
                </Link>
              </h2>
              <p className="mt-4 flex-1 text-base leading-7 text-muted">{article.excerpt}</p>
              <p className="mt-6 text-sm text-muted">
                <time dateTime={article.publishedAt}>
                  {copy.publishedPrefix} {formatBlogDate(article.publishedAt, locale)}
                </time>
              </p>
              <Link
                href={`/nl/blog/${article.slug}`}
                className="mt-6 inline-flex min-h-12 items-center self-start rounded-full bg-primary px-5 py-3 font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                {copy.readArticle} →
              </Link>
            </article>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
