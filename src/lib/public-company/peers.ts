import type { CompanyMatch } from "./model";

export const peerKeys = ["activity", "municipality", "postcode", "fte"] as const;
export type PeerKey = typeof peerKeys[number];
export type PeerTier = {
  key: PeerKey; count: number | null; available: boolean; unavailableReason?: string;
  criteria: { municipality?: string; postcode?: string; fteMin?: number; fteMax?: number | null; financialYear?: number };
  examples: CompanyMatch[];
};
export type CompanyPeers = {
  ok: true; referenceNumber: string;
  activity: { code: string; version: string; label: string };
  tiers: PeerTier[]; sources: { kboDate?: string };
};

// Each comparison is an independent subset of the same activity, not a funnel.
// This public allowlist never forwards private records or arbitrary criteria.
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
  for (let index = 0; index < peerKeys.length; index++) {
    const row = data.tiers[index];
    if (!row || row.key !== peerKeys[index] || typeof row.available !== "boolean" || !Array.isArray(row.examples) || row.examples.length > 5) return null;
    if (row.available) {
      if (!code || !version || !label || !Number.isSafeInteger(row.count) || row.count < 0 || row.examples.length !== Math.min(5, row.count)) return null;
      if (index > 0 && (!tiers[0].available || row.count > tiers[0].count!)) return null;
    } else if (row.count !== null || row.examples.length !== 0) return null;
    const seen = new Set<string>();
    const examples: CompanyMatch[] = [];
    for (const item of row.examples) {
      const id = text(item?.number, 10), name = text(item?.name);
      if (!id || !/^\d{10}$/.test(id) || id === number || !name?.trim() || seen.has(id)) return null;
      seen.add(id);
      examples.push({ number: id, name, municipality: text(item.municipality) });
    }
    const raw = row.criteria && typeof row.criteria === "object" ? row.criteria : {};
    const criteria: PeerTier["criteria"] = {};
    for (const key of ["municipality", "postcode"] as const) {
      if (raw[key] === undefined) continue;
      const place = text(raw[key], 150);
      if (!place?.trim()) return null;
      if (key === "postcode" && !/^\d{4}$/.test(place)) return null;
      criteria[key] = place;
    }
    for (const key of ["fteMin", "fteMax"] as const) {
      const v = raw[key];
      if (v === undefined) continue;
      if (v === null && key === "fteMax") criteria[key] = null;
      else if (typeof v === "number" && Number.isFinite(v) && v >= 0) criteria[key] = v;
      else return null;
    }
    if (raw.financialYear !== undefined) {
      if (!Number.isInteger(raw.financialYear) || raw.financialYear < 1900 || raw.financialYear > 2100) return null;
      criteria.financialYear = raw.financialYear;
    }
    if (row.available) {
      if (row.key === "municipality" && !criteria.municipality) return null;
      if (row.key === "postcode" && !criteria.postcode) return null;
      if (row.key === "fte" && (criteria.fteMin === undefined || criteria.fteMax === undefined || !criteria.financialYear)) return null;
      if (criteria.fteMax !== undefined && criteria.fteMax !== null && criteria.fteMax <= (criteria.fteMin ?? 0)) return null;
    }
    const reason = text(row.unavailableReason, 100);
    if (!row.available && !reason?.trim()) return null;
    tiers.push({ key: row.key, count: row.count, available: row.available, unavailableReason: reason, criteria, examples });
  }
  const source = data.sources && typeof data.sources === "object" ? data.sources as Record<string, unknown> : {};
  const kboDate = text(source.kboDate, 10);
  return { ok: true, referenceNumber: number, activity: { code, version, label }, tiers,
    sources: { kboDate: kboDate && /^\d{4}-\d{2}-\d{2}$/.test(kboDate) ? kboDate : undefined } };
}
