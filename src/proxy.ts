import { NextRequest, NextResponse } from "next/server";
import { i18n, isLocale, type Locale } from "@/i18n/config";
import { PATHNAME_HEADER } from "@/lib/seo/metadata";

function withPathnameHeader(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function getPreferredLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const acceptLanguage = request.headers.get("accept-language")?.toLowerCase() ?? "";
  if (acceptLanguage.includes("nl")) return "nl";

  return i18n.defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = i18n.locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) {
    return withPathnameHeader(request, pathname);
  }

  const locale = getPreferredLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
