export type CompanyMatch = { number: string; name: string; municipality?: string };
export type PublicCompany = {
  number: string; name: string; status?: string; legalForm?: string;
  startDate?: string; address?: string; website?: string;
  activities: { code: string; label: string }[];
  metrics: { key: string; label: string; value: number | null; year: number | null; unit: string; status?: string }[];
  sources: { kboDate?: string; nbbDate?: string };
  officialUrl: string;
};
export type CompanyResponse = { ok: boolean; matches: CompanyMatch[]; company?: PublicCompany; error?: string };

export function cleanQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC");
  if (/[\x00-\x1f\x7f]/.test(normalized)) return null;
  const query = normalized.trim().replace(/\s+/g, " ");
  if (query.length < 3 || query.length > 100) return null;
  return query;
}

export function safeWebsite(value: string | undefined): string | null {
  if (!value) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

// The public response is a separate allowlist, never a private workspace record.
export function publicPayload(value: unknown): CompanyResponse | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.ok !== true || !Array.isArray(data.matches) || data.matches.length > 8) return null;
  const text = (item: unknown, maximum = 300) => typeof item === "string" && item.length <= maximum ? item : undefined;
  const number = (item: unknown) => typeof item === "string" && /^\d{10}$/.test(item) ? item : null;
  const matches: CompanyMatch[] = [];
  for (const item of data.matches) {
    if (!item || typeof item !== "object") return null;
    const id = number(item.number); const name = text(item.name);
    if (!id || !name) return null;
    matches.push({ number: id, name, municipality: text(item.municipality) });
  }
  const result: CompanyResponse = { ok: true, matches };
  if (data.error === "natural_person_unavailable") result.error = data.error;
  if (!data.company) return result;
  if (typeof data.company !== "object") return null;
  const item = data.company as Record<string, unknown>;
  const id = number(item.number); const name = text(item.name);
  if (!id || !name || !Array.isArray(item.activities) || item.activities.length > 200 || !Array.isArray(item.metrics) || item.metrics.length > 5) return null;
  const activities: PublicCompany["activities"] = [];
  for (const activity of item.activities) {
    const code = text(activity?.code, 10); const label = text(activity?.label, 500);
    if (!code || !label) return null;
    activities.push({ code, label });
  }
  const metrics: PublicCompany["metrics"] = [];
  const metricUnits = new Map([ ["revenue", "EUR"], ["profit", "EUR"], ["equity", "EUR"], ["fte", "VTE"], ["ebitda", "EUR"] ]);
  const seen = new Set<string>();
  for (const metric of item.metrics) {
    if (!metric || !metricUnits.has(metric.key) || seen.has(metric.key)) return null;
    if (metric.value !== null && (typeof metric.value !== "number" || !Number.isFinite(metric.value))) return null;
    if (metric.year !== null && (typeof metric.year !== "number" || !Number.isInteger(metric.year) || metric.year < 1900 || metric.year > 2100)) return null;
    if (metric.unit !== metricUnits.get(metric.key)) return null;
    seen.add(metric.key);
    metrics.push({ key: metric.key, label: text(metric.label) || metric.key, value: metric.value, year: metric.year, unit: metric.unit, status: text(metric.status) });
  }
  const sources = item.sources && typeof item.sources === "object" ? item.sources as Record<string, unknown> : {};
  const sourceDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  result.company = {
    number: id, name, status: text(item.status), legalForm: text(item.legalForm), startDate: sourceDate(item.startDate),
    address: text(item.address, 700), website: safeWebsite(text(item.website, 2000)) || undefined,
    activities, metrics, sources: { kboDate: sourceDate(sources.kboDate), nbbDate: sourceDate(sources.nbbDate) },
    officialUrl: `https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html?nummer=${id}`,
  };
  return result;
}

export function displayNumber(value: string): string {
  return /^\d{10}$/.test(value) ? `${value.slice(0, 4)}.${value.slice(4, 7)}.${value.slice(7)}` : value;
}
