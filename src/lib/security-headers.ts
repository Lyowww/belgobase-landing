/**
 * Content-Security-Policy builders.
 *
 * Nonce-based script-src requires per-request dynamic rendering (Next applies the
 * nonce from the request CSP header during SSR). HTML responses must not be
 * CDN-cached across users without stripping/replacing the nonce.
 */

export const CSP_NONCE_HEADER = "x-nonce";

const turnstileOrigins = "https://challenges.cloudflare.com";

const googleScriptOrigins =
  "https://www.googletagmanager.com https://www.googleadservices.com https://www.google.com";

const NONCE_PATTERN = /^[A-Za-z0-9+/_-]+=*$/;

export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function assertCspNonce(nonce: string): string {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new Error("Invalid CSP nonce");
  }
  return nonce;
}

/** Tag every HTML script element with the request nonce (skips already-nonced tags). */
export function applyHtmlScriptNonce(html: string, nonce: string): string {
  const safeNonce = assertCspNonce(nonce);
  return html.replace(/<script(\s[^>]*)?>/gi, (full, attrs = "") => {
    if (/\bnonce\s*=/i.test(attrs)) return full;
    return `<script nonce="${safeNonce}"${attrs}>`;
  });
}

function scriptSrcDirective(nonce: string, hostAllowlist = ""): string {
  const safeNonce = assertCspNonce(nonce);
  const isDev = process.env.NODE_ENV === "development";
  // Host allowlists remain as a fallback for browsers that ignore 'strict-dynamic'.
  // Modern browsers honor 'strict-dynamic' so nonce-trusted app code can load
  // Turnstile/Google via document.createElement('script').
  const hosts = hostAllowlist.trim();
  return [
    "script-src 'self'",
    `'nonce-${safeNonce}'`,
    "'strict-dynamic'",
    hosts,
    isDev ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const publicPageBaseHeaders = {
  // Client-side navigation to /app retains this document's permissions policy.
  // Permit same-origin requests; the browser still requires user consent.
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

export function publicPageCsp(nonce: string): string {
  return [
    "default-src 'self'",
    scriptSrcDirective(nonce, `${turnstileOrigins} ${googleScriptOrigins}`),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://www.google.be",
    "font-src 'self'",
    `connect-src 'self' ${turnstileOrigins} https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://region1.analytics.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://www.google.be https://ad.doubleclick.net`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-src 'self' ${turnstileOrigins} https://www.googletagmanager.com`,
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function workspaceShellCsp(nonce: string): string {
  return [
    "default-src 'self'",
    scriptSrcDirective(nonce, turnstileOrigins),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${turnstileOrigins}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-src 'self' ${turnstileOrigins}`,
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function workspaceCsp(nonce: string): string {
  const safeNonce = assertCspNonce(nonce);
  // Workspace HTML inlines its scripts; 'strict-dynamic' lets nonce-trusted
  // numberfinder code build sandboxed srcdoc documents that reuse the nonce.
  return [
    "default-src 'none'",
    `script-src 'nonce-${safeNonce}' 'strict-dynamic'`,
    "style-src 'unsafe-inline'",
    "img-src data:",
    "font-src 'none'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

export function publicPageSecurityHeaders(nonce: string) {
  return {
    ...publicPageBaseHeaders,
    "Content-Security-Policy": publicPageCsp(nonce),
  };
}

export function workspaceShellSecurityHeaders(nonce: string) {
  return {
    ...publicPageBaseHeaders,
    "Content-Security-Policy": workspaceShellCsp(nonce),
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
  };
}

export function workspaceSecurityHeaders(nonce: string) {
  return {
    "Content-Security-Policy": workspaceCsp(nonce),
    "Permissions-Policy": "microphone=(self), camera=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
  };
}
