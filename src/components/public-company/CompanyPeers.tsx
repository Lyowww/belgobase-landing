"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { peersCopy } from "@/lib/public-company/peers-copy";
import { peersPayload, type CompanyPeers as PeerData, type PeerTier } from "@/lib/public-company/peers";
import { companyLocaleTag } from "@/lib/public-company/navigation";

export function CompanyPeers({ number, locale, onSelect }: { number: string; locale: Locale; onSelect: (number: string) => void }) {
  const copy = peersCopy[locale];
  const [data, setData] = useState<PeerData>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const tag = companyLocaleTag(locale);
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

  function range(min: number | undefined, max: number | null | undefined, currency: boolean) {
    const formatter = new Intl.NumberFormat(tag, currency ? { style: "currency", currency: "EUR", maximumFractionDigits: 0 } : { maximumFractionDigits: 1 });
    if (min === undefined) return "";
    return max === null || max === undefined ? `${copy.from} ${formatter.format(min)}` : `${formatter.format(min)} ${copy.below} ${formatter.format(max)}`;
  }
  function reason(tier: PeerTier) {
    return ({ no_activity: copy.noActivity, no_revenue: copy.noRevenue, no_fte: copy.noFte, no_legal_form: copy.noLegalForm, comparison_limit: copy.comparisonLimit } as Record<string, string>)[tier.unavailableReason || ""] || copy.prior;
  }
  return <section className="lookup-peers" aria-labelledby="peers-title">
    <h3 id="peers-title">{copy.heading}</h3><p className="lookup-peers-intro">{copy.intro}</p>
    {!data && !error && <p className="lookup-peers-loading" role="status"><LoaderCircle size={20} className="lookup-spin" aria-hidden="true" />{copy.pending}</p>}
    {error && <div className="lookup-peers-error" role="status"><p>{copy.error}</p><button onClick={() => { setError(false); setAttempt((value) => value + 1); }}>{copy.retry}</button></div>}
    {data && <>
      <p className="lookup-peers-activity">{data.activity.label}{data.activity.code && <span> · NACEBEL {data.activity.code}{data.activity.version && ` (${data.activity.version})`}</span>}</p>
      <div className="lookup-peer-grid">{data.tiers.map((tier, index) => <article className="lookup-peer-card" key={tier.key} aria-labelledby={`peer-${tier.key}`}>
        <p className="lookup-peer-step">{index + 1}</p><h4 id={`peer-${tier.key}`}>{copy[tier.key]}</h4>
        <p className="lookup-peer-count">{tier.available ? new Intl.NumberFormat(tag).format(tier.count!) : "—"}</p>
        <p className="lookup-peer-count-label">{tier.available ? copy.companies : copy.unavailable}</p>
        {!tier.available && <p className="lookup-peer-criteria">{reason(tier)}</p>}
        {tier.available && <>
          <div className="lookup-peer-criteria">
            {tier.criteria.revenueMin !== undefined && <p>{copy.turnover}: {range(tier.criteria.revenueMin, tier.criteria.revenueMax, true)}</p>}
            {tier.criteria.fteMin !== undefined && <p>{copy.employees}: {range(tier.criteria.fteMin, tier.criteria.fteMax, false)} {copy.persons}</p>}
            {tier.criteria.financialYear && <p>{copy.year} {tier.criteria.financialYear}</p>}
            {tier.criteria.legalForm && <p>{tier.criteria.legalForm}</p>}
          </div>
          {tier.examples.length > 0 ? <><p className="lookup-peer-example-title">{copy.examples}</p><ul>{tier.examples.map((item) => <li key={item.number}><button onClick={() => onSelect(item.number)}><span>{item.name}{item.municipality && <small>{item.municipality}</small>}</span><ArrowRight size={15} aria-hidden="true" /></button></li>)}</ul></> : <p className="lookup-peer-criteria">{copy.empty}</p>}
        </>}
      </article>)}</div>
      <details className="lookup-peers-method"><summary>{locale === "nl" ? "Hoe worden deze aantallen berekend?" : locale === "fr" ? "Comment ces chiffres sont-ils calculés ?" : "How are these counts calculated?"}</summary><p>{copy.scope}</p>{data.sources.kboDate && <p>{copy.source}: {data.sources.kboDate}</p>}</details>
    </>}
    <aside className="lookup-next"><p>{copy.question}</p><Link href={`/${locale}#contact`}>{copy.cta}<ArrowRight size={20} aria-hidden="true" /></Link></aside>
  </section>;
}
