"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import styles from "./WorkspaceApp.module.css";

type Session = { authenticated?: boolean; csrf?: string; account?: { name?: string; email?: string } };
type Phase = "checking" | "login" | "loginCode" | "enroll" | "enrollCode" | "profile" | "workspace";
type Declaration = "terms_accepted" | "usage_terms_accepted" | "privacy_acknowledged" | "authority_declared";
type LegalDocument = { document_id: string; title: string; role: "contractual_terms" | "acceptable_use_terms" | "privacy_notice"; version: string; view_url: string; download_url?: string; sha256: string };
type Details = { company?: { company_type?: string; enterprise_number?: string; legal_name?: string; address?: { street?: string; house_number?: string; postal_code?: string; municipality?: string } }; legal?: { documents?: LegalDocument[]; choice_texts?: Partial<Record<"general_terms" | "usage_terms" | "privacy_notice" | "business_authority", string>> }; preflight_id?: string; preflight_fingerprint?: string };
type Result = { ok?: boolean; error?: string; challenge_id?: string; csrf?: string; enrollment_verified?: boolean; title?: string; text?: string; sha256?: string } & Session & Details;

const initialDeclarations: Record<Declaration, boolean> = { terms_accepted: false, usage_terms_accepted: false, privacy_acknowledged: false, authority_declared: false };
const declarationByRole: Record<LegalDocument["role"], Declaration> = { contractual_terms: "terms_accepted", acceptable_use_terms: "usage_terms_accepted", privacy_notice: "privacy_acknowledged" };
const text = {
  nl: {
    title: "BelgoBase online", existing: "Inloggen", existingHelp: "Meld je aan met het e-mailadres van je account.", new: "Nieuw bij BelgoBase", newHelp: "Schrijf je zakelijke account veilig in.", noAccount: "Nog geen account?", createAccount: "Maak een account aan",
    email: "E-mailadres", license: "Licentiecode (optioneel)", enrollmentLicense: "BelgoBase-licentiecode", licenseHelp: "Heb je al een BelgoBase-account? Dan volstaat je geregistreerde e-mailadres.", remember: "Op dit apparaat aangemeld blijven", send: "Code per e-mail ontvangen",
    codeTitle: "Controleer je e-mail", codeHelp: "Voer de beveiligingscode uit je e-mail in.", code: "Beveiligingscode", login: "Aanmelden", verify: "E-mailadres bevestigen", back: "Terug", otherEmail: "Gebruik een ander e-mailadres",
    profileTitle: "Bevestig je bedrijfsgegevens", profileHelp: "BelgoBase is momenteel beschikbaar voor professionele gebruikers. Zoek je onderneming op en controleer de gegevens voordat je inschrijving wordt voltooid.",
    enterprise: "Ondernemingsnummer (KBO)", find: "Bedrijfsgegevens ophalen", company: "Wettelijke bedrijfsnaam", address: "Adres", name: "Naam van de aanvaarder", function: "Functie van de aanvaarder", read: "Lees document", close: "Sluiten", finish: "Zakelijke inschrijving voltooien",
    consumer: "Particuliere inschrijving is nog niet beschikbaar. BelgoBase online is momenteel voor professionele gebruikers.", logout: "Afmelden", loading: "Je veilige werkomgeving wordt geladen…", expired: "Je sessie is verlopen. Meld je opnieuw aan.",
    generic: "Dit kon niet worden afgerond. Controleer je gegevens en probeer opnieuw.", invalid: "Controleer de ingevulde gegevens.", invalidCode: "De code is ongeldig of verlopen.", enrollmentInvalid: "Je inschrijving is niet meer geldig. Begin opnieuw.", companyMissing: "Deze onderneming werd niet gevonden. Controleer het ondernemingsnummer.", conflict: "Deze licentie is al gekoppeld. Meld je aan met het bestaande e-mailadres.", legal: "Bevestig alle verplichte documenten en gegevens.", devices: "Het maximum aantal actieve apparaten is bereikt.", unavailable: "Aanmelden is tijdelijk niet beschikbaar. Probeer later opnieuw.",
  },
  en: {
    title: "BelgoBase online", existing: "Sign in", existingHelp: "Sign in with the email address on your account.", new: "New to BelgoBase", newHelp: "Set up your professional account securely.", noAccount: "No account yet?", createAccount: "Create an account",
    email: "Email address", license: "License code (optional)", enrollmentLicense: "BelgoBase license code", licenseHelp: "Already have a BelgoBase account? Your registered email address is enough.", remember: "Keep me signed in on this device", send: "Send email code",
    codeTitle: "Check your email", codeHelp: "Enter the security code from your email.", code: "Security code", login: "Sign in", verify: "Confirm email address", back: "Back", otherEmail: "Use a different email address",
    profileTitle: "Confirm your company details", profileHelp: "BelgoBase is currently available to professional users. Find your company and check the details before completing enrolment.",
    enterprise: "Company number (CBE)", find: "Get company details", company: "Legal company name", address: "Address", name: "Name of the person accepting", function: "Role of the person accepting", read: "Read document", close: "Close", finish: "Complete professional enrolment",
    consumer: "Consumer enrolment is not available yet. BelgoBase online is currently for professional users.", logout: "Sign out", loading: "Loading your secure workspace…", expired: "Your session has expired. Please sign in again.",
    generic: "This could not be completed. Check your details and try again.", invalid: "Check the details you entered.", invalidCode: "The code is invalid or expired.", enrollmentInvalid: "Your enrolment is no longer valid. Please start again.", companyMissing: "This company could not be found. Check the company number.", conflict: "This license is already linked. Sign in with the existing email address.", legal: "Confirm all required documents and details.", devices: "The maximum number of active devices has been reached.", unavailable: "Sign-in is temporarily unavailable. Please try again later.",
  },
} as const;

