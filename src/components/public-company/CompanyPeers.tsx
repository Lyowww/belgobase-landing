"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle, BriefcaseBusiness, MapPin, Map, Users, Phone, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { peersCopy } from "@/lib/public-company/peers-copy";
import { peersPayload, type CompanyPeers as PeerData, type PeerTier } from "@/lib/public-company/peers";
import { companyLocaleTag } from "@/lib/public-company/navigation";
import type { LookupHistoryPeerKey } from "@/lib/public-company/history";
import { displayNumber } from "@/lib/public-company/model";
import { contactPhone, contactPhoneHref, salesContactEmail } from "@/lib/site";

export function CompanyPeers({ number, locale, onSelect, expanded, onExpandedChange, methodExpanded, onMethodExpandedChange, onSettled }: { number: string; locale: Locale; onSelect: (number: string) => void; expanded: LookupHistoryPeerKey[]; onExpandedChange: (keys: LookupHistoryPeerKey[]) => void; methodExpanded: boolean; onMethodExpandedChange: (open: boolean) => void; onSettled: () => void }) {
  const copy = peersCopy[locale];
  const [data, setData] = useState<PeerData>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const tag = companyLocaleTag(locale);
  const tierIcons = { activity: BriefcaseBusiness, municipality: MapPin, postcode: Map, fte: Users };
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/public/company-peers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: number }), signal: controller.signal });
        const result = response.ok ? peersPayload(await response.json()) : null;
        if (!result || result.referenceNumber !== number) throw new Error("unavailable");
        if (!controller.signal.aborted) setData(result);
      } catch { if (!controller.signal.aborted) setError(true); }
    })();
    return () => controller.abort();
  }, [number, attempt]);
  useEffect(() => { if (data || error) onSettled(); }, [data, error, onSettled]);

  function range(min: number | undefined, max: number | null | undefined) {
    const formatter = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
    if (min === undefined) return "";
    return max === null || max === undefined ? `${copy.from} ${formatter.format(min)}` : `${formatter.format(min)} ${copy.below} ${formatter.format(max)}`;
  }
  function reason(tier: PeerTier) {
    return ({ no_activity: copy.noActivity, no_postcode: copy.noPostcode, no_municipality: copy.noMunicipality, no_fte: copy.noFte, comparison_limit: copy.comparisonLimit } as Record<string, string>)[tier.unavailableReason || ""] || copy.unavailable;
  }
  return <section className="lookup-peers" aria-labelledby="peers-title">
    <h3 id="peers-title">{copy.heading}</h3>
    {!data && !error && <p className="lookup-peers-loading" role="status"><LoaderCircle size={20} className="lookup-spin" aria-hidden="true" />{copy.pending}</p>}
    {error && <div className="lookup-peers-error" role="status"><p>{copy.error}</p><button onClick={() => { setError(false); setAttempt((value) => value + 1); }}>{copy.retry}</button></div>}
    {data && <>
      <p className="lookup-peers-activity">{data.activity.label}{data.activity.code && <span> · NACEBEL {data.activity.code}{data.activity.version && ` (${data.activity.version})`}</span>}</p>
      <div className="lookup-peer-grid">{data.tiers.map((tier) => { const Icon = tierIcons[tier.key]; return <article className={`lookup-peer-card lookup-peer-card-${tier.key}${tier.available ? "" : " lookup-peer-card-unavailable"}`} key={tier.key} aria-labelledby={`peer-${tier.key}`}>
        <div className="lookup-peer-title"><Icon size={17} aria-hidden="true" /><h4 id={`peer-${tier.key}`}>{copy[tier.key]}</h4></div>
        <div className="lookup-peer-number-row"><div><p className="lookup-peer-count">{tier.available ? new Intl.NumberFormat(tag).format(tier.count!) : "—"}</p>
          {!tier.available && <p className="lookup-peer-criteria">{reason(tier)}</p>}
          {tier.available && (tier.criteria.municipality || tier.criteria.postcode || tier.criteria.fteMin !== undefined) && <div className="lookup-peer-criteria">
            {tier.criteria.municipality && <p>{tier.criteria.municipality}</p>}
            {tier.criteria.postcode && <p>{tier.criteria.postcode}</p>}
            {tier.criteria.fteMin !== undefined && <p>{range(tier.criteria.fteMin, tier.criteria.fteMax)} {copy.persons} · {tier.criteria.financialYear}</p>}
          </div>}
        </div>{tier.examples.length > 0 && <button className="lookup-peer-toggle" type="button" title={copy.examples} aria-label={`${copy.examples}: ${copy[tier.key]}`} aria-expanded={expanded.includes(tier.key)} aria-controls={`peer-examples-${tier.key}`} onClick={() => onExpandedChange(expanded.includes(tier.key) ? expanded.filter((key) => key !== tier.key) : [...expanded, tier.key])}><ArrowRight size={18} aria-hidden="true" /></button>}</div>
        {tier.available && <>
          {tier.examples.length > 0 ? <ul id={`peer-examples-${tier.key}`} hidden={!expanded.includes(tier.key)} className="lookup-peer-examples">{tier.examples.map((item) => <li key={item.number}><button onClick={() => onSelect(item.number)}><span>{item.name}{item.municipality && <small>{item.municipality}</small>}</span><ArrowRight size={15} aria-hidden="true" /></button></li>)}</ul> : <p className="lookup-peer-criteria">{copy.empty}</p>}
        </>}
      </article>; })}</div>
    </>}
    <aside className="lookup-peer-contact" aria-labelledby="peer-contact-title">
      <div className="lookup-peer-contact-top"><h4 id="peer-contact-title">{copy.question}</h4><Link className="lookup-peer-cta" href={`/${locale}/prospectielijsten`}>{copy.cta}<ArrowRight size={18} aria-hidden="true" /></Link></div>
      <div className="lookup-peer-contact-links"><a href={contactPhoneHref}><Phone size={16} aria-hidden="true" />{contactPhone}</a><a href={`mailto:${salesContactEmail}?subject=${encodeURIComponent(`${copy.emailSubject} BE ${displayNumber(number)}`)}`}><Mail size={16} aria-hidden="true" />{salesContactEmail}</a></div>
    </aside>
    <div className="lookup-peers-actions">
      {data && <details className="lookup-peers-method" open={methodExpanded} onToggle={(event) => onMethodExpandedChange(event.currentTarget.open)}><summary>{copy.method}</summary><p>{data.activity.label} · NACEBEL {data.activity.code} ({data.activity.version})</p><p>{copy.scope}</p></details>}
    </div>
  </section>;
}
