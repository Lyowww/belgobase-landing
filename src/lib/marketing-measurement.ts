import {
  PUBLIC_GA4_MEASUREMENT_ID,
  PUBLIC_GOOGLE_ADS_CONVERSION_LABEL,
  PUBLIC_GOOGLE_ADS_ID,
  PUBLIC_MARKETING_MEASUREMENT_ENABLED,
} from "./marketing-measurement-config.ts";

export const MARKETING_CONSENT_COOKIE = "bb_marketing_consent_v2";
export const LEGACY_MARKETING_CONSENT_COOKIE = "bb_marketing_consent";
export const MARKETING_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const GOOGLE_TAG_SCRIPT_ID = "bb-google-measurement-tag";
const LEAD_STORAGE_PREFIX = "bb-google-lead:";
const GOOGLE_COOKIE_PREFIXES = ["_ga", "_gid", "_gat", "_gcl_", "_gac_", "_gads", "_gpi"];
const GA4_EVENT_NAMES = new Set([
  "cta_click",
  "generate_lead",
  "page_view",
  "scroll_depth",
  "video_complete",
  "video_start",
]);

const marketingPageSlugs = new Set([
  "",
  "bedrijfsanalyse",
  "bedrijven-zoeken",
  "klantenbestand-analyseren",
  "prospectielijsten",
]);

const trackedCtaTargets = new Map([
  ["contact", "contact"],
  ["pricing", "pricing"],
  ["product-demonstration", "product_demo"],
  ["process", "process"],
]);
const trackedVideoIds = new Map([
  ["product-demonstration", "product_demonstration"],
  ["list-cleanup-demo-card", "list_cleanup"],
]);

export type MarketingConsentPreferences = {
  version: 2;
  analytics: boolean;
  ads: boolean;
};

export type MarketingMeasurementConfig = {
  adsId: string;
  conversionLabel: string;
  conversionDestination: string;
  ga4MeasurementId: string | null;
};

type Gtag = (...args: unknown[]) => void;
type ActiveMeasurement = { analytics: boolean; ads: boolean };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    __bbGoogleMeasurementActive?: ActiveMeasurement;
    __bbLastGa4PageUrl?: string;
  }
}

const queuedLeadIds = new Set<string>();
let removeInteractionTracking: (() => void) | null = null;
let reachedScrollDepths = new Set<number>();

export function getMarketingMeasurementConfig(
  adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? PUBLIC_GOOGLE_ADS_ID,
  conversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL
    ?? PUBLIC_GOOGLE_ADS_CONVERSION_LABEL,
  ga4MeasurementIdOrEnabled: string | boolean =
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? PUBLIC_GA4_MEASUREMENT_ID,
  enabled = PUBLIC_MARKETING_MEASUREMENT_ENABLED,
): MarketingMeasurementConfig | null {
  const effectiveEnabled = typeof ga4MeasurementIdOrEnabled === "boolean"
    ? ga4MeasurementIdOrEnabled
    : enabled;
  const ga4MeasurementId = typeof ga4MeasurementIdOrEnabled === "string"
    ? ga4MeasurementIdOrEnabled.trim()
    : PUBLIC_GA4_MEASUREMENT_ID;

  if (!effectiveEnabled) return null;
  const normalizedAdsId = adsId?.trim() ?? "";
  const normalizedLabel = conversionLabel?.trim() ?? "";
  if (!/^AW-\d{6,20}$/.test(normalizedAdsId)) return null;
  if (!/^[A-Za-z0-9_-]{4,100}$/.test(normalizedLabel)) return null;
  if (ga4MeasurementId && !/^G-[A-Z0-9]{4,20}$/.test(ga4MeasurementId)) return null;

  return {
    adsId: normalizedAdsId,
    conversionLabel: normalizedLabel,
    conversionDestination: `${normalizedAdsId}/${normalizedLabel}`,
    ga4MeasurementId: ga4MeasurementId || null,
  };
}

export function marketingMeasurementEnabled(): boolean {
  return getMarketingMeasurementConfig() !== null;
}