async function json(response: Response): Promise<Result> { try { return (await response.json()) as Result; } catch { return {}; } }
function safeHref(value: string) { try { const url = new URL(value, window.location.origin); return url.origin === window.location.origin ? url.pathname + url.search + url.hash : undefined; } catch { return undefined; } }
function addressLine(value: { street?: string; house_number?: string; postal_code?: string; municipality?: string } | undefined) {
  if (!value || typeof value !== "object") return "";
  const address = value as { street?: string; house_number?: string; postal_code?: string; municipality?: string };
  return [([address.street, address.house_number].filter(Boolean).join(" ")), ([address.postal_code, address.municipality].filter(Boolean).join(" "))].filter(Boolean).join(", ");
}
function errorMessage(code: string | undefined, t: (typeof text)[Locale]) {
  return ({ invalid_request: t.invalid, code_invalid: t.invalidCode, otp_invalid: t.invalidCode, enrollment_invalid: t.enrollmentInvalid, enrollment_expired: t.enrollmentInvalid, company_not_found: t.companyMissing, binding_conflict: t.conflict, legal_acceptance_invalid: t.legal, browser_limit_reached: t.devices, temporarily_unavailable: t.unavailable, consumer_registration_unavailable: t.consumer } as Record<string, string>)[code || ""] || t.generic;
}

