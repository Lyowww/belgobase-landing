import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import { i18n, isLocale } from "@/i18n/config";
import { isResolvedTheme } from "@/lib/theme";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { TranslationsProvider } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
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

  return {
    title: dict.metadata.title,
    description: dict.metadata.description,
    keywords,
    openGraph: {
      title: dict.metadata.title,
      description: dict.metadata.description,
      type: "website",
      locale: localeParam === "nl" ? "nl_BE" : "en_BE",
    },
    alternates: {
      canonical: `/${localeParam}`,
      languages: {
        en: "/en",
        nl: "/nl",
      },
    },
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
      className={cn(
        geistSans.variable,
        geistMono.variable,
        "scroll-smooth",
        isDark && "dark",
      )}
      data-scroll-behavior="smooth"
      style={isDark ? { colorScheme: "dark" } : { colorScheme: "light" }}
      suppressHydrationWarning
    >
      <body className="min-h-screen min-w-0 overflow-x-hidden bg-background font-sans text-foreground antialiased transition-colors duration-500">
        <ThemeProvider>
          <TranslationsProvider locale={localeParam} dictionary={dictionary}>
            {children}
          </TranslationsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
