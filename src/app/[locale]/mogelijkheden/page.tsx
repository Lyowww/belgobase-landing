import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Globe2, LockKeyhole } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { isLocale } from "@/i18n/config";
import { capabilitiesCopy } from "@/lib/capabilities";
import { getUseCase, useCaseSlugs } from "@/lib/seo/use-cases";
import { buildCanonicalUrl, buildLanguageAlternates } from "@/lib/seo/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = capabilitiesCopy[locale];
  const url = buildCanonicalUrl(`/${locale}/mogelijkheden`);
  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    alternates: {
      canonical: url,
      languages: buildLanguageAlternates("mogelijkheden"),
    },
    openGraph: {
      title: copy.metadataTitle,
      description: copy.metadataDescription,
      type: "website",
      url,
      images: ["/product/belgobase-journey-poster.webp"],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.metadataTitle,
      description: copy.metadataDescription,
      images: ["/product/belgobase-journey-poster.webp"],
    },
  };
}
export default async function CapabilitiesPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = capabilitiesCopy[locale];

  return (
    <div className="marketing-site">
      <Header />
      <main className="min-w-0 overflow-x-hidden">
        <section className="mesh-hero border-b border-border px-5 pb-16 pt-32 sm:px-8 sm:pb-20 sm:pt-40">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{copy.eyebrow}</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-deep-navy sm:text-6xl">
              {copy.title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted">{copy.intro}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={`/${locale}#contact`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-dark">
                {copy.demoCta}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href={`/${locale}/app`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface px-6 py-3 font-semibold text-deep-navy transition-colors hover:border-primary hover:text-primary">
                {copy.workspaceCta}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section aria-label={copy.workspaceLabel} className="bg-surface px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
              <LockKeyhole className="h-6 w-6 text-primary" aria-hidden="true" />
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-primary">{copy.workspaceLabel}</p>
              <h2 className="mt-2 text-2xl font-semibold text-deep-navy">{copy.workspaceTitle}</h2>
              <p className="mt-3 leading-7 text-muted">{copy.workspaceDescription}</p>
            </div>
            <div className="rounded-2xl border border-border bg-section-alt p-6 sm:p-8">
              <Globe2 className="h-6 w-6 text-primary" aria-hidden="true" />
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-primary">{copy.publicLabel}</p>
              <h2 className="mt-2 text-2xl font-semibold text-deep-navy">{copy.publicTitle}</h2>
              <p className="mt-3 leading-7 text-muted">{copy.publicDescription}</p>
              <Link href={`/${locale}/bedrijf-zoeken`} className="mt-5 inline-flex items-center gap-2 font-semibold text-primary hover:underline">
                {copy.lookupCta}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="bg-background px-5 pb-20 sm:px-8 sm:pb-28">
          <div className="mx-auto max-w-6xl space-y-16">
            {copy.groups.map((group, groupIndex) => (
              <section key={group.title} aria-labelledby={`capability-group-${groupIndex}`}>
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold text-primary">{group.access === "public" ? copy.publicLabel : copy.workspaceLabel}</p>
                  <h2 id={`capability-group-${groupIndex}`} className="mt-2 text-3xl font-semibold tracking-tight text-deep-navy sm:text-4xl">{group.title}</h2>
                  <p className="mt-3 text-base leading-7 text-muted">{group.intro}</p>
                </div>
                <ol className="mt-8 grid gap-4 md:grid-cols-2">
                  {group.items.map((item) => (
                    <li key={item.title} data-capability className="rounded-2xl border border-border bg-surface p-6 shadow-[0_16px_38px_-34px_rgba(15,35,70,0.6)] sm:p-7">
                      <div className="flex items-start gap-4">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="text-xl font-semibold leading-7 text-deep-navy">{item.title}</h3>
                          <p className="mt-3 text-base leading-7 text-muted">{item.description}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </div>

        <section className="section-alt border-t border-border px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-3xl font-semibold tracking-tight text-deep-navy sm:text-4xl">{copy.useCasesTitle}</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted">{copy.useCasesIntro}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {useCaseSlugs.map((slug) => {
                const useCase = getUseCase(locale, slug);
                return (
                  <Link key={slug} href={`/${locale}/${slug}`} className="group rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-primary sm:p-7">
                    <h3 className="text-xl font-semibold text-deep-navy">{useCase.heading ?? useCase.title}</h3>
                    <p className="mt-3 line-clamp-2 leading-7 text-muted">{useCase.description}</p>
                    <span className="mt-5 inline-flex items-center gap-2 font-semibold text-primary">
                      {copy.useCaseLinkLabel}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

