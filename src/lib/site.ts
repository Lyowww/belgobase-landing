const DEFAULT_SITE_URL = "https://belgobase.com";

function normalizeSiteUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Canonical production origin — never falls back to Vercel preview URLs. */
export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL);

export const isProduction =
  process.env.VERCEL_ENV === "production" ||
  (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview");

/** Set to true to show the coming soon page instead of the full landing. */
export const comingSoonEnabled = false;

export const contactPhone = "+32 488 13 96 64";
export const contactPhoneHref = "tel:+32488139664";
export const contactEmail = "legal@belgobase.be";
