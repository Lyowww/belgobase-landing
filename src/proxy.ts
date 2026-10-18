import { NextRequest, NextResponse } from "next/server";
import { i18n, isLocale, type Locale } from "@/i18n/config";
import { PATHNAME_HEADER } from "@/lib/seo/metadata";
import {
  CSP_NONCE_HEADER,
  createCspNonce,
  publicPageSecurityHeaders,
  workspaceShellSecurityHeaders,
} from "@/lib/security-headers";

function isWorkspaceShellPath(pathname: string) {
  return i18n.locales.some(
    (locale) => pathname === `/${locale}/app` || pathname === `/${locale}/app/`,
  );
}

function applyResponseSecurityHeaders(
  response: NextResponse,
  pathname: string,
  nonce: string,
) {
  const securityHeaders = isWorkspaceShellPath(pathname)
    ? workspaceShellSecurityHeaders(nonce)
    : publicPageSecurityHeaders(nonce);
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

function withPathnameHeader(request: NextRequest, pathname: string) {
  const nonce = createCspNonce();
  const securityHeaders = isWorkspaceShellPath(pathname)
    ? workspaceShellSecurityHeaders(nonce)
    : publicPageSecurityHeaders(nonce);
  const csp = securityHeaders["Content-Security-Policy"];

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, pathname);
  // Next.js reads the request CSP header and stamps matching nonces on scripts.
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  return applyResponseSecurityHeaders(response, pathname, nonce);
}

function getPreferredLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const acceptLanguage = request.headers.get("accept-language")?.toLowerCase() ?? "";
  const preferences = acceptLanguage.split(",").map((entry, index) => {
    const [tag, ...parameters] = entry.trim().split(";");
    const quality = parameters.find(parameter => parameter.trim().startsWith("q="));
    return { language: tag.split("-")[0], quality: quality ? Number(quality.trim().slice(2)) : 1, index };
  }).filter(preference => isLocale(preference.language) && preference.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  if (preferences.length) return preferences[0].language as Locale;

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
  return applyResponseSecurityHeaders(
    NextResponse.redirect(url),
    url.pathname,
    createCspNonce(),
  );
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
