import { NextRequest, NextResponse } from "next/server";
import { i18n, isLocale, type Locale } from "@/i18n/config";
import { PATHNAME_HEADER } from "@/lib/seo/metadata";
import {
  publicPageSecurityHeaders,
  workspaceShellSecurityHeaders,
} from "@/lib/security-headers";

function withSecurityHeaders(response: NextResponse, pathname: string) {
  const isWorkspaceShell = i18n.locales.some(
    (locale) => pathname === `/${locale}/app` || pathname === `/${locale}/app/`,
  );
  const securityHeaders = isWorkspaceShell
    ? workspaceShellSecurityHeaders
    : publicPageSecurityHeaders;
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

function withPathnameHeader(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, pathname);
  return withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    pathname,
  );
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
  return withSecurityHeaders(NextResponse.redirect(url), url.pathname);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