export function WorkspaceApp({ locale }: { locale: Locale }) {
  const t = text[locale];
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState("");
  const [licenseCode, setLicenseCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [account, setAccount] = useState<Session["account"]>();
  const [csrf, setCsrf] = useState("");
  const [enrollmentCsrf, setEnrollmentCsrf] = useState("");
  const [enterprise, setEnterprise] = useState("");
  const [company, setCompany] = useState("");
  const [acceptantName, setAcceptantName] = useState("");
  const [acceptantFunction, setAcceptantFunction] = useState("");
  const [details, setDetails] = useState<Details>();
  const [declarations, setDeclarations] = useState(initialDeclarations);
  const [documentView, setDocumentView] = useState<{ title: string; text: string }>();
  const [documentLoading, setDocumentLoading] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState("");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const clearEnrollment = useCallback(() => {
    setEnrollmentCsrf(""); setEnterprise(""); setCompany(""); setAcceptantName(""); setAcceptantFunction(""); setDetails(undefined); setDeclarations(initialDeclarations);
  }, []);

  const loadSession = useCallback(async () => {
    const response = await fetch("/api/web/auth/session", { cache: "no-store", credentials: "same-origin" });
    const value = await json(response);
    if (response.ok && value.authenticated) { setAccount(value.account); setCsrf(value.csrf || ""); setPhase("workspace"); return; }
    setCsrf(""); setPhase("login");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadSession().catch(() => { setError(t.generic); setPhase("login"); }), 0);
    return () => window.clearTimeout(timer);
  }, [loadSession, t.generic]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "belgobase-web-auth-expired" || event.data?.type === "belgobase-web-logout") {
        setAccount(undefined); setLicenseCode(""); setChallengeId(""); setCode(""); clearEnrollment(); setError(t.expired); setPhase("login");
      }
    };
    window.addEventListener("message", onMessage); return () => window.removeEventListener("message", onMessage);
  }, [clearEnrollment, t.expired]);
  useEffect(() => {
    if (!loadedVersion || phase !== "workspace") return;
    let cancelled = false;
    const check = async () => { if (document.visibilityState === "hidden") return; try { const response = await fetch("/api/web/version", { cache: "no-store" }); const result = await response.json(); if (!cancelled && response.ok && typeof result.version === "string") setUpdateAvailable(result.version !== loadedVersion); } catch {} };
    const timer = window.setInterval(() => void check(), 60_000);
    window.addEventListener("focus", check); document.addEventListener("visibilitychange", check); void check();
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [loadedVersion, phase]);

  async function request(path: string, body: object, csrfToken?: string) {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...(csrfToken ? { "X-BelgoBase-CSRF": csrfToken } : {}) }, credentials: "same-origin", body: JSON.stringify(body) });
    return { response, result: await json(response) };
  }
  async function startLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const payload: Record<string, string | boolean> = { email: email.trim(), remember }; if (licenseCode.trim()) payload.license_code = licenseCode.trim(); const { response, result } = await request("/api/web/auth/start", payload); if (!response.ok || !result.ok || !result.challenge_id) throw new Error(errorMessage(result.error, t)); setChallengeId(result.challenge_id); setCode(""); setPhase("loginCode"); } catch (reason) { setError(reason instanceof Error ? reason.message : t.generic); } finally { setBusy(false); }
  }
  async function verifyLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const { response, result } = await request("/api/web/auth/verify", { challenge_id: challengeId, code: code.trim() }); if (!response.ok || !result.ok) throw new Error(errorMessage(result.error, t)); await loadSession(); } catch (reason) { setError(reason instanceof Error ? reason.message : t.generic); } finally { setBusy(false); }
  }
  async function startEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const { response, result } = await request("/api/web/enrollment/start", { license_code: licenseCode.trim(), email: email.trim(), remember_browser: remember }); if (!response.ok || !result.ok || !result.challenge_id) throw new Error(errorMessage(result.error, t)); setChallengeId(result.challenge_id); setCode(""); setPhase("enrollCode"); } catch (reason) { setError(reason instanceof Error ? reason.message : t.generic); } finally { setBusy(false); }
  }
  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const { response, result } = await request("/api/web/enrollment/verify", { challenge_id: challengeId, code: code.trim() }); if (!response.ok || !result.ok || !result.enrollment_verified || !result.csrf) throw new Error(errorMessage(result.error, t)); setEnrollmentCsrf(result.csrf); setCode(""); setPhase("profile"); } catch (reason) { setError(reason instanceof Error ? reason.message : t.generic); } finally { setBusy(false); }
  }
  async function autofill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const { response, result } = await request("/api/web/enrollment/autofill", { enterprise_number: enterprise.trim() }, enrollmentCsrf); if (!response.ok || !result.ok || result.company?.company_type !== "business" || !result.preflight_id || !result.preflight_fingerprint) throw new Error(errorMessage(result.error, t)); setDetails(result); setEnterprise(result.company.enterprise_number || enterprise.trim()); setCompany(result.company.legal_name || ""); setDeclarations(initialDeclarations); } catch (reason) { setError(reason instanceof Error ? reason.message : t.generic); } finally { setBusy(false); }
  }
  async function openDocument(document: LegalDocument) {
    const href = safeHref(document.view_url);
    if (!href) { setError(t.legal); return; }
    setDocumentLoading(true); setError("");
    try {
      const response = await fetch(href, { cache: "no-store", credentials: "same-origin" });
      const result = await json(response);
      if (!response.ok || !result.ok || typeof result.title !== "string" || typeof result.text !== "string") throw new Error(errorMessage(result.error, t));
      setDocumentView({ title: result.title, text: result.text });
    } catch (reason) { setError(reason instanceof Error ? reason.message : t.generic); } finally { setDocumentLoading(false); }
  }
  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details?.preflight_id || !details.preflight_fingerprint || !legalReady || !Object.values(declarations).every(Boolean)) { setError(t.legal); return; }
    setBusy(true); setError("");
    try {
      const { response, result } = await request("/api/web/enrollment/complete", { company_type: "business", enterprise_number: enterprise.trim(), legal_name: company.trim(), acceptant: { name: acceptantName.trim(), function: acceptantFunction.trim() }, declarations, choice_texts: details.legal?.choice_texts, preflight_id: details.preflight_id, preflight_fingerprint: details.preflight_fingerprint }, enrollmentCsrf);
      if (!response.ok || !result.ok || !result.authenticated) throw new Error(errorMessage(result.error, t));
      clearEnrollment(); await loadSession();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t.generic); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { const { response } = await request("/api/web/auth/logout", {}, csrf); if (!response.ok && response.status !== 401) throw new Error(); setAccount(undefined); setLicenseCode(""); setCsrf(""); setChallengeId(""); setCode(""); clearEnrollment(); setPhase("login"); } catch { setError(t.generic); } finally { setBusy(false); }
  }
  const back = () => { setError(""); setChallengeId(""); setCode(""); clearEnrollment(); setPhase("login"); };
  const documents = details?.legal?.documents || [];
  const choices = details?.legal?.choice_texts || {};
  const legalReady = documents.length === 3 && ["general_terms", "usage_terms", "privacy_notice", "business_authority"].every((key) => typeof choices[key as keyof typeof choices] === "string" && choices[key as keyof typeof choices]?.trim());

  if (phase === "workspace") return <main className={styles.workspace}>
    <div className={styles.workspaceBar}><span>{account?.name || account?.email || "BelgoBase"}</span><button type="button" onClick={() => void logout()} disabled={busy}>{t.logout}</button></div>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {updateAvailable ? <div className={styles.workspaceBar} role="status"><span>{locale === "nl" ? "Een nieuwe versie van BelgoBase staat klaar. Rond je huidige werk af en vernieuw." : "A new BelgoBase version is ready. Finish your current work, then refresh."}</span><button type="button" onClick={() => { if (window.confirm(locale === "nl" ? "Heb je je werk opgeslagen en je opname afgerond? BelgoBase wordt opnieuw geopend." : "Have you saved your work and finished recording? BelgoBase will reopen.")) window.location.reload(); }}>{locale === "nl" ? "Nieuwe versie openen" : "Open new version"}</button></div> : null}
    <iframe ref={frame} onLoad={() => { const version = frame.current?.contentDocument?.querySelector('meta[name="belgobase-release"]')?.getAttribute("content"); if (version) { setLoadedVersion(version); setUpdateAvailable(false); } }} className={styles.frame} title="BelgoBase workspace" src="/api/web/workspace" allow="microphone" />
  </main>;
  if (phase === "checking") return <main className={styles.loading}>{t.loading}</main>;
  const codePhase = phase === "loginCode" || phase === "enrollCode";
  return <main className={styles.page}><section className={styles.card} aria-labelledby="app-title">
    <p className={styles.brand}>BelgoBase</p>
    {codePhase ? <><h1 id="app-title">{t.codeTitle}</h1><p className={styles.intro}>{t.codeHelp}</p>{error ? <p role="alert" className={styles.error}>{error}</p> : null}<form className={styles.form} onSubmit={phase === "loginCode" ? verifyLogin : verifyEnrollment}><label>{t.code}<input autoComplete="one-time-code" inputMode="numeric" maxLength={12} required value={code} onChange={(event) => setCode(event.target.value)} /></label><button disabled={busy} type="submit">{phase === "loginCode" ? t.login : t.verify}</button><button className={styles.secondary} disabled={busy} type="button" onClick={back}>{t.otherEmail}</button></form></> : null}
    {phase === "profile" ? <>
      <h1 id="app-title">{t.profileTitle}</h1><p className={styles.intro}>{t.profileHelp}</p>{error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <form className={styles.form} onSubmit={autofill}><label>{t.enterprise}<input autoComplete="off" inputMode="numeric" maxLength={10} required value={enterprise} onChange={(event) => setEnterprise(event.target.value)} /></label><button disabled={busy} type="submit">{t.find}</button></form>
      {details ? <form className={styles.form + " " + styles.confirmation} onSubmit={complete}>
        <label>{t.company}<input required value={company} onChange={(event) => setCompany(event.target.value)} /></label>
        {addressLine(details.company?.address) ? <p className={styles.readonly}><strong>{t.address}</strong><span>{addressLine(details.company?.address)}</span></p> : null}
        <label>{t.name}<input autoComplete="name" required value={acceptantName} onChange={(event) => setAcceptantName(event.target.value)} /></label>
        <label>{t.function}<input required value={acceptantFunction} onChange={(event) => setAcceptantFunction(event.target.value)} /></label>
        {documents.map((document) => {
          const declaration = declarationByRole[document.role];
          const choice = document.role === "contractual_terms" ? choices.general_terms : document.role === "acceptable_use_terms" ? choices.usage_terms : choices.privacy_notice;
          return <label className={styles.checkbox} key={document.document_id}><input checked={declarations[declaration]} required type="checkbox" onChange={(event) => setDeclarations((current) => ({ ...current, [declaration]: event.target.checked }))} /><span>{choice} <button className={styles.documentButton} disabled={documentLoading} type="button" onClick={() => void openDocument(document)}>{t.read}</button></span></label>;
        })}
        <label className={styles.checkbox}><input checked={declarations.authority_declared} required type="checkbox" onChange={(event) => setDeclarations((current) => ({ ...current, authority_declared: event.target.checked }))} /><span>{choices.business_authority}</span></label>
        <button disabled={busy || documents.length !== 3 || !Object.values(declarations).every(Boolean)} type="submit">{t.finish}</button>
      </form> : null}
      <button className={styles.textButton} disabled={busy} type="button" onClick={back}>{t.back}</button>
    </> : null}
    {phase === "login" || phase === "enroll" ? <>
      <h1 id="app-title">{phase === "login" ? t.existing : t.new}</h1><p className={styles.intro}>{phase === "login" ? t.existingHelp : t.newHelp}</p>{error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <form className={styles.form} onSubmit={phase === "login" ? startLogin : startEnrollment}>
        <label>{t.email}<input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>{phase === "login" ? t.license : t.enrollmentLicense}<input autoComplete="off" required={phase === "enroll"} value={licenseCode} onChange={(event) => setLicenseCode(event.target.value)} />{phase === "login" ? <small>{t.licenseHelp}</small> : null}</label>
        <label className={styles.checkbox}><input checked={remember} type="checkbox" onChange={(event) => setRemember(event.target.checked)} />{t.remember}</label>
        <button disabled={busy} type="submit">{t.send}</button>
        {phase === "enroll" ? <button className={styles.secondary} disabled={busy} type="button" onClick={back}>{t.back}</button> : null}
      </form>
      {phase === "login" ? <p className={styles.createAccount}>{t.noAccount} <button type="button" onClick={() => { setError(""); setLicenseCode(""); setPhase("enroll"); }}>{t.createAccount}</button></p> : null}
    </> : null}
    {documentView ? <div className={styles.modalBackdrop} role="presentation"><section aria-label={documentView.title} aria-modal="true" className={styles.documentModal} role="dialog"><div className={styles.documentHeader}><h2>{documentView.title}</h2><button type="button" onClick={() => setDocumentView(undefined)}>{t.close}</button></div><article className={styles.documentText}>{documentView.text}</article></section></div> : null}
  </section></main>;
}
