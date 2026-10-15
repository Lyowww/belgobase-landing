"use client";

import Link from "next/link";
import { Search, ArrowRight, ArrowLeft, LoaderCircle, ExternalLink, Copy, Check } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/config";
import { Header } from "@/components/layout/Header";
import { CompanyPeers } from "@/components/public-company/CompanyPeers";
import { companyCopy } from "@/lib/public-company/copy";
import { trackPublicCompanyAction } from "@/lib/marketing-measurement";
import { cleanQuery, displayNumber, publicPayload, safeWebsite, type CompanyMatch, type PublicCompany } from "@/lib/public-company/model";
import { companyLocaleTag, consumeLookupTransfer, saveLookupTransfer, type LookupError } from "@/lib/public-company/navigation";
import { readInitialLookupHistory, readLookupPopState, replaceCurrentLookupHistory, pushLookupHistory, type LookupHistoryView, type LookupHistoryPeerKey } from "@/lib/public-company/history";
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
  const [infoExpanded, setInfoExpanded] = useState(true);
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);
  const [expandedPeers, setExpandedPeers] = useState<LookupHistoryPeerKey[]>([]);
  const [peerMethodExpanded, setPeerMethodExpanded] = useState(false);
  const [numberCopied, setNumberCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localeTag = companyLocaleTag(locale);
  const restored = useRef(false);
  const restoreTarget = useRef<number | null>(null);
  const view = useRef<LookupHistoryView>({ query: "", matches: [], officialNumber: "", error: "", infoExpanded: true, activitiesExpanded: false, expandedPeers: [], peerMethodExpanded: false, scrollY: 0 });
  useLayoutEffect(() => {
    view.current = { query, matches, company, officialNumber, error, infoExpanded, activitiesExpanded, expandedPeers, peerMethodExpanded, scrollY: 0 };
  }, [query, matches, company, officialNumber, error, infoExpanded, activitiesExpanded, expandedPeers, peerMethodExpanded]);

  function applyView(state: LookupHistoryView) {
    setQuery(state.query); setMatches(state.matches); setCompany(state.company);
    setOfficialNumber(state.officialNumber); setError(state.error);
    setInfoExpanded(state.infoExpanded); setActivitiesExpanded(state.activitiesExpanded);
    setExpandedPeers(state.expandedPeers); setPeerMethodExpanded(state.peerMethodExpanded);
    setNumberCopied(false); setCopyFailed(false);
  }
  function saveView(state = view.current, push = false) {
    try {
      const context = { locale, url: window.location.pathname + window.location.search };
      (push ? pushLookupHistory : replaceCurrentLookupHistory)(window.history, context, { ...state, scrollY: window.scrollY });
    } catch { /* A restricted browser must still allow the lookup itself. */ }
  }
  function restoreScroll(final = true) {
    if (restoreTarget.current === null) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (restoreTarget.current === null) return;
      window.scrollTo({ top: restoreTarget.current, behavior: "instant" });
      if (final) restoreTarget.current = null;
    }));
  }
  useLayoutEffect(() => {
    // Restore visible facts immediately; the settled peers section can restore
    // a lower position once its examples have their final height.
    if (ready) restoreScroll(false);
  }, [ready, company]);

  async function refreshRestoredCompany(number: string) {
    // History preserves the view, not the age of the data. Re-read the active
    // BelgoBase source once without adding an entry or closing disclosures.
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/public/company", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: number }), signal: controller.signal, cache: "no-store",
      });
      const data = response.ok ? publicPayload(await response.json()) : null;
      if (controller.signal.aborted) return;
      if (!data) { setError("refresh"); return; }
      if (data.company?.number === number) setCompany(data.company);
      else {
        setCompany(undefined);
        setError(data.error === "natural_person_unavailable" ? "limited" : "notFound");
        setOfficialNumber(data.error === "natural_person_unavailable" ? number : "");
        restoreScroll();
      }
    } catch { if (!controller.signal.aborted) setError("refresh"); }
    finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  }


  // Rehydrate navigation after SSR. React batches these setters; reading
  // browser storage during initial render would create a hydration mismatch.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const transfer = consumeLookupTransfer(window.sessionStorage, locale);
      const state = transfer ? { ...transfer, infoExpanded: window.matchMedia("(min-width: 761px)").matches, activitiesExpanded: false, expandedPeers: [], peerMethodExpanded: false, scrollY: 0 }
        : readInitialLookupHistory(window.history.state, { locale, url: window.location.pathname + window.location.search });
      if (state) { applyView(state); restoreTarget.current = state.scrollY; if (!state.company) restoreScroll(); else void refreshRestoredCompany(state.company.number); }
      else setInfoExpanded(window.matchMedia("(min-width: 761px)").matches);
    } catch { setError("languageRestore"); }
    setReady(true);
    // The guarded handoff runs once; refresh reads only the supplied identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Native disclosure keeps secondary facts available without filling a phone.
  useEffect(() => {
    const screen = window.matchMedia("(min-width: 761px)");
    const sync = () => setInfoExpanded(screen.matches);
    screen.addEventListener("change", sync);
    return () => screen.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    let scrollTimer: ReturnType<typeof setTimeout>;
    const context = { locale, url: window.location.pathname + window.location.search };
    const snapshot = () => { if (!pending.current && restoreTarget.current === null) saveView(); };
    const scroll = () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(snapshot, 150); };
    const pop = (event: PopStateEvent) => {
      const state = readLookupPopState(event, context);
      if (!state) return;
      clearTimeout(scrollTimer);
      pending.current?.abort(); pending.current = null; setBusy(false);
      restoreTarget.current = state.scrollY;
      applyView(state);
      if (!state.company) restoreScroll();
      else void refreshRestoredCompany(state.company.number);
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("pagehide", snapshot);
    return () => {
      clearTimeout(scrollTimer);
      window.history.scrollRestoration = previousRestoration;
      window.removeEventListener("popstate", pop);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("pagehide", snapshot);
    };
    // Event handlers read the latest view from the ref without resubscribing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    if (ready && !busy && restoreTarget.current === null) saveView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, busy, query, matches, company, officialNumber, error, infoExpanded, activitiesExpanded, expandedPeers, peerMethodExpanded]);

  function changeLanguage(targetLocale: Locale): boolean {
    if (targetLocale === locale) return true;
    try {
      saveLookupTransfer(window.sessionStorage, targetLocale, { query, matches, company, officialNumber, error: busy ? "interrupted" : error });
      return true;
    } catch { setError("languageRestore"); return false; }
  }

  useEffect(() => () => { pending.current?.abort(); if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
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
    const previous = view.current;
    saveView();
    restoreTarget.current = null;
    pending.current?.abort();
    setQuery(value);
    setError(""); setOfficialNumber(""); setCompany(undefined); setNumberCopied(false); setCopyFailed(false);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    if (!selection) setMatches([]);
    if (!clean) { pending.current = null; setBusy(false); setError("short"); return; }
    trackPublicCompanyAction("submit");
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      const response = await fetch("/api/public/company", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: clean }), signal: controller.signal,
      });
      const raw: unknown = await response.json();
      if (controller.signal.aborted) return;
      const reply = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
      if (!response.ok || reply?.ok !== true) {
        setError(response.status === 429 ? "rate" : reply?.error === "invalid_query" ? "short" : "error");
        trackPublicCompanyAction("error");
        return;
      }
      const data = publicPayload(raw);
      if (!data) { setError("error"); trackPublicCompanyAction("error"); return; }
      if (!selection) setMatches(data.matches);
      if (data.company || data.matches.length) {
        const next = { ...view.current, query: value, matches: selection ? matches : data.matches, company: data.company, officialNumber: "", error: "" as const,
          infoExpanded: window.matchMedia("(min-width: 761px)").matches, activitiesExpanded: false, expandedPeers: [], peerMethodExpanded: false, scrollY: 0 };
        const different = next.company?.number !== previous.company?.number || next.matches.map((item) => item.number).join() !== previous.matches.map((item) => item.number).join();
        saveView(next, different);
        applyView(next);
        trackPublicCompanyAction(data.company ? "success" : "matches");
        return;
      }
      if (data.error === "natural_person_unavailable") {
        const number = clean.replace(/^BE\s*/i, "").replace(/[.\s-]/g, "");
        if (/^\d{10}$/.test(number)) setOfficialNumber(number);
        setError("limited");
        trackPublicCompanyAction("limited");
      } else if (!data.matches.length) { setError("notFound"); trackPublicCompanyAction("not_found"); }
    } catch {
      if (!controller.signal.aborted) { setError("error"); trackPublicCompanyAction("error"); }
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (ready) void lookup(query); }
  async function copyNumber() {
    if (!company) return;
    try {
      await navigator.clipboard.writeText(`BE${company.number}`);
      trackPublicCompanyAction("copy_number");
      setNumberCopied(true); setCopyFailed(false);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setNumberCopied(false), 2500);
    } catch { setCopyFailed(true); }
  }
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
  const uniformYear = company?.metrics.length && company.metrics[0].year && company.metrics.every((metric) => metric.year === company.metrics[0].year) ? company.metrics[0].year : null;
  const facts = company ? [
    [copy.form, company.legalForm],
    [copy.start, company.startDate ? date(company.startDate) : undefined],
    [copy.address, company.address],
  ].filter((row) => row[1]) : [];

  return (
    <div className="marketing-site company-lookup">
      <Header variant="lookup" onBeforeLanguageChange={changeLanguage} />
      <main className={`lookup-main${company ? " lookup-main-has-company" : ""}`}>
        <section className={`lookup-search${company ? " lookup-search-has-company" : ""}`} aria-labelledby="lookup-title">
          <h1 id="lookup-title">{company ? copy.navigation : <><span>{copy.headingLead}</span>{" "}{copy.heading}</>}</h1>
          <form onSubmit={submit} className="lookup-form" aria-busy={!ready || busy}>
            <label htmlFor="company-query" className="lookup-sr-only">{copy.label}</label>
            <div className="lookup-input-row">
              <Search size={23} aria-hidden="true" className="lookup-search-icon" />
              <input id="company-query" name="query" disabled={!ready} value={query} onChange={(event) => changeQuery(event.target.value)} maxLength={100} placeholder={copy.placeholder} autoComplete="off" type="search" required aria-describedby="lookup-message" />
              <button type="submit" disabled={!ready || busy}>{!ready || busy ? <LoaderCircle size={21} className="lookup-spin" aria-hidden="true" /> : null}{!ready ? copy.initializing : busy ? copy.loading : copy.search}<ArrowRight size={20} aria-hidden="true" /></button>
            </div>
          </form>
          <noscript><p className="lookup-message">{copy.needsJavaScript}</p></noscript>
          <div id="lookup-message" aria-live="polite" aria-atomic="true">
            {error && <p className="lookup-message" role="alert">{copy[error]}{officialNumber && <a className="lookup-official" data-company-action="kbo" href={`https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html?nummer=${officialNumber}`} target="_blank" rel="noopener noreferrer">{copy.official} <ExternalLink size={16} aria-hidden="true" /></a>}</p>}
          </div>
        </section>

        {!company && matches.length > 0 && <section className="lookup-results" aria-label={copy.results}>
          <h2>{copy.choose}</h2>
          {matches.length === 8 && <p className="lookup-hint">{copy.refine}</p>}
          <ul>{matches.map((match) => <li key={match.number}><button disabled={busy} onClick={() => void lookup(match.number, true)}><span><strong>{match.name}</strong><span className="lookup-match-detail">{displayNumber(match.number)}{match.municipality ? ` · ${match.municipality}` : ""}</span></span><ArrowRight size={23} aria-hidden="true" /></button></li>)}</ul>
        </section>}

        {company && <article className={`lookup-company${company.activities.length ? " lookup-company-has-activity" : ""}`} aria-labelledby="company-name">
          <div className="lookup-company-top">
            <div className="lookup-company-identity">
              <h2 id="company-name" ref={heading} tabIndex={-1}>{company.name}</h2>
              <div className="lookup-company-number-group"><span className="lookup-company-number">BE {displayNumber(company.number)}</span><button className="lookup-copy-number" type="button" onClick={() => void copyNumber()} aria-label={numberCopied ? copy.copied : copy.copyNumber} title={numberCopied ? copy.copied : copy.copyNumber}>{numberCopied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}</button><span className="lookup-sr-only" role="status">{numberCopied ? copy.copied : ""}</span></div>
              {copyFailed && <p className="lookup-copy-failed" role="status">{copy.copyManually}</p>}
            </div>
            {status && <span className={`lookup-company-status${company.status === "Actief" ? " lookup-company-status-active" : ""}`}>{status}</span>}
            {matches.length > 1 && <button className="lookup-back" onClick={() => { setCompany(undefined); setError(""); }}><ArrowLeft size={18} aria-hidden="true" />{copy.back}</button>}
          </div>
          <div className="lookup-company-grid">
            <section className="lookup-general" aria-labelledby="company-info-title">
              <h3 id="company-info-title" className="lookup-general-title lookup-sr-only">{copy.general}</h3>
              <details className="lookup-general-facts" open={infoExpanded} onToggle={(event) => setInfoExpanded(event.currentTarget.open)}><summary>{copy.general}</summary><dl>{facts.map(([label, value]) => <div className={label === copy.address ? "lookup-fact-address" : undefined} key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                {website && <div><dt>{copy.website}</dt><dd><a data-company-action="website" href={website} target="_blank" rel="noopener noreferrer">{new URL(website).hostname}<ExternalLink size={16} aria-hidden="true" /></a></dd></div>}
              </dl></details>
              {company.activities.length > 0 && <div className="lookup-activities"><div className="lookup-activity-heading"><h3>{copy.activities}</h3><span className="lookup-nace">NACEBEL {company.activities[0].code}</span></div><p>{company.activities[0].label}</p>
                {company.activities.length > 1 && <details open={activitiesExpanded} onToggle={(event) => setActivitiesExpanded(event.currentTarget.open)}><summary>{copy.more}</summary><ul>{company.activities.slice(1).map((activity) => <li key={`${activity.code}-${activity.label}`}><span className="lookup-nace">NACEBEL {activity.code}</span><span>{activity.label}</span></li>)}</ul></details>}
              </div>}
            </section>
            <section className="lookup-financial" aria-labelledby="financial-title">
              <h3 id="financial-title" className="lookup-financial-title">{copy.finance}{uniformYear && <span className="lookup-financial-year">{copy.year} {uniformYear}</span>}</h3>
              {company.metrics.some((metric) => metric.value !== null) ? <dl className="lookup-metrics">{company.metrics.map((metric) => <div className="lookup-metric" key={metric.key}><dt>{metricLabel(metric.key, metric.label)}</dt><dd className={metric.value === null ? "lookup-value-missing" : metric.value < 0 ? "lookup-negative" : undefined}>{metricValue(metric.value, metric.unit)}{metric.unit === "VTE" && metric.value !== null && <span className="lookup-unit"> {copy.persons}</span>}</dd>{!uniformYear && <p>{metric.year ? `${copy.year} ${metric.year}` : copy.unknownYear}</p>}</div>)}</dl> : <p className="lookup-no-financials">{copy.noFinancials}</p>}
            </section>
          </div>
          <div className="lookup-provenance">
            <a data-company-action="kbo" href={`https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html?nummer=${company.number}`} target="_blank" rel="noopener noreferrer">{copy.official}<ExternalLink size={16} aria-hidden="true" /></a>
            <a data-company-action="nbb" href={`https://consult.cbso.nbb.be/consult-enterprise/${company.number}`} target="_blank" rel="noopener noreferrer">{copy.officialNbb}<ExternalLink size={16} aria-hidden="true" /></a>
          </div>
          <CompanyPeers key={company.number} number={company.number} locale={locale} expanded={expandedPeers} onExpandedChange={setExpandedPeers} methodExpanded={peerMethodExpanded} onMethodExpandedChange={setPeerMethodExpanded} onSettled={restoreScroll} onSelect={(number) => { void lookup(number); }} />
        </article>}
      </main>
      <footer className="lookup-footer"><p>{copy.footer} <Link href={`/${locale}/privacy`}>{copy.privacy}</Link></p></footer>
    </div>
  );
}