export function isMarketingPublicPathname(pathname: string): boolean {
  const parts = pathname.split("?")[0]?.split("#")[0]?.split("/").filter(Boolean) ?? [];
  if (parts.length < 1 || parts.length > 2) return false;
  if (parts[0] !== "nl" && parts[0] !== "en" && parts[0] !== "fr") return false;
  return marketingPageSlugs.has(parts[1] ?? "");
}

const preferenceValue = (preferences: MarketingConsentPreferences) =>
  `v2:a${preferences.analytics ? "1" : "0"}:d${preferences.ads ? "1" : "0"}`;

export function readMarketingConsent(
  cookieString = document.cookie,
): MarketingConsentPreferences | null {
  const encodedName = `${encodeURIComponent(MARKETING_CONSENT_COOKIE)}=`;
  const entry = cookieString
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(encodedName));
  const value = entry ? decodeURIComponent(entry.slice(encodedName.length)) : "";
  const match = /^v2:a([01]):d([01])$/.exec(value);
  if (!match) return null;
  return { version: 2, analytics: match[1] === "1", ads: match[2] === "1" };
}

function consentCookie(preferences: MarketingConsentPreferences): string {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `${encodeURIComponent(MARKETING_CONSENT_COOKIE)}=${preferenceValue(preferences)}; Path=/; Max-Age=${MARKETING_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
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

export function sanitizeReferrerHost(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.origin;
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

export function sanitizeMeasurementPageUrl(
  rawUrl: string,
  includeGoogleClickIds: boolean,
): string {
  const cleanUrl = sanitizePageUrl(rawUrl);
  if (!cleanUrl || !includeGoogleClickIds) return cleanUrl;
  const clickIds = extractGoogleClickIds(rawUrl);
  if (Object.keys(clickIds).length === 0) return cleanUrl;
  const url = new URL(cleanUrl);
  for (const name of ["gclid", "gbraid", "wbraid"] as const) {
    const value = clickIds[name];
    if (value) url.searchParams.set(name, value);
  }
  return url.toString();
}

export function marketingVideoId(wrapperId: string): string {
  return trackedVideoIds.get(wrapperId) ?? "";
}

function ensureGtag(): Gtag {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? function gtag() {
    // Match Google's supported snippet: it queues the function's IArguments object.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
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

function clearLeadSessionState() {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(LEAD_STORAGE_PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in privacy modes; the in-memory guard remains.
  }
}

function ga4Active(config: MarketingMeasurementConfig): boolean {
  return Boolean(
    config.ga4MeasurementId
      && window.__bbGoogleMeasurementActive?.analytics
      && readMarketingConsent()?.analytics,
  );
}

function emitGa4Event(
  name: string,
  parameters: Record<string, string | number>,
  config = getMarketingMeasurementConfig(),
): boolean {
  if (!config?.ga4MeasurementId || !GA4_EVENT_NAMES.has(name) || !ga4Active(config)) return false;
  if (!isMarketingPublicPathname(window.location.pathname)) return false;
  try {
    const includeGoogleClickIds = Boolean(readMarketingConsent()?.ads);
    ensureGtag()("event", name, {
      ...parameters,
      page_location: sanitizeMeasurementPageUrl(window.location.href, includeGoogleClickIds),
      send_to: config.ga4MeasurementId,
    });
    return true;
  } catch {
    return false;
  }
}

function resetPageInteractionState() {
  reachedScrollDepths = new Set<number>();
}

function installInteractionTracking(config: MarketingMeasurementConfig) {
  if (removeInteractionTracking || typeof window.addEventListener !== "function"
    || typeof document.addEventListener !== "function") return;

  const onScroll = () => {
    const root = document.documentElement;
    const available = Math.max(1, root.scrollHeight - window.innerHeight);
    const depth = Math.min(100, Math.round((window.scrollY / available) * 100));
    for (const threshold of [50, 90]) {
      if (depth >= threshold && !reachedScrollDepths.has(threshold)) {
        reachedScrollDepths.add(threshold);
        emitGa4Event("scroll_depth", { percent_scrolled: threshold }, config);
      }
    }
  };
  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!anchor) return;
    const href = anchor.getAttribute("href") ?? "";
    let ctaName = "";
    if (href.startsWith("#")) ctaName = trackedCtaTargets.get(href.slice(1)) ?? "";
    else if (/^\/(?:nl|en)\/app(?:[/?#]|$)/.test(href)) ctaName = "open_workspace";
    if (ctaName) emitGa4Event("cta_click", { cta_name: ctaName }, config);
  };
  const onVideo = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLVideoElement)) return;
    const wrapper = target.closest("#product-demonstration, #list-cleanup-demo-card");
    const videoId = marketingVideoId(wrapper?.id ?? "");
    if (!videoId) return;
    emitGa4Event(event.type === "ended" ? "video_complete" : "video_start", {
      video_id: videoId,
    }, config);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("click", onClick);
  document.addEventListener("play", onVideo, true);
  document.addEventListener("ended", onVideo, true);
  removeInteractionTracking = () => {
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("click", onClick);
    document.removeEventListener("play", onVideo, true);
    document.removeEventListener("ended", onVideo, true);
    removeInteractionTracking = null;
  };
}

export function trackMarketingPageView(
  config = getMarketingMeasurementConfig(),
): boolean {
  if (!config?.ga4MeasurementId || !ga4Active(config)) return false;
  const pageUrl = sanitizePageUrl(window.location.href);
  if (!pageUrl || window.__bbLastGa4PageUrl === pageUrl) return false;
  const referrer = window.__bbLastGa4PageUrl
    ? sanitizeReferrerHost(window.__bbLastGa4PageUrl)
    : sanitizeReferrerHost(document.referrer);
  const sent = emitGa4Event("page_view", { page_referrer: referrer }, config);
  if (sent) {
    window.__bbLastGa4PageUrl = pageUrl;
    resetPageInteractionState();
  }
  return sent;
}

export function initializeMarketingMeasurement(
  config = getMarketingMeasurementConfig(),
): boolean {
  if (!config || !isMarketingPublicPathname(window.location.pathname)) return false;
  const preferences = readMarketingConsent();
  if (!preferences) return false;
  const analytics = Boolean(preferences.analytics && config.ga4MeasurementId);
  const ads = preferences.ads;
  if (!analytics && !ads) return false;

  try {
    const previous = window.__bbGoogleMeasurementActive;
    const gtag = ensureGtag();
    const safePageUrl = sanitizeMeasurementPageUrl(window.location.href, ads);
    const safeReferrer = window.__bbLastGa4PageUrl
      ? sanitizeReferrerHost(window.__bbLastGa4PageUrl)
      : sanitizeReferrerHost(document.referrer);
    if (!previous) {
      gtag("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      });
      gtag("set", "ads_data_redaction", true);
      gtag("js", new Date());
    }
    gtag("consent", "update", {
      ad_storage: ads ? "granted" : "denied",
      ad_user_data: ads ? "granted" : "denied",
      ad_personalization: "denied",
      analytics_storage: analytics ? "granted" : "denied",
    });
    gtag("set", {
      page_location: safePageUrl,
      page_referrer: safeReferrer,
    });

    if (ads && !previous?.ads) {
      gtag("config", config.adsId, {
        allow_ad_personalization_signals: false,
        page_location: safePageUrl,
        page_referrer: safeReferrer,
        send_page_view: false,
      });
    }
    if (analytics && !previous?.analytics) {
      gtag("config", config.ga4MeasurementId, {
        allow_ad_personalization_signals: false,
        allow_google_signals: false,
        anonymize_ip: true,
        cookie_expires: MARKETING_CONSENT_MAX_AGE_SECONDS,
        page_location: safePageUrl,
        page_referrer: safeReferrer,
        send_page_view: false,
      });
    }

    window.__bbGoogleMeasurementActive = { analytics, ads };
    if (!document.getElementById(GOOGLE_TAG_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = GOOGLE_TAG_SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
        analytics && config.ga4MeasurementId ? config.ga4MeasurementId : config.adsId,
      )}`;
      document.head.appendChild(script);
    }
    if (analytics) {
      installInteractionTracking(config);
      trackMarketingPageView(config);
    }
    return true;
  } catch {
    removeGoogleScript();
    removeInteractionTracking?.();
    window.__bbGoogleMeasurementActive = undefined;
    return false;
  }
}

