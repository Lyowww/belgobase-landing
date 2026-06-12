import fs from "node:fs";
import path from "node:path";
import { i18n, type Locale } from "@/i18n/config";
import { buildCanonicalUrl, buildLanguageAlternates, buildLocalizedPath } from "@/lib/seo/metadata";

const LOCALE_APP_DIR = path.join(process.cwd(), "src/app/[locale]");

const IGNORED_ROUTE_DIRS = new Set(["api"]);

function discoverRouteSuffixes(dir: string, prefix = ""): string[] {
  const routes: string[] = [];

  if (fs.existsSync(path.join(dir, "page.tsx"))) {
    routes.push(prefix);
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("(") || entry.name.startsWith("[") || IGNORED_ROUTE_DIRS.has(entry.name)) {
      continue;
    }

    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    routes.push(...discoverRouteSuffixes(path.join(dir, entry.name), nextPrefix));
  }

  return routes;
}

/** Static route suffixes under `/[locale]`, e.g. `""` for home, `"pricing"` for `/en/pricing`. */
export function getLocalizedRouteSuffixes(): string[] {
  if (!fs.existsSync(LOCALE_APP_DIR)) return [""];

  const suffixes = discoverRouteSuffixes(LOCALE_APP_DIR);
  return [...new Set(suffixes)].sort((a, b) => a.localeCompare(b));
}

export type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: "weekly";
  priority: number;
  alternates: {
    languages: Record<string, string>;
  };
};

export function buildSitemapEntries(): SitemapEntry[] {
  const suffixes = getLocalizedRouteSuffixes();
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];

  for (const suffix of suffixes) {
    const languages = buildLanguageAlternates(suffix);

    for (const locale of i18n.locales) {
      const pathname = buildLocalizedPath(locale, suffix);
      const url = buildCanonicalUrl(pathname);

      if (seen.has(url)) continue;
      seen.add(url);

      entries.push({
        url,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: suffix === "" ? 1 : 0.8,
        alternates: { languages },
      });
    }
  }

  return entries;
}

export function getLocalePathsForSuffix(suffix: string): Record<Locale, string> {
  return Object.fromEntries(
    i18n.locales.map((locale) => [locale, buildLocalizedPath(locale, suffix)]),
  ) as Record<Locale, string>;
}
