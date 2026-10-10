"use client";

import Link from "next/link";
import { Search, ArrowRight, ArrowLeft, LoaderCircle, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/config";
import { Header } from "@/components/layout/Header";
import { companyCopy } from "@/lib/public-company/copy";
import { cleanQuery, displayNumber, safeWebsite, type CompanyMatch, type CompanyResponse, type PublicCompany } from "@/lib/public-company/model";
import { companyLocaleTag, consumeLookupTransfer, saveLookupTransfer, type LookupError } from "@/lib/public-company/navigation";
import "./lookup.css";

export function CompanyLookup({ locale }: { locale: Locale }) {
  const copy = companyCopy[locale];
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<CompanyMatch[]>([]);
  const [company, setCompany] = useState<PublicCompany>();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<LookupError>("");
  const [officialNumber, setOfficialNumber] = useState("");
  const pending = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const localeTag = companyLocaleTag(locale);
  const restored = useRef(false);

  // Rehydrate the single-use browser handoff after SSR. React batches these
  // setters; reading sessionStorage during server/client initial render would
  // create a hydration mismatch. No search request or recurring sync is started.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    setReady(true);
    try {
      const state = consumeLookupTransfer(window.sessionStorage, locale);
      if (!state) return;
      setQuery(state.query); setMatches(state.matches); setCompany(state.company);
      setOfficialNumber(state.officialNumber); setError(state.error);
    } catch { setError("languageRestore"); }
  }, [locale]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function changeLanguage(targetLocale: Locale): boolean {
    if (targetLocale === locale) return true;
    try {
      saveLookupTransfer(window.sessionStorage, targetLocale, { query, matches, company, officialNumber, error: busy ? "interrupted" : error });
      return true;
    } catch { setError("languageRestore"); return false; }
  }

  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { if (company) heading.current?.focus({ preventScroll: true }); }, [company]);

  function changeQuery(value: string) {
    setQuery(value);
    if (!pending.current) return;
    // A response for the previous input must not become the new input's result.
    pending.current.abort();
    pending.current = null;
    setBusy(false); setCompany(undefined); setMatches([]); setOfficialNumber("");
    setError("edited");
  }

  async function lookup(value: string, selection = false) {
    const clean = cleanQuery(value);
    pending.current?.abort();
    setError(""); setOfficialNumber(""); setCompany(undefined);
    if (!selection) setMatches([]);
    if (!clean) { pending.current = null; setBusy(false); setError("short"); return; }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      const response = await fetch("/api/public/company", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: clean }), signal: controller.signal,
      });
      const data: CompanyResponse = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || !data.ok) {
        setError(response.status === 429 ? "rate" : data.error === "invalid_query" ? "short" : "error");
        return;
      }
      if (!selection) setMatches(data.matches);
      if (data.company) { setCompany(data.company); return; }
      if (data.error === "natural_person_unavailable") {
        const number = clean.replace(/^BE\s*/i, "").replace(/[.\s-]/g, "");
        if (/^\d{10}$/.test(number)) setOfficialNumber(number);
        setError("limited");
      } else if (!data.matches.length) setError("notFound");
    } catch {
      if (!controller.signal.aborted) setError("error");
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (ready) void lookup(query); }
  function date(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return copy.unavailable;
    const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat(localeTag, { day: "numeric", month: "long", year: "numeric" }).format(parsed) : copy.unavailable;
  }
  function metricLabel(key: string, fallback: string) {
    return ({ revenue: copy.revenue, profit: copy.profit, equity: copy.equity, fte: copy.fte, ebitda: copy.ebitda } as Record<string, string>)[key] || fallback;
  }
  function metricValue(value: number | null, unit: string) {
    if (value === null || !Number.isFinite(value)) return copy.unavailable;
    return new Intl.NumberFormat(localeTag, unit === "EUR"
      ? { style: "currency", currency: "EUR", maximumFractionDigits: 0 }
      : { maximumFractionDigits: 1 }).format(value);
  }
  const website = safeWebsite(company?.website);
  const status = company?.status === "Actief" ? copy.active : company?.status === "Stopgezet" ? copy.discontinued : company?.status;
  const facts = company ? [
    [copy.number, displayNumber(company.number)], [copy.status, status],
    [copy.form, company.legalForm], [copy.start, company.startDate ? date(company.startDate) : undefined],
    [copy.address, company.address],
  ].filter((row) => row[1]) : [];

  return (
    <div className="marketing-site company-lookup">
      <Header variant="lookup" onBeforeLanguageChange={changeLanguage} />
      <main className="lookup-main">
        <section className="lookup-search" aria-labelledby="lookup-title">
          <h1 id="lookup-title"><span>{copy.headingLead}</span>{" "}{copy.heading}</h1>
          <p className="lookup-intro">{copy.intro}</p>
          <form onSubmit={submit} className="lookup-form" aria-busy={!ready || busy}>
            <label htmlFor="company-query">{copy.label}</label>
            <div className="lookup-input-row">
              <Search size={23} aria-hidden="true" className="lookup-search-icon" />
              <input id="company-query" name="query" disabled={!ready} value={query} onChange={(event) => changeQuery(event.target.value)} maxLength={100} placeholder={copy.placeholder} autoComplete="off" type="search" required aria-describedby="lookup-hint lookup-message" />
              <button type="submit" disabled={!ready || busy}>{!ready || busy ? <LoaderCircle size={21} className="lookup-spin" aria-hidden="true" /> : null}{!ready ? copy.initializing : busy ? copy.loading : copy.search}<ArrowRight size={20} aria-hidden="true" /></button>
            </div>
            <p id="lookup-hint" className="lookup-hint">{copy.hint}</p>
          </form>
          <noscript><p className="lookup-message">{copy.needsJavaScript}</p></noscript>
          <div id="lookup-message" aria-live="polite" aria-atomic="true">
            {error && <p className="lookup-message" role="alert">{copy[error]}{officialNumber && <a className="lookup-official" href={`https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html?nummer=${officialNumber}`} target="_blank" rel="noopener noreferrer">{copy.official} <ExternalLink size={16} aria-hidden="true" /></a>}</p>}
          </div>
        </section>

        {!company && matches.length > 0 && <section className="lookup-results" aria-label={copy.results}>
          <h2>{copy.choose}</h2>
          {matches.length === 8 && <p className="lookup-hint">{copy.refine}</p>}
          <ul>{matches.map((match) => <li key={match.number}><button disabled={busy} onClick={() => void lookup(match.number, true)}><span><strong>{match.name}</strong><span className="lookup-match-detail">{displayNumber(match.number)}{match.municipality ? ` · ${match.municipality}` : ""}</span></span><ArrowRight size={23} aria-hidden="true" /></button></li>)}</ul>
        </section>}

        {company && <article className="lookup-company" aria-labelledby="company-name">
          <div className="lookup-company-top">
            <div><p className="lookup-company-number">BE {displayNumber(company.number)}</p><h2 id="company-name" ref={heading} tabIndex={-1}>{company.name}</h2></div>
            {matches.length > 1 && <button className="lookup-back" onClick={() => { setCompany(undefined); setError(""); }}><ArrowLeft size={18} aria-hidden="true" />{copy.back}</button>}
          </div>
          <div className="lookup-company-grid">
            <section className="lookup-general" aria-labelledby="company-info-title">
              <h3 id="company-info-title">{copy.general}</h3>
              <dl>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                {website && <div><dt>{copy.website}</dt><dd><a href={website} target="_blank" rel="noopener noreferrer">{new URL(website).hostname}<ExternalLink size={16} aria-hidden="true" /></a></dd></div>}
              </dl>
              {company.activities.length > 0 && <div className="lookup-activities"><h3>{copy.activities}</h3><ul>{company.activities.slice(0, 3).map((activity) => <li key={`${activity.code}-${activity.label}`}><span>{activity.label}</span><span className="lookup-nace">{activity.code}</span></li>)}</ul>
                {company.activities.length > 3 && <details><summary>{copy.more}</summary><ul>{company.activities.slice(3).map((activity) => <li key={`${activity.code}-${activity.label}`}><span>{activity.label}</span><span className="lookup-nace">{activity.code}</span></li>)}</ul></details>}
              </div>}
            </section>
            <section className="lookup-financial" aria-labelledby="financial-title">
              <h3 id="financial-title">{copy.finance}</h3>
              {company.metrics.some((metric) => metric.value !== null) ? <dl className="lookup-metrics">{company.metrics.map((metric) => <div key={metric.key}><dt>{metricLabel(metric.key, metric.label)}</dt><dd className={metric.value !== null && metric.value < 0 ? "lookup-negative" : ""}>{metricValue(metric.value, metric.unit)}{metric.unit === "VTE" && metric.value !== null && <span className="lookup-unit"> {copy.persons}</span>}</dd><p>{metric.year ? `${copy.year} ${metric.year}` : copy.unknownYear}</p></div>)}</dl> : <p className="lookup-no-financials">{copy.noFinancials}</p>}
            </section>
          </div>
          <div className="lookup-provenance">
            <p>{copy.sources}: KBO{company.sources.nbbDate && " · NBB"}{company.sources.kboDate && <><span aria-hidden="true"> · </span>{copy.kbo}: <strong>{date(company.sources.kboDate)}</strong></>}{company.sources.nbbDate && <><span aria-hidden="true"> · </span>{copy.nbb}: <strong>{date(company.sources.nbbDate)}</strong></>}</p>
            <a href={`https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html?nummer=${company.number}`} target="_blank" rel="noopener noreferrer">{copy.official}<ExternalLink size={16} aria-hidden="true" /></a>
          </div>
          <aside className="lookup-next"><p>{copy.upsell}</p><Link href={`/${locale}#contact`}>{copy.cta}<ArrowRight size={20} aria-hidden="true" /></Link></aside>
        </article>}
      </main>
      <footer className="lookup-footer"><p>{copy.footer}</p><p>{copy.independent} <Link href={`/${locale}/privacy`}>{copy.privacy}</Link></p></footer>
    </div>
  );
}
