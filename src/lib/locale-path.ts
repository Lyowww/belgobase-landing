import { isLocale, type Locale } from "../i18n/config.ts";

export type PublicLocale = Locale;

export function getLocalizedPath(pathname: string, locale: PublicLocale): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && isLocale(segments[0])) {
    segments[0] = locale;
  } else {
    segments.unshift(locale);
  }
  return `/${segments.join("/")}`;
}

export function getLocalizedBrowserHref(
  pathname: string,
  locale: PublicLocale,
  search = "",
  hash = "",
): string {
  return `${getLocalizedPath(pathname, locale)}${search}${hash}`;
}
