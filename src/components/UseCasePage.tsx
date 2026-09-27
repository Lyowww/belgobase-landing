import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getUseCase, useCaseSlugs, type UseCaseSlug } from "@/lib/seo/use-cases";
import { buildCanonicalUrl, buildLanguageAlternates, buildLocalizedPath } from "@/lib/seo/metadata";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

type Props = { params: Promise<{ locale: string }> };
export function createUseCaseMetadata(slug: UseCaseSlug) {
  return async ({ params }: Props): Promise<Metadata> => {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    const data = getUseCase(locale, slug);
    const url = buildCanonicalUrl(buildLocalizedPath(locale, slug));
    return {
      title: `${data.title} | BelgoBase`, description: data.description,
      alternates: { canonical: url, languages: buildLanguageAlternates(slug) },
      openGraph: { title: data.title, description: data.description, url, type: "website", images: ["/product/belgobase-journey-poster.webp"] },
      twitter: { card: "summary_large_image", title: data.title, description: data.description, images: ["/product/belgobase-journey-poster.webp"] },
    };
  };
}

export async function UseCasePage({ params, slug }: Props & { slug: UseCaseSlug }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const data = getUseCase(locale, slug);
  const nl = locale === "nl";
  return <div className="marketing-site">
    <Header />
    <main className="mx-auto max-w-5xl px-5 pb-20 pt-32 sm:px-8 sm:pt-40">
      <a href={`/${locale}`} className="text-base text-primary hover:underline">← BelgoBase</a>
      <h1 className="mt-8 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-deep-navy sm:text-6xl">{data.title}</h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-muted">{data.intro}</p>
      <blockquote className="my-12 rounded-2xl border border-primary/20 bg-primary/5 p-7 text-xl leading-8 text-deep-navy sm:p-10">
        <p className="mb-3 text-sm font-semibold text-primary">{nl ? "Zo kan uw gesprek beginnen" : "Start your conversation like this"}</p>
        “{data.question}”
      </blockquote>
      <ol className="space-y-10">
        {data.steps.map(([title, body], index) => <li key={title} className="grid gap-3 sm:grid-cols-[3rem_1fr]">
          <span className="text-xl font-semibold text-primary">0{index + 1}</span>
          <div><h2 className="text-2xl font-semibold text-deep-navy">{title}</h2><p className="mt-3 max-w-3xl text-base leading-8 text-muted">{body}</p></div>
        </li>)}
      </ol>
      <section className="my-12 rounded-2xl bg-[#0a1730] p-7 text-white sm:p-10">
        <h2 className="text-2xl font-semibold">{nl ? "Wat u overhoudt" : "Your result"}</h2>
        <p className="mt-4 text-lg leading-8">{data.result}</p>
        <a href={`/${locale}#contact`} className="mt-7 inline-flex min-h-12 items-center rounded-full bg-white px-6 py-3 font-semibold text-slate-950">{nl ? "Bekijk het met uw eigen vraag" : "See it with your own question"} →</a>
        <a href={`/${locale}#product-demonstration`} className="mt-5 block text-base text-white underline underline-offset-4">{nl ? "Bekijk de productdemo" : "Watch the product demo"}</a>
      </section>
      <p className="text-base leading-7 text-muted">{data.boundary}</p>
      <nav aria-label={nl ? "Andere toepassingen" : "Related use cases"} className="mt-12 border-t border-border pt-8">
        <h2 className="mb-4 text-xl font-semibold text-deep-navy">{nl ? "Ook met BelgoBase" : "Also with BelgoBase"}</h2>
        {useCaseSlugs.filter(other => other !== slug).map(other => <a key={other} href={`/${locale}/${other}`} className="block py-2 text-primary hover:underline">{getUseCase(locale, other).title} →</a>)}
      </nav>
    </main>
    <Footer />
  </div>;
}
