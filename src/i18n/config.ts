export const i18n = {
  defaultLocale: "en" as const,
  locales: ["en", "nl"] as const,
};

export type Locale = (typeof i18n.locales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  nl: "Nederlands",
};

export const localeFlags: Record<Locale, string> = {
  en: "🇬🇧",
  nl: "🇳🇱",
};

export function isLocale(value: string): value is Locale {
  return i18n.locales.includes(value as Locale);
}
