import { headers } from "next/headers";
import type { Metadata } from "next";
import { isLocale, type Locale } from "@/i18n/config";
import { siteUrl } from "@/lib/site";

/** Set by proxy on every document request for runtime pathname resolution. */
export const PATHNAME_HEADER = "x-pathname";

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function parseLocalizedPathname(pathname: string): {
  locale: Locale | null;
  pathWithoutLocale: string;
} {
  const normalized = normalizePathname(pathname);
  const segments = normalized.split("/").filter(Boolean);
  const first = segments[0];

  if (!first || !isLocale(first)) {
    return { locale: null, pathWithoutLocale: segments.join("/") };
  }

  return {
    locale: first,
    pathWithoutLocale: segments.slice(1).join("/"),
  };
}

export function buildLocalizedPath(locale: Locale, pathWithoutLocale = ""): string {
  const suffix = pathWithoutLocale ? `/${pathWithoutLocale}` : "";
  return `/${locale}${suffix}`;
}

export function buildCanonicalUrl(pathname: string): string {
  return `${siteUrl}${normalizePathname(pathname)}`;
}

export function buildLanguageAlternates(pathWithoutLocale = ""): Record<string, string> {
  const suffix = pathWithoutLocale ? `/${pathWithoutLocale}` : "";

  return {
    en: `${siteUrl}/en${suffix}`,
    nl: `${siteUrl}/nl${suffix}`,
    "x-default": pathWithoutLocale ? `${siteUrl}${suffix}` : siteUrl,
  };
}

export async function getRequestPathname(fallbackPathname: string): Promise<string> {
  const headersList = await headers();
  const fromHeader = headersList.get(PATHNAME_HEADER);
  return normalizePathname(fromHeader ?? fallbackPathname);
}

/**
 * Factory for page-level `generateMetadata` that sets self-referencing canonical
 * (`./`) and locale-aware hreflang alternates for a fixed route suffix.
 *
 * @param pathWithoutLocale - Route segments after the locale, e.g. `"pricing"` for `/en/pricing`.
 */
export function createLocalizedPageMetadata(pathWithoutLocale = "") {
  return async function generateLocalizedPageMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    if (!isLocale(locale)) return {};

    const pathname = buildLocalizedPath(locale, pathWithoutLocale);

    return {
      alternates: {
        canonical: "./",
        languages: buildLanguageAlternates(pathWithoutLocale),
      },
      openGraph: {
        url: buildCanonicalUrl(pathname),
      },
    };
  };
}