export function suspendMarketingMeasurement({ reloadDocument = false } = {}) {
  const hadActiveTag = Boolean(window.__bbGoogleMeasurementActive);
  if (hadActiveTag) {
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
  window.__bbGoogleMeasurementActive = undefined;
  window.__bbLastGa4PageUrl = undefined;
  removeInteractionTracking?.();
  removeGoogleScript();
  deleteGoogleMarketingCookies();
  if (reloadDocument && hadActiveTag) window.location.reload();
}

export function setMarketingConsent(
  preferences: MarketingConsentPreferences,
  config = getMarketingMeasurementConfig(),
): boolean {
  const previous = readMarketingConsent();
  document.cookie = consentCookie(preferences);
  expireCookie(LEGACY_MARKETING_CONSENT_COOKIE);
  const revoked = Boolean(
    previous && ((previous.analytics && !preferences.analytics) || (previous.ads && !preferences.ads)),
  );
  if (revoked) {
    clearLeadSessionState();
    queuedLeadIds.clear();
    suspendMarketingMeasurement({ reloadDocument: true });
    return true;
  }
  if (!preferences.analytics && !preferences.ads) {
    clearLeadSessionState();
    queuedLeadIds.clear();
    suspendMarketingMeasurement();
    return true;
  }
  return initializeMarketingMeasurement(config);
}

export function syncMarketingMeasurementForPath(pathname: string): boolean {
  if (!isMarketingPublicPathname(pathname)) {
    suspendMarketingMeasurement({ reloadDocument: true });
    return false;
  }
  return initializeMarketingMeasurement();
}

function leadAlreadySent(provider: "ads" | "ga4", conversionId: string): boolean {
  const key = `${provider}:${conversionId}`;
  if (queuedLeadIds.has(key)) return true;
  try {
    return window.sessionStorage.getItem(`${LEAD_STORAGE_PREFIX}${key}`) === "sent";
  } catch {
    return false;
  }
}

function rememberLead(provider: "ads" | "ga4", conversionId: string) {
  const key = `${provider}:${conversionId}`;
  queuedLeadIds.add(key);
  try {
    window.sessionStorage.setItem(`${LEAD_STORAGE_PREFIX}${key}`, "sent");
  } catch {
    // Storage failure does not make the successfully delivered form fail.
  }
}

export function trackGoogleAdsConversion(
  conversionId: string,
  config = getMarketingMeasurementConfig(),
): boolean {
  if (!config || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(conversionId)) return false;
  if (!window.__bbGoogleMeasurementActive || !isMarketingPublicPathname(window.location.pathname)) return false;
  const preferences = readMarketingConsent();
  if (!preferences) return false;
  let sent = false;

  if (preferences.analytics && config.ga4MeasurementId && !leadAlreadySent("ga4", conversionId)) {
    if (emitGa4Event("generate_lead", { currency: "EUR", value: 0 }, config)) {
      rememberLead("ga4", conversionId);
      sent = true;
    }
  }
  if (preferences.ads && window.__bbGoogleMeasurementActive.ads
    && !leadAlreadySent("ads", conversionId)) {
    try {
      ensureGtag()("event", "conversion", {
        currency: "EUR",
        page_location: sanitizeMeasurementPageUrl(window.location.href, true),
        send_to: config.conversionDestination,
        transaction_id: conversionId,
        value: 0,
      });
      rememberLead("ads", conversionId);
      sent = true;
    } catch {
      // The form remains successful when the optional vendor call fails.
    }
  }
  return sent;
}

// Local cleanup only: never load or notify Google when measurement is disabled.
export function clearDisabledMarketingStorage() {
  suspendMarketingMeasurement();
  expireCookie(MARKETING_CONSENT_COOKIE);
  expireCookie(LEGACY_MARKETING_CONSENT_COOKIE);
  clearLeadSessionState();
  queuedLeadIds.clear();
}
