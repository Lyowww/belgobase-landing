import Link from "next/link";
import { formatBlogDate, type BlogArticle as BlogArticleData } from "@/lib/blog/articles";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export function BlogArticle({ article }: { article: BlogArticleData }) {
  return (
    <div className="marketing-site min-h-screen bg-background">
      <Header />
      <main>
        <article>
          <header className="mesh-hero border-b border-border px-5 pb-14 pt-32 sm:px-8 sm:pb-20 sm:pt-40">
            <div className="mx-auto max-w-4xl">
              <nav aria-label="Kruimelpad" className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <Link href="/nl" className="hover:text-primary hover:underline">BelgoBase</Link>
                <span aria-hidden="true">/</span>
                <Link href="/nl/blog" className="hover:text-primary hover:underline">Blog</Link>
              </nav>
              <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Praktische gids</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-deep-navy sm:text-6xl">
                {article.title}
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-muted">{article.description}</p>
              <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
                <span>Door {article.author}</span>
                <span aria-hidden="true">•</span>
                <time dateTime={article.publishedAt}>{formatBlogDate(article.publishedAt, "nl")}</time>
                <span aria-hidden="true">•</span>
                <span>{article.readingTime}</span>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
            <div className="space-y-6 border-b border-border pb-10 text-lg leading-8 text-foreground">
              {article.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>

            <div className="space-y-12 py-12">
              {article.sections.map((section) => (
                <section key={section.heading} aria-labelledby={`${article.slug}-${section.heading.split(".")[0]}`}>
                  <h2
                    id={`${article.slug}-${section.heading.split(".")[0]}`}
                    className="text-2xl font-semibold leading-snug tracking-tight text-deep-navy sm:text-3xl"
                  >
                    {section.heading}
                  </h2>
                  <div className="mt-5 space-y-5 text-base leading-8 text-foreground sm:text-lg">
                    {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  </div>
                  {section.points ? (
                    <ul className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-5 text-base leading-7 text-foreground sm:p-7">
                      {section.points.map((point) => (
                        <li key={point} className="flex gap-3">
                          <span aria-hidden="true" className="mt-1 font-semibold text-primary">✓</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            <aside className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8" aria-labelledby="meer-over-onderwerp">
              <h2 id="meer-over-onderwerp" className="text-2xl font-semibold text-deep-navy">Verder met uw eigen gegevens</h2>
              <p className="mt-3 text-base leading-7 text-muted">
                Bekijk hoe BelgoBase deze aanpak in een concrete selectie of bestandsanalyse ondersteunt.
              </p>
              <div className="mt-5 space-y-3">
                {article.relatedLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="block font-semibold text-primary hover:underline">
                    {link.label} →
                  </Link>
                ))}
              </div>
              <Link
                href="/nl#product-demonstration"
                className="mt-7 inline-flex min-h-12 items-center rounded-full bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                Bekijk de productdemo →
              </Link>
            </aside>

            <aside className="mt-10 border-t border-border pt-8 text-sm leading-6 text-muted" aria-labelledby="bronnen-en-grenzen">
              <h2 id="bronnen-en-grenzen" className="font-semibold text-deep-navy">Bronnen en grenzen</h2>
              <p className="mt-3">
                BelgoBase gebruikt beschikbare officiële Belgische bedrijfs- en financiële gegevens. Raadpleeg voor de broncontext ook de
                {" "}<a className="text-primary hover:underline" href="https://economie.fgov.be/nl/themas/ondernemingen/kruispuntbank-van" rel="noreferrer">Kruispuntbank van Ondernemingen</a>
                {" "}en de <a className="text-primary hover:underline" href="https://www.nbb.be/nl/balanscentrale" rel="noreferrer">Balanscentrale van de Nationale Bank van België</a>.
                Bronvelden kunnen ontbreken of wijzigen; deze gids is praktische productuitleg en geen juridisch, financieel of commercieel advies.
              </p>
            </aside>

            <nav aria-label="Blog" className="mt-10 border-t border-border pt-8">
              <Link href="/nl/blog" className="font-semibold text-primary hover:underline">← Terug naar alle artikelen</Link>
            </nav>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
