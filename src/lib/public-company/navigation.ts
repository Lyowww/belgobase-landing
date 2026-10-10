import type { Locale } from "../../i18n/config.ts";
import { publicPayload, type CompanyMatch, type PublicCompany } from "./model.ts";

export const lookupTransferKey = "belgobase:company-language-transfer";
export const lookupErrors = ["", "short", "rate", "error", "limited", "notFound", "interrupted", "languageRestore"] as const;
export type LookupError = typeof lookupErrors[number];
export type LookupState = {
  query: string; matches: CompanyMatch[]; company?: PublicCompany;
  officialNumber: string; error: LookupError;
};

// This is a single-use navigation handoff, not a persistent data cache or retry.
export function saveLookupTransfer(storage: Pick<Storage, "setItem">, targetLocale: Locale, state: LookupState, now = Date.now()) {
  storage.setItem(lookupTransferKey, JSON.stringify({ targetLocale, savedAt: now, ...state }));
}

export function consumeLookupTransfer(storage: Pick<Storage, "getItem" | "removeItem">, locale: Locale, now = Date.now()): LookupState | null {
  const raw = storage.getItem(lookupTransferKey);
  if (raw === null) return null;
  storage.removeItem(lookupTransferKey);
  const value = JSON.parse(raw);
  if (value.targetLocale !== locale || !Number.isFinite(value.savedAt) || now < value.savedAt || now - value.savedAt > 120_000) return null;
  if (typeof value.query !== "string" || value.query.length > 100 || !lookupErrors.includes(value.error)
      || typeof value.officialNumber !== "string" || (value.officialNumber !== "" && !/^\d{10}$/.test(value.officialNumber))) {
    throw new Error("Invalid lookup navigation state");
  }
  const payload = publicPayload({ ok: true, matches: value.matches, company: value.company });
  if (!payload) throw new Error("Invalid lookup navigation payload");
  return { query: value.query, matches: payload.matches, company: payload.company, officialNumber: value.officialNumber, error: value.error };
}

export function companyLocaleTag(locale: Locale): string {
  // en-BE uses Dutch-style numeric separators in ICU; the English UI uses English notation.
  return locale === "en" ? "en-GB" : `${locale}-BE`;
}
