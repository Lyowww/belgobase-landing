import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { getDictionary } from "@/i18n/dictionaries";
import { i18n, isLocale } from "@/i18n/config";
import { comingSoonEnabled, siteUrl } from "@/lib/site";
import { isResolvedTheme } from "@/lib/theme";
import { MotionProvider } from "@/providers/MotionProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { TranslationsProvider } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) return {};

  const dict = await getDictionary(localeParam);
  const keywords = dict.metadata.keywords.split(", ");
  const pageUrl = `${siteUrl}/${localeParam}`;
  const title = comingSoonEnabled ? dict.comingSoon.metadataTitle : dict.metadata.title;
  const description = comingSoonEnabled
    ? dict.comingSoon.metadataDescription
    : dict.metadata.description;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    keywords,
    applicationName: "BelgoBase",
    creator: "BelgoBase",
    formatDetection: {
      email: false,
      telephone: false,
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: localeParam === "nl" ? "nl_BE" : "en_BE",
      url: pageUrl,
      siteName: "BelgoBase",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `/${localeParam}`,
      languages: {
        en: "/en",
        nl: "/nl",
      },
    },
    robots: comingSoonEnabled
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const dictionary = await getDictionary(localeParam);
  const cookieStore = await cookies();
  const resolvedTheme = cookieStore.get("belgobase-resolved")?.value;
  const isDark = isResolvedTheme(resolvedTheme) && resolvedTheme === "dark";

  return (
    <html
      lang={localeParam}
      className={cn(geistSans.variable, "scroll-smooth")}
      data-scroll-behavior="smooth"
      style={isDark ? { colorScheme: "dark" } : { colorScheme: "light" }}
      suppressHydrationWarning
    >
      <body className="min-h-screen min-w-0 overflow-x-hidden bg-background font-sans text-foreground antialiased transition-colors duration-500">
        <JsonLd
          locale={localeParam}
          title={
            comingSoonEnabled
              ? dictionary.comingSoon.metadataTitle
              : dictionary.metadata.title
          }
          description={
            comingSoonEnabled
              ? dictionary.comingSoon.metadataDescription
              : dictionary.metadata.description
          }
        />
        <ThemeProvider>
          <MotionProvider>
            <TranslationsProvider locale={localeParam} dictionary={dictionary}>
              {children}
            </TranslationsProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
