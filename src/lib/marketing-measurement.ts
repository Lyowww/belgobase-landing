import {
  PUBLIC_GOOGLE_ADS_CONVERSION_LABEL,
  PUBLIC_GOOGLE_ADS_ID,
} from "./marketing-measurement-config.ts";

export const MARKETING_CONSENT_COOKIE = "bb_marketing_consent";
export const MARKETING_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const GOOGLE_TAG_SCRIPT_ID = "bb-google-ads-tag";
const CONVERSION_STORAGE_PREFIX = "bb-google-ads-conversion:";
const GOOGLE_COOKIE_PREFIXES = ["_gcl_", "_gac_", "_gads", "_gpi"];

const marketingPageSlugs = new Set([
  "",
  "bedrijfsanalyse",
  "bedrijven-zoeken",
  "klantenbestand-analyseren",
  "prospectielijsten",
]);

export type MarketingConsentChoice = "granted" | "denied";

export type MarketingMeasurementConfig = {
  adsId: string;
  conversionLabel: string;
  conversionDestination: string;
};

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: Gtag;
    __bbGoogleAdsActive?: boolean;
  }
}

const queuedConversionIds = new Set<string>();

export function getMarketingMeasurementConfig(
  adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? PUBLIC_GOOGLE_ADS_ID,
  conversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL
    ?? PUBLIC_GOOGLE_ADS_CONVERSION_LABEL,
): MarketingMeasurementConfig | null {
  const normalizedAdsId = adsId?.trim() ?? "";
  const normalizedLabel = conversionLabel?.trim() ?? "";

  if (!/^AW-\d{6,20}$/.test(normalizedAdsId)) return null;
  if (!/^[A-Za-z0-9_-]{4,100}$/.test(normalizedLabel)) return null;

  return {
    adsId: normalizedAdsId,
    conversionLabel: normalizedLabel,
    conversionDestination: `${normalizedAdsId}/${normalizedLabel}`,
  };
}

export function marketingMeasurementEnabled(): boolean {
  return getMarketingMeasurementConfig() !== null;
}

export function isMarketingPublicPathname(pathname: string): boolean {
  const parts = pathname.split("?")[0]?.split("#")[0]?.split("/").filter(Boolean) ?? [];
  if (parts.length < 1 || parts.length > 2) return false;
  if (parts[0] !== "nl" && parts[0] !== "en") return false;
  return marketingPageSlugs.has(parts[1] ?? "");
}

export function readMarketingConsent(cookieString = document.cookie): MarketingConsentChoice | null {
  const encodedName = `${encodeURIComponent(MARKETING_CONSENT_COOKIE)}=`;
  const entry = cookieString
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(encodedName));
  const value = entry ? decodeURIComponent(entry.slice(encodedName.length)) : "";
  return value === "granted" || value === "denied" ? value : null;
}

function consentCookie(choice: MarketingConsentChoice): string {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `${encodeURIComponent(MARKETING_CONSENT_COOKIE)}=${choice}; Path=/; Max-Age=${MARKETING_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function sanitizePageUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

export function extractGoogleClickIds(rawUrl: string): Record<string, string> {
  try {
    const url = new URL(rawUrl);
    const clickIds: Record<string, string> = {};
    for (const name of ["gclid", "gbraid", "wbraid"] as const) {
      const value = url.searchParams.get(name)?.trim();
      if (value && /^[A-Za-z0-9._~-]{1,256}$/.test(value)) clickIds[name] = value;
    }
    return clickIds;
  } catch {
    return {};
  }
}

function ensureGtag(): Gtag {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? ((...args: unknown[]) => {
    window.dataLayer?.push(args);
  });
  return window.gtag;
}

function removeGoogleScript() {
  document.getElementById(GOOGLE_TAG_SCRIPT_ID)?.remove();
}

function expireCookie(name: string, domain?: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domainPart = domain ? `; Domain=${domain}` : "";
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${domainPart}${secure}`;
}

