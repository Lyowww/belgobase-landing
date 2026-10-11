import type { CompanyMatch } from "./model";

export const peerKeys = ["activity", "revenue", "fte", "legalForm"] as const;
export type PeerKey = typeof peerKeys[number];
export type PeerTier = {
  key: PeerKey; count: number | null; available: boolean; unavailableReason?: string;
  criteria: { revenueMin?: number; revenueMax?: number | null; fteMin?: number; fteMax?: number | null; financialYear?: number; legalForm?: string };
  examples: CompanyMatch[];
};
export type CompanyPeers = {
  ok: true; referenceNumber: string;
  activity: { code: string; version: string; label: string };
  tiers: PeerTier[]; sources: { kboDate?: string };
};

// Explicit public projection; private company fields are never forwarded.
export function peersPayload(value: unknown): CompanyPeers | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const text = (v: unknown, max = 300): string | undefined => typeof v === "string" && v.length <= max ? v : undefined;
  const number = text(data.referenceNumber, 10);
  if (data.ok !== true || !number || !/^\d{10}$/.test(number) || !Array.isArray(data.tiers) || data.tiers.length !== 4) return null;
  if (!data.activity || typeof data.activity !== "object") return null;
  const activity = data.activity as Record<string, unknown>;
  const code = text(activity.code, 10), version = text(activity.version, 30), label = text(activity.label, 500);
  if (code === undefined || version === undefined || label === undefined) return null;
  const tiers: PeerTier[] = [];
  let previous: number | null = null;
  let unavailable = false;
  for (let index = 0; index < peerKeys.length; index++) {
    const row = data.tiers[index];
    if (!row || row.key !== peerKeys[index] || typeof row.available !== "boolean" || !Array.isArray(row.examples) || row.examples.length > 5) return null;
    if (row.available) {
      if (unavailable || !Number.isSafeInteger(row.count) || row.count < 0 || (previous !== null && row.count > previous) || row.examples.length !== Math.min(5, row.count)) return null;
      previous = row.count;
    } else {
      if (row.count !== null || row.examples.length !== 0) return null;
      unavailable = true;
    }
    const seen = new Set<string>();
    const examples: CompanyMatch[] = [];
    for (const item of row.examples) {
      const id = text(item?.number, 10), name = text(item?.name);
      if (!id || !/^\d{10}$/.test(id) || id === number || !name || seen.has(id)) return null;
      seen.add(id);
      examples.push({ number: id, name, municipality: text(item.municipality) });
    }
    const raw = row.criteria && typeof row.criteria === "object" ? row.criteria : {};
    const criteria: PeerTier["criteria"] = {};
    for (const key of ["revenueMin", "revenueMax", "fteMin", "fteMax"] as const) {
      const v = raw[key];
      if (v === undefined) continue;
      if (v === null && (key === "revenueMax" || key === "fteMax")) criteria[key] = null;
      else if (typeof v === "number" && Number.isFinite(v) && v >= 0) criteria[key] = v;
      else return null;
    }
    if (raw.financialYear !== undefined) {
      if (!Number.isInteger(raw.financialYear) || raw.financialYear < 1900 || raw.financialYear > 2100) return null;
      criteria.financialYear = raw.financialYear;
    }
    criteria.legalForm = text(raw.legalForm, 100);
    if (row.available) {
      if (!code || !version || !label) return null;
      if (index >= 1 && (criteria.revenueMin === undefined || criteria.revenueMax === undefined || !criteria.financialYear)) return null;
      if (index >= 2 && (criteria.fteMin === undefined || criteria.fteMax === undefined)) return null;
      if (index >= 3 && !criteria.legalForm) return null;
      if (criteria.revenueMax !== undefined && criteria.revenueMax !== null && criteria.revenueMax <= (criteria.revenueMin ?? 0)) return null;
      if (criteria.fteMax !== undefined && criteria.fteMax !== null && criteria.fteMax <= (criteria.fteMin ?? 0)) return null;
      if (index >= 2 && ["revenueMin", "revenueMax", "financialYear"].some((key) => raw[key] !== tiers[index - 1].criteria[key as keyof PeerTier["criteria"]])) return null;
      if (index >= 3 && ["fteMin", "fteMax"].some((key) => raw[key] !== tiers[index - 1].criteria[key as keyof PeerTier["criteria"]])) return null;
    }
    const reason = text(row.unavailableReason, 100);
    if (!row.available && !reason) return null;
    tiers.push({ key: row.key, count: row.count, available: row.available, unavailableReason: reason, criteria, examples });
  }
  const source = data.sources && typeof data.sources === "object" ? data.sources as Record<string, unknown> : {};
  const kboDate = text(source.kboDate, 10);
  return { ok: true, referenceNumber: number, activity: { code, version, label }, tiers,
    sources: { kboDate: kboDate && /^\d{4}-\d{2}-\d{2}$/.test(kboDate) ? kboDate : undefined } };
}
