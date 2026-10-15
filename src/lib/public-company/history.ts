import type { Locale } from "../../i18n/config.ts";
import { publicPayload } from "./model.ts";
import { lookupErrors, type LookupState } from "./navigation.ts";

export const lookupHistoryKey = "__belgobaseCompanyLookup";
export const lookupHistoryVersion = 1;
export const lookupHistoryTtlMs = 24 * 60 * 60 * 1_000;

const peerKeys = ["activity", "municipality", "postcode", "age", "fte"] as const;
const locales: readonly Locale[] = ["nl", "fr", "en"];
export type LookupHistoryPeerKey = typeof peerKeys[number];

export type LookupHistoryContext = { locale: Locale; url: string };
export type LookupHistoryView = LookupState & {
  expandedPeers: LookupHistoryPeerKey[];
  infoExpanded: boolean;
  activitiesExpanded: boolean;
  peerMethodExpanded: boolean;
  scrollY: number;
};

type LookupHistoryEntry = {
  version: typeof lookupHistoryVersion;
  savedAt: number;
  locale: Locale;
  url: string;
  view: LookupHistoryView;
};

export type LookupHistoryWriter = {
  readonly state: unknown;
  replaceState(data: unknown, unused: string): void;
  pushState(data: unknown, unused: string): void;
};

function routeKey(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048 || !value.startsWith("/") || value.startsWith("//") || /[\x00-\x1f\x7f]/.test(value)) return null;
  try {
    const parsed = new URL(value, "https://history.invalid");
    if (parsed.origin !== "https://history.invalid" || parsed.username || parsed.password || parsed.hash) return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function sanitizeView(value: unknown): LookupHistoryView | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.query !== "string" || raw.query.length > 100 || !lookupErrors.includes(raw.error as LookupState["error"])
      || typeof raw.officialNumber !== "string" || (raw.officialNumber !== "" && !/^\d{10}$/.test(raw.officialNumber))
      || typeof raw.infoExpanded !== "boolean" || typeof raw.activitiesExpanded !== "boolean" || typeof raw.peerMethodExpanded !== "boolean"
      || !Number.isInteger(raw.scrollY) || (raw.scrollY as number) < 0 || (raw.scrollY as number) > 10_000_000
      || !Array.isArray(raw.expandedPeers) || raw.expandedPeers.length > peerKeys.length) return null;

  const expandedPeers: LookupHistoryPeerKey[] = [];
  for (const key of raw.expandedPeers) {
    if (!peerKeys.includes(key as LookupHistoryPeerKey) || expandedPeers.includes(key as LookupHistoryPeerKey)) return null;
    expandedPeers.push(key as LookupHistoryPeerKey);
  }
  const payload = publicPayload({ ok: true, matches: raw.matches, company: raw.company });
  if (!payload) return null;
  return {
    query: raw.query,
    matches: payload.matches,
    company: payload.company,
    officialNumber: raw.officialNumber,
    error: raw.error as LookupState["error"],
    expandedPeers,
    infoExpanded: raw.infoExpanded,
    activitiesExpanded: raw.activitiesExpanded,
    peerMethodExpanded: raw.peerMethodExpanded,
    scrollY: raw.scrollY as number,
  };
}

function createEntry(context: LookupHistoryContext, view: LookupHistoryView, now: number): LookupHistoryEntry | null {
  const url = routeKey(context.url);
  const clean = sanitizeView({ ...view, scrollY: Math.round(view.scrollY) });
  if (!locales.includes(context.locale) || !url || !Number.isFinite(now) || !clean) return null;
  return { version: lookupHistoryVersion, savedAt: now, locale: context.locale, url, view: clean };
}

function mergeEntry(current: unknown, entry: LookupHistoryEntry): Record<string, unknown> {
  const base = current && typeof current === "object" && !Array.isArray(current) ? current as Record<string, unknown> : {};
  return { ...base, [lookupHistoryKey]: entry };
}

export function readInitialLookupHistory(state: unknown, context: LookupHistoryContext, now = Date.now()): LookupHistoryView | null {
  const url = routeKey(context.url);
  if (!locales.includes(context.locale) || !url || !state || typeof state !== "object" || Array.isArray(state)) return null;
  const entry = (state as Record<string, unknown>)[lookupHistoryKey];
  if (!entry || typeof entry !== "object") return null;
  const raw = entry as Record<string, unknown>;
  if (raw.version !== lookupHistoryVersion || raw.locale !== context.locale || raw.url !== url || !Number.isFinite(raw.savedAt)
      || now < (raw.savedAt as number) || now - (raw.savedAt as number) > lookupHistoryTtlMs) return null;
  return sanitizeView(raw.view);
}

export function readLookupPopState(event: { state: unknown }, context: LookupHistoryContext, now = Date.now()): LookupHistoryView | null {
  return readInitialLookupHistory(event.state, context, now);
}

export function replaceCurrentLookupHistory(history: LookupHistoryWriter, context: LookupHistoryContext, view: LookupHistoryView, now = Date.now()): boolean {
  const entry = createEntry(context, view, now);
  if (!entry) return false;
  history.replaceState(mergeEntry(history.state, entry), "");
  return true;
}

export function pushLookupHistory(history: LookupHistoryWriter, context: LookupHistoryContext, view: LookupHistoryView, now = Date.now()): boolean {
  const entry = createEntry(context, view, now);
  if (!entry) return false;
  history.pushState(mergeEntry(history.state, entry), "");
  return true;
}