export function deleteGoogleMarketingCookies() {
  const names = document.cookie
    .split(";")
    .map((entry) => decodeURIComponent(entry.trim().split("=")[0] ?? ""))
    .filter((name) => GOOGLE_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix)));
  const hostname = window.location.hostname;
  const hostnameParts = hostname.split(".");
  const parentDomain = hostnameParts.length >= 3 ? hostnameParts.slice(1).join(".") : "";

  for (const name of names) {
    expireCookie(name);
    if (hostname && hostname !== "localhost") {
      expireCookie(name, hostname);
      expireCookie(name, `.${hostname}`);
    }
    if (parentDomain) {
      expireCookie(name, parentDomain);
      expireCookie(name, `.${parentDomain}`);
    }
  }
}

function clearConversionSessionState() {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(CONVERSION_STORAGE_PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in privacy modes; the in-memory guard remains.
  }
}

export function initializeMarketingMeasurement(
  config = getMarketingMeasurementConfig(),
): boolean {
  if (!config || !isMarketingPublicPathname(window.location.pathname)) return false;
  if (readMarketingConsent() !== "granted") return false;
  if (window.__bbGoogleAdsActive) return true;

  try {
    const gtag = ensureGtag();
    const safePageUrl = sanitizePageUrl(window.location.href);
    const clickIds = extractGoogleClickIds(window.location.href);

    gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
    gtag("set", "ads_data_redaction", true);
    // Required for tag-based Ads conversion attribution after explicit consent.
    // No user_data payload or enhanced-conversion fields are configured or sent.
    gtag("consent", "update", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
    gtag("set", {
      ...clickIds,
      page_location: safePageUrl,
      page_referrer: "",
    });
    gtag("js", new Date());
    gtag("config", config.adsId, {
      allow_ad_personalization_signals: false,
      page_location: safePageUrl,
      page_referrer: "",
      send_page_view: false,
    });

    const script = document.createElement("script");
    script.id = GOOGLE_TAG_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.adsId)}`;
    document.head.appendChild(script);
    window.__bbGoogleAdsActive = true;
    return true;
  } catch {
    removeGoogleScript();
    window.__bbGoogleAdsActive = false;
    return false;
  }
}

export function suspendMarketingMeasurement({ reloadDocument = false } = {}) {
  if (window.__bbGoogleAdsActive) {
    try {
      window.gtag?.("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      });
    } catch {
      // A vendor failure must never block navigation or the contact form.
    }
  }

  const hadActiveTag = Boolean(window.__bbGoogleAdsActive);
  window.__bbGoogleAdsActive = false;
  removeGoogleScript();
  deleteGoogleMarketingCookies();

  if (reloadDocument && hadActiveTag) window.location.reload();
}

export function setMarketingConsent(
  choice: MarketingConsentChoice,
  config = getMarketingMeasurementConfig(),
): boolean {
  document.cookie = consentCookie(choice);
  if (choice === "granted") return initializeMarketingMeasurement(config);

  clearConversionSessionState();
  suspendMarketingMeasurement({ reloadDocument: true });
  return true;
}

export function syncMarketingMeasurementForPath(pathname: string): boolean {
  if (!isMarketingPublicPathname(pathname)) {
    suspendMarketingMeasurement({ reloadDocument: true });
    return false;
  }
  return readMarketingConsent() === "granted" ? initializeMarketingMeasurement() : false;
}

export function trackGoogleAdsConversion(
  conversionId: string,
  config = getMarketingMeasurementConfig(),
): boolean {
  if (!config || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(conversionId)) return false;
  if (!window.__bbGoogleAdsActive || readMarketingConsent() !== "granted") return false;
  if (!isMarketingPublicPathname(window.location.pathname)) return false;

  const storageKey = `${CONVERSION_STORAGE_PREFIX}${conversionId}`;
  if (queuedConversionIds.has(conversionId)) return false;
  try {
    if (window.sessionStorage.getItem(storageKey) === "sent") return false;
  } catch {
    // Continue with the in-memory deduplication guard.
  }

  queuedConversionIds.add(conversionId);
  try {
    window.sessionStorage.setItem(storageKey, "sent");
  } catch {
    // Storage failure does not make the successfully delivered form fail.
  }

  try {
    ensureGtag()("event", "conversion", {
      currency: "EUR",
      page_location: sanitizePageUrl(window.location.href),
      page_referrer: "",
      send_to: config.conversionDestination,
      transaction_id: conversionId,
      value: 0,
    });
    return true;
  } catch {
    return false;
  }
}
