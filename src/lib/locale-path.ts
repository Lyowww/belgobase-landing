export type PublicLocale = "en" | "nl";

export function getLocalizedPath(pathname: string, locale: PublicLocale): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "en" || segments[0] === "nl") {
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
