"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import styles from "./WorkspaceApp.module.css";

type Session = { authenticated?: boolean; csrf?: string; account?: { name?: string; email?: string } };
type ShellLanguage = "nl" | "fr" | "en";
type BrowserSession = { browser_id: string; label: string; created_at: string; last_seen_at: string; expires_at: string; current: boolean };
type Phase = "checking" | "serviceUnavailable" | "login" | "loginCode" | "enroll" | "enrollCode" | "profile" | "workspace";
type Declaration = "terms_accepted" | "usage_terms_accepted" | "privacy_acknowledged" | "authority_declared";
type LegalDocument = { document_id: string; title: string; role: "contractual_terms" | "acceptable_use_terms" | "privacy_notice"; version: string; view_url: string; download_url?: string; sha256: string };
type Details = { company?: { company_type?: string; enterprise_number?: string; legal_name?: string; address?: { street?: string; house_number?: string; postal_code?: string; municipality?: string } }; legal?: { authority_declaration?: { text?: string }; documents?: LegalDocument[]; choice_texts?: Partial<Record<"general_terms" | "usage_terms" | "privacy_notice" | "business_authority", string>> }; preflight_id?: string; preflight_fingerprint?: string; preflight_expires_at?: string };
type AccountRow = { key?: string; label?: string; value?: unknown };
type Result = { ok?: boolean; error?: string; challenge_id?: string; csrf?: string; enrollment_verified?: boolean; title?: string; text?: string; url?: unknown; sha256?: string; sessions?: BrowserSession[]; current_session_revoked?: boolean; rows?: AccountRow[]; customer?: { customer_number?: unknown }; license?: { license_id?: unknown } } & Session & Details;
type AccountReferences = { customerNumber?: string; licenseId?: string };
const phoneText = {
  nl: { label: "Telefoonnummer voor ondersteuning (optioneel)", help: "Belgische notatie (0471 12 34 56 of 03 123 45 67), 0032 en internationale +notatie zijn welkom.", invalid: "Gebruik een geldig Belgisch of internationaal telefoonnummer, of laat dit veld leeg." },
  fr: { label: "Téléphone de support (facultatif)", help: "Les formats belges (0471 12 34 56 ou 03 123 45 67), 0032 et le format international + sont acceptés.", invalid: "Utilisez un numéro belge ou international valide, ou laissez ce champ vide." },
  en: { label: "Support telephone number (optional)", help: "Belgian formats (0471 12 34 56 or 03 123 45 67), 0032 and international + formats are accepted.", invalid: "Use a valid Belgian or international telephone number, or leave this field empty." },
} as const;

const initialDeclarations: Record<Declaration, boolean> = { terms_accepted: false, usage_terms_accepted: false, privacy_acknowledged: false, authority_declared: false };
const declarationByRole: Record<LegalDocument["role"], Declaration> = { contractual_terms: "terms_accepted", acceptable_use_terms: "usage_terms_accepted", privacy_notice: "privacy_acknowledged" };
const text = {
  nl: {
    title: "BelgoBase online", existing: "Inloggen", existingHelp: "Meld je aan met het e-mailadres van je account.", new: "Nieuw bij BelgoBase", newHelp: "Schrijf je zakelijke account veilig in.", noAccount: "Nog geen account?", createAccount: "Maak een account aan",
    email: "E-mailadres", license: "Licentiecode (optioneel)", enrollmentLicense: "BelgoBase-licentiecode", enrollmentLicenseHelp: "Voor registratie heb je een bestaande BelgoBase-licentie nodig.", licenseHelp: "Heb je al een BelgoBase-account? Dan volstaat je geregistreerde e-mailadres.", requestLicenseIntro: "Geen licentie?", requestLicense: "Toegang aanvragen", requestLicenseHelp: "Dit opent je e-mailprogramma.", requestLicenseSubject: "BelgoBase licentie aanvragen", requestLicenseBody: "Naam:\nBedrijf:\n", remember: "Op dit apparaat aangemeld blijven", send: "Code per e-mail ontvangen", working: "Even geduld…",
    codeTitle: "Controleer je e-mail", loginCodeHelp: "Als dit e-mailadres aan een actief account gekoppeld is, ontvang je een code. Controleer ook ongewenste e-mail.", enrollmentCodeHelp: "Voer de beveiligingscode uit je e-mail in.", code: "Beveiligingscode", login: "Aanmelden", verify: "E-mailadres bevestigen", back: "Terug", otherEmail: "Gebruik een ander e-mailadres",
    profileTitle: "Bevestig je bedrijfsgegevens", profileHelp: "BelgoBase is momenteel beschikbaar voor professionele gebruikers. Zoek je onderneming op en controleer de gegevens voordat je inschrijving wordt voltooid.",
    enterpriseHelp: "10 cijfers, met of zonder BE, punten of spaties. Bijvoorbeeld: 1006303437 of BE 1006.303.437. Hetzelfde ondernemingsnummer kan voor meerdere licenties worden gebruikt.", enterprise: "Ondernemingsnummer (KBO)", find: "Bedrijfsgegevens ophalen", company: "Wettelijke bedrijfsnaam", address: "Adres", name: "Naam van de aanvaarder", function: "Functie van de aanvaarder", read: "Lees document", close: "Sluiten", finish: "Zakelijke inschrijving voltooien",
    preflightExpired: "Deze controle is verlopen. Klik op Bedrijfsgegevens ophalen en bevestig de documenten opnieuw. Je naam en functie blijven ingevuld.",
    consumer: "Particuliere inschrijving is nog niet beschikbaar. BelgoBase online is momenteel voor professionele gebruikers.", logout: "Afmelden", loggedOut: "Je bent afgemeld.", loading: "Je veilige werkomgeving wordt geladen…", expired: "Je sessie is beëindigd. Meld je opnieuw aan.",
    generic: "Dit kon niet worden afgerond. Controleer je gegevens en probeer opnieuw.", invalid: "Controleer de ingevulde gegevens.", invalidCode: "De code is ongeldig of verlopen.", enrollmentInvalid: "Je inschrijving is niet meer geldig. Begin opnieuw.", companyMissing: "Deze onderneming werd niet gevonden. Controleer het ondernemingsnummer.", conflict: "Deze licentie is al gekoppeld. Meld je aan met het bestaande e-mailadres.", legal: "Bevestig alle verplichte documenten en gegevens.", devices: "Deze licentie biedt momenteel geen toegang. Neem contact op met BelgoBase.", unavailable: "Aanmelden is tijdelijk niet beschikbaar. Probeer later opnieuw.", serviceUnavailableTitle: "BelgoBase is tijdelijk niet bereikbaar", serviceUnavailableHelp: "Je aanmeldstatus kon niet veilig worden gecontroleerd. Probeer het opnieuw; je bent niet afgemeld.", retrySession: "Opnieuw proberen", rateLimited: "Wacht even voordat je opnieuw een code aanvraagt.", resend: "Code opnieuw versturen", resendIn: "Opnieuw versturen over {seconds}s", account: "Account", accountIntro: "Beheer je account en aangemelde browsers.", windowsDownload: "BelgoBase voor Windows downloaden", downloadStarting: "Download voorbereiden…", downloadUnavailable: "De Windows-download is tijdelijk niet beschikbaar. Probeer het later opnieuw.", windowsOnly: "Alleen voor Windows.", activeBrowsers: "Aangemelde browsers", currentBrowser: "Deze browser", revoke: "Browser afmelden", revokeConfirm: "Deze browser afmelden?", lastSeen: "Laatst gebruikt", noBrowsers: "Geen actieve browsers gevonden.", accountLoading: "Aangemelde browsers laden…", browserLoadFailed: "De aangemelde browsers konden niet worden geladen.", closeAccount: "Paneel sluiten", customerNumber: "Klantnummer", licenseId: "Publieke licentie-ID", accountReferences: "Accountreferenties", referenceLoading: "Accountreferenties laden…", referenceUnavailable: "Niet beschikbaar", referenceLoadFailed: "De accountreferenties konden niet worden geladen.", copyReference: "Kopiëren", copiedReference: "{label} gekopieerd.", copyFailed: "{label} kon niet worden gekopieerd.", legalLanguageNotice: "De bindende documenten zijn momenteel in het Nederlands.",
  },
  en: {
    title: "BelgoBase online", existing: "Sign in", existingHelp: "Sign in with the email address on your account.", new: "New to BelgoBase", newHelp: "Set up your professional account securely.", noAccount: "No account yet?", createAccount: "Create an account",
    email: "Email address", license: "License code (optional)", enrollmentLicense: "BelgoBase license code", enrollmentLicenseHelp: "Registration requires an existing BelgoBase licence.", licenseHelp: "Already have a BelgoBase account? Your registered email address is enough.", requestLicenseIntro: "No licence?", requestLicense: "Request access", requestLicenseHelp: "This opens your email app.", requestLicenseSubject: "Request a BelgoBase licence", requestLicenseBody: "Name:\nCompany:\n", remember: "Keep me signed in on this device", send: "Send email code", working: "Please wait…",
    codeTitle: "Check your email", loginCodeHelp: "If this email address is linked to an active account, you will receive a code. Please check your junk email too.", enrollmentCodeHelp: "Enter the security code from your email.", code: "Security code", login: "Sign in", verify: "Confirm email address", back: "Back", otherEmail: "Use a different email address",
    profileTitle: "Confirm your company details", profileHelp: "BelgoBase is currently available to professional users. Find your company and check the details before completing enrolment.",
    enterpriseHelp: "10 digits, with or without BE, dots or spaces. For example: 1006303437 or BE 1006.303.437. The same company number can be used for multiple licences.", enterprise: "Company number (CBE)", find: "Get company details", company: "Legal company name", address: "Address", name: "Name of the person accepting", function: "Role of the person accepting", read: "Read document", close: "Close", finish: "Complete professional enrolment",
    preflightExpired: "This check has expired. Retrieve the company details and confirm the documents again. Your name and role have been kept.",
    consumer: "Consumer enrolment is not available yet. BelgoBase online is currently for professional users.", logout: "Sign out", loggedOut: "You have been signed out.", loading: "Loading your secure workspace…", expired: "Your session has ended. Please sign in again.",
    generic: "This could not be completed. Check your details and try again.", invalid: "Check the details you entered.", invalidCode: "The code is invalid or expired.", enrollmentInvalid: "Your enrolment is no longer valid. Please start again.", companyMissing: "This company could not be found. Check the company number.", conflict: "This license is already linked. Sign in with the existing email address.", legal: "Confirm all required documents and details.", devices: "This licence currently has no access available. Please contact BelgoBase.", unavailable: "Sign-in is temporarily unavailable. Please try again later.", serviceUnavailableTitle: "BelgoBase is temporarily unavailable", serviceUnavailableHelp: "Your sign-in status could not be checked safely. Try again; you have not been signed out.", retrySession: "Try again", rateLimited: "Please wait before requesting another code.", resend: "Resend code", resendIn: "Resend in {seconds}s", account: "Account", accountIntro: "Manage your account and signed-in browsers.", windowsDownload: "Download BelgoBase for Windows", downloadStarting: "Preparing download…", downloadUnavailable: "The Windows download is temporarily unavailable. Try again later.", windowsOnly: "Windows only.", activeBrowsers: "Signed-in browsers", currentBrowser: "This browser", revoke: "Sign out browser", revokeConfirm: "Sign out this browser?", lastSeen: "Last used", noBrowsers: "No active browsers found.", accountLoading: "Loading signed-in browsers…", browserLoadFailed: "The signed-in browsers could not be loaded.", closeAccount: "Close panel", customerNumber: "Customer number", licenseId: "Public licence ID", accountReferences: "Account references", referenceLoading: "Loading account references…", referenceUnavailable: "Unavailable", referenceLoadFailed: "The account references could not be loaded.", copyReference: "Copy", copiedReference: "{label} copied.", copyFailed: "{label} could not be copied.", legalLanguageNotice: "The binding documents are currently available in Dutch.",
  },
  fr: {
    title: "BelgoBase en ligne", existing: "Se connecter", existingHelp: "Connectez-vous avec l’adresse e-mail de votre compte.", new: "Nouveau sur BelgoBase", newHelp: "Créez votre compte professionnel de manière sécurisée.", noAccount: "Pas encore de compte ?", createAccount: "Créer un compte",
    email: "Adresse e-mail", license: "Code de licence (facultatif)", enrollmentLicense: "Code de licence BelgoBase", enrollmentLicenseHelp: "L’inscription nécessite une licence BelgoBase existante.", licenseHelp: "Vous avez déjà un compte BelgoBase ? Votre adresse e-mail enregistrée suffit.", requestLicenseIntro: "Pas de licence ?", requestLicense: "Demander un accès", requestLicenseHelp: "Cela ouvre votre application de messagerie.", requestLicenseSubject: "Demande de licence BelgoBase", requestLicenseBody: "Nom :\nEntreprise :\n", remember: "Rester connecté sur cet appareil", send: "Recevoir un code par e-mail", working: "Un instant…",
    codeTitle: "Vérifiez vos e-mails", loginCodeHelp: "Si cette adresse e-mail est liée à un compte actif, vous recevrez un code. Vérifiez aussi vos courriers indésirables.", enrollmentCodeHelp: "Saisissez le code de sécurité reçu par e-mail.", code: "Code de sécurité", login: "Se connecter", verify: "Confirmer l’adresse e-mail", back: "Retour", otherEmail: "Utiliser une autre adresse e-mail",
    profileTitle: "Confirmez les données de votre entreprise", profileHelp: "BelgoBase est actuellement disponible pour les utilisateurs professionnels. Recherchez votre entreprise et vérifiez les données avant de terminer l’inscription.",
    enterpriseHelp: "10 chiffres, avec ou sans BE, points ou espaces. Par exemple : 1006303437 ou BE 1006.303.437. Le même numéro d’entreprise peut être utilisé pour plusieurs licences.", enterprise: "Numéro d’entreprise (BCE)", find: "Récupérer les données de l’entreprise", company: "Dénomination légale", address: "Adresse", name: "Nom de la personne qui accepte", function: "Fonction de la personne qui accepte", read: "Lire le document", close: "Fermer", finish: "Terminer l’inscription professionnelle",
    preflightExpired: "Cette vérification a expiré. Recherchez à nouveau les données de l’entreprise et confirmez les documents. Votre nom et votre fonction sont conservés.",
    consumer: "L’inscription pour les particuliers n’est pas encore disponible. BelgoBase en ligne est actuellement réservé aux professionnels.", logout: "Se déconnecter", loggedOut: "Vous êtes déconnecté.", loading: "Chargement de votre espace sécurisé…", expired: "Votre session est terminée. Connectez-vous à nouveau.",
    generic: "Cette opération n’a pas pu être terminée. Vérifiez vos données et réessayez.", invalid: "Vérifiez les données saisies.", invalidCode: "Le code est invalide ou a expiré.", enrollmentInvalid: "Votre inscription n’est plus valide. Recommencez.", companyMissing: "Cette entreprise est introuvable. Vérifiez le numéro d’entreprise.", conflict: "Cette licence est déjà liée. Connectez-vous avec l’adresse e-mail existante.", legal: "Confirmez tous les documents et renseignements obligatoires.", devices: "Cette licence ne permet pas l’accès actuellement. Contactez BelgoBase.", unavailable: "La connexion est temporairement indisponible. Réessayez plus tard.", serviceUnavailableTitle: "BelgoBase est temporairement indisponible", serviceUnavailableHelp: "Votre état de connexion n’a pas pu être vérifié en toute sécurité. Réessayez ; vous n’avez pas été déconnecté.", retrySession: "Réessayer", rateLimited: "Patientez avant de demander un autre code.", resend: "Renvoyer le code", resendIn: "Renvoyer dans {seconds}s", account: "Compte", accountIntro: "Gérez votre compte et les navigateurs connectés.", windowsDownload: "Télécharger BelgoBase pour Windows", downloadStarting: "Préparation du téléchargement…", downloadUnavailable: "Le téléchargement Windows est temporairement indisponible. Réessayez plus tard.", windowsOnly: "Windows uniquement.", activeBrowsers: "Navigateurs connectés", currentBrowser: "Ce navigateur", revoke: "Déconnecter le navigateur", revokeConfirm: "Déconnecter ce navigateur ?", lastSeen: "Dernière utilisation", noBrowsers: "Aucun navigateur actif trouvé.", accountLoading: "Chargement des navigateurs connectés…", browserLoadFailed: "Les navigateurs connectés n’ont pas pu être chargés.", closeAccount: "Fermer le panneau", customerNumber: "Numéro de client", licenseId: "ID public de licence", accountReferences: "Références du compte", referenceLoading: "Chargement des références du compte…", referenceUnavailable: "Indisponible", referenceLoadFailed: "Les références du compte n’ont pas pu être chargées.", copyReference: "Copier", copiedReference: "{label} copié.", copyFailed: "Impossible de copier {label}.", legalLanguageNotice: "Les documents contraignants sont actuellement disponibles en néerlandais.",
  },
} as const;

async function json(response: Response): Promise<Result> { try { return (await response.json()) as Result; } catch { return {}; } }
function safeHref(value: string) { try { const url = new URL(value, window.location.origin); return url.origin === window.location.origin ? url.pathname + url.search + url.hash : undefined; } catch { return undefined; } }
export function desktopDownloadHref(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    const installer = /^\/client-updates\/download\/BelgoBase_CloudClient_Setup_BUILD[1-9]\d{2,}_UPDATE[1-9]\d*\.exe$/;
    return url.origin === "https://api.belgobase.be" && !url.username && !url.password && !url.port && !url.search && !url.hash && installer.test(url.pathname) ? url.href : undefined;
  } catch { return undefined; }
}
export function validSessionProjection(value: Result): value is Result & { authenticated: true; csrf: string } {
  return value.authenticated === true && typeof value.csrf === "string" && /^[A-Za-z0-9_-]{16,200}$/.test(value.csrf);
}
export function retryLocksCodeInput(phase: Phase, available: boolean) { return phase === "loginCode" && available; }
export function sessionPollOutcome(status: number, value: Result): "signedOut" | "accessDenied" | "unchanged" {
  if (status === 401 || (status >= 200 && status < 300 && value.authenticated === false)) return "signedOut";
  if (status === 403 && ["license_inactive", "identity_changed", "authorization_denied"].includes(value.error || "")) return "accessDenied";
  return "unchanged";
}
function addressLine(value: { street?: string; house_number?: string; postal_code?: string; municipality?: string } | undefined) {
  if (!value || typeof value !== "object") return "";
  const address = value as { street?: string; house_number?: string; postal_code?: string; municipality?: string };
  return [([address.street, address.house_number].filter(Boolean).join(" ")), ([address.postal_code, address.municipality].filter(Boolean).join(" "))].filter(Boolean).join(", ");
}
function errorMessage(code: string | undefined, t: (typeof text)[ShellLanguage], phoneInvalid?: string) {
  return ({ invalid_request: t.invalid, support_phone_invalid: phoneInvalid || t.invalid, code_invalid: t.invalidCode, otp_invalid: t.invalidCode, rate_limited: t.rateLimited, enrollment_invalid: t.enrollmentInvalid, enrollment_expired: t.enrollmentInvalid, company_not_found: t.companyMissing, binding_conflict: t.conflict, legal_acceptance_invalid: t.legal, legal_preflight_expired: t.preflightExpired, session_expired: t.expired, signed_out: t.loggedOut, browser_limit_reached: t.devices, license_inactive: t.devices, identity_changed: t.devices, authorization_denied: t.devices, temporarily_unavailable: t.unavailable, mail_unavailable: t.unavailable, consumer_registration_unavailable: t.consumer } as Record<string, string>)[code || ""] || t.generic;
}
function cleanReference(value: unknown): string | undefined { const result = typeof value === "string" ? value.trim() : ""; return result || undefined; }
export function accountReferences(result: Result): AccountReferences {
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const row = (labels: string[]) => cleanReference(rows.find((item) => labels.includes(String(item.label || item.key || "").trim().toLocaleLowerCase("nl")))?.value);
  return {
    customerNumber: cleanReference(result.customer?.customer_number) || row(["klantnummer", "customer number", "numéro de client", "customer_number"]),
    licenseId: cleanReference(result.license?.license_id) || row(["licentie-id", "licentie id", "license id", "licence id", "id de licence", "license_id"]),
  };
}

export function WorkspaceApp({ locale }: { locale: Locale }) {
  const [shellLanguage, setShellLanguage] = useState<ShellLanguage>(locale);
  const t = text[shellLanguage];
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState("");
  const [licenseCode, setLicenseCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessionRetryAvailable, setSessionRetryAvailable] = useState(false);
  const [account, setAccount] = useState<Session["account"]>();
  const [csrf, setCsrf] = useState("");
  const [enrollmentCsrf, setEnrollmentCsrf] = useState("");
  const [enterprise, setEnterprise] = useState("");
  const [company, setCompany] = useState("");
  const [acceptantName, setAcceptantName] = useState("");
  const [acceptantFunction, setAcceptantFunction] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [details, setDetails] = useState<Details>();
  const [declarations, setDeclarations] = useState(initialDeclarations);
  const [documentView, setDocumentView] = useState<{ title: string; text: string }>();
  const [documentLoading, setDocumentLoading] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState("");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [browserSessions, setBrowserSessions] = useState<BrowserSession[]>([]);
  const [browserSessionsError, setBrowserSessionsError] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountReferenceBusy, setAccountReferenceBusy] = useState(false);
  const [accountReferenceError, setAccountReferenceError] = useState(false);
  const [references, setReferences] = useState<AccountReferences>({});
  const [copyFeedback, setCopyFeedback] = useState<{ message: string; error: boolean }>();
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const downloadLock = useRef(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const documentCloseButton = useRef<HTMLButtonElement>(null);
  const clearEnrollment = useCallback(() => {
    setEnrollmentCsrf(""); setEnterprise(""); setCompany(""); setAcceptantName(""); setAcceptantFunction(""); setSupportPhone(""); setDetails(undefined); setDeclarations(initialDeclarations);
  }, []);

  const loadSession = useCallback(async () => {
    const response = await fetch("/api/web/auth/session", { cache: "no-store", credentials: "same-origin" });
    const value = await json(response);
    if (response.ok && value.authenticated === true) {
      if (!validSessionProjection(value)) throw new Error("temporarily_unavailable");
      setAccount(value.account); setCsrf(value.csrf); setError(""); setSessionRetryAvailable(false); setPhase("workspace"); return;
    }
    if (response.ok) { setAccount(undefined); setCsrf(""); setError(""); setSessionRetryAvailable(false); setPhase("login"); return; }
    if (response.status === 401) { setAccount(undefined); setCsrf(""); setSessionRetryAvailable(false); setPhase("login"); return; }
    if (response.status === 403 && ["license_inactive", "identity_changed", "authorization_denied"].includes(value.error || "")) {
      setAccount(undefined); setCsrf(""); setSessionRetryAvailable(false); setError(value.error || "license_inactive"); setPhase("login"); return;
    }
    throw new Error(response.status >= 500 ? "temporarily_unavailable" : value.error || "unknown_error");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadSession().catch((reason) => { setError(reason instanceof Error ? reason.message : "temporarily_unavailable"); setPhase("serviceUnavailable"); }), 0);
    return () => window.clearTimeout(timer);
  }, [loadSession, locale]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "belgobase-web-language" && ["nl", "fr", "en"].includes(event.data.language)) {
        setShellLanguage(event.data.language as ShellLanguage);
      }
      if (event.data?.type === "belgobase-web-auth-expired" || event.data?.type === "belgobase-web-logout") {
        setAccount(undefined); setLicenseCode(""); setChallengeId(""); setCode(""); setSessionRetryAvailable(false); setAccountOpen(false); setBrowserSessions([]); setReferences({}); setCopyFeedback(undefined); clearEnrollment(); setError(event.data.type === "belgobase-web-auth-expired" ? "session_expired" : "signed_out"); setPhase("login");
      }
    };
    window.addEventListener("message", onMessage); return () => window.removeEventListener("message", onMessage);
  }, [clearEnrollment, t.expired, t.loggedOut]);
  useEffect(() => {
    if ((phase !== "loginCode" && phase !== "enrollCode") || resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((current) => Math.max(0, current - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [phase, resendIn]);
  useEffect(() => {
    if (!loadedVersion || phase !== "workspace") return;
    let cancelled = false;
    const check = async () => { if (document.visibilityState === "hidden") return; try { const response = await fetch("/api/web/version", { cache: "no-store" }); const result = await response.json(); if (!cancelled && response.ok && typeof result.version === "string") setUpdateAvailable(result.version !== loadedVersion); } catch {} };
    const timer = window.setInterval(() => void check(), 60_000);
    window.addEventListener("focus", check); document.addEventListener("visibilitychange", check); void check();
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [loadedVersion, phase]);
  useEffect(() => {
    if (phase !== "workspace") return;
    let cancelled = false;
    let checking = false;
    const checkSession = async () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const response = await fetch("/api/web/auth/session", { cache: "no-store", credentials: "same-origin" });
        const result = await json(response);
        const outcome = sessionPollOutcome(response.status, result);
        if (!cancelled && outcome === "signedOut") {
          setAccount(undefined); setCsrf(""); setAccountOpen(false); setBrowserSessions([]); setReferences({}); setCopyFeedback(undefined);
          setError("session_expired"); setPhase("login");
        } else if (!cancelled && outcome === "accessDenied") {
          setAccount(undefined); setCsrf(""); setAccountOpen(false); setBrowserSessions([]); setReferences({}); setCopyFeedback(undefined);
          setError(result.error || "license_inactive"); setPhase("login");
        } else if (!cancelled && response.ok && validSessionProjection(result)) {
          setAccount(result.account); setCsrf(result.csrf);
        }
      } catch { /* A network interruption is not a logout. */ }
      finally { checking = false; }
    };
    const timer = window.setInterval(() => void checkSession(), 15_000);
    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", checkSession);
    return () => {
      cancelled = true; window.clearInterval(timer);
      window.removeEventListener("focus", checkSession);
      document.removeEventListener("visibilitychange", checkSession);
    };
  }, [phase, t.expired]);
  useEffect(() => {
    if (!documentView) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const timer = window.setTimeout(() => documentCloseButton.current?.focus(), 0);
    return () => { window.clearTimeout(timer); previousFocus?.focus(); };
  }, [documentView]);

  async function request(path: string, body: object, csrfToken?: string) {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...(csrfToken ? { "X-BelgoBase-CSRF": csrfToken } : {}) }, credentials: "same-origin", body: JSON.stringify(body) });
    return { response, result: await json(response) };
  }
  async function retrySession(stayOnCode = false) {
    setBusy(true); setError("");
    try { await loadSession(); }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : "temporarily_unavailable");
      if (stayOnCode) setSessionRetryAvailable(true); else setPhase("serviceUnavailable");
    } finally { setBusy(false); }
  }
  async function sendLoginCode() {
    setBusy(true); setError("");
    try { const { response, result } = await request("/api/web/auth/start", { email: email.trim(), remember, language: shellLanguage }); if (!response.ok || !result.ok || !result.challenge_id) throw new Error(result.error || "unknown_error"); setChallengeId(result.challenge_id); setCode(""); setSessionRetryAvailable(false); setResendIn(30); setPhase("loginCode"); } catch (reason) { setError(reason instanceof Error ? reason.message : "unknown_error"); } finally { setBusy(false); }
  }
  async function startLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); await sendLoginCode();
  }
  async function resendLoginCode() {
    if (busy || resendIn > 0) return;
    await sendLoginCode();
  }
  async function verifyLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { response, result } = await request("/api/web/auth/verify", { challenge_id: challengeId, code: code.trim() });
      if (!response.ok || !result.ok) throw new Error(result.error || "unknown_error");
      if (validSessionProjection(result)) { setAccount(result.account); setCsrf(result.csrf); setSessionRetryAvailable(false); setPhase("workspace"); }
      else {
        try { await loadSession(); }
        catch (reason) { setSessionRetryAvailable(true); throw reason; }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "unknown_error"); } finally { setBusy(false); }
  }
  async function startEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const { response, result } = await request("/api/web/enrollment/start", { license_code: licenseCode.trim(), email: email.trim(), remember_browser: remember, language: shellLanguage }); if (!response.ok || !result.ok || !result.challenge_id) throw new Error(result.error || "unknown_error"); setChallengeId(result.challenge_id); setCode(""); setSessionRetryAvailable(false); setResendIn(30); setPhase("enrollCode"); } catch (reason) { setError(reason instanceof Error ? reason.message : "unknown_error"); } finally { setBusy(false); }
  }
  async function resendEnrollmentCode() {
    if (busy || resendIn > 0) return;
    setBusy(true); setError("");
    try { const { response, result } = await request("/api/web/enrollment/start", { license_code: licenseCode.trim(), email: email.trim(), remember_browser: remember, language: shellLanguage }); if (!response.ok || !result.ok || !result.challenge_id) throw new Error(result.error || "unknown_error"); setChallengeId(result.challenge_id); setCode(""); setSessionRetryAvailable(false); setResendIn(30); } catch (reason) { setError(reason instanceof Error ? reason.message : "unknown_error"); } finally { setBusy(false); }
  }
  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const { response, result } = await request("/api/web/enrollment/verify", { challenge_id: challengeId, code: code.trim() }); if (!response.ok || !result.ok || !result.enrollment_verified || !result.csrf) throw new Error(result.error || "unknown_error"); setEnrollmentCsrf(result.csrf); setCode(""); setPhase("profile"); } catch (reason) { setError(reason instanceof Error ? reason.message : "unknown_error"); } finally { setBusy(false); }
  }
  async function autofill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const { response, result } = await request("/api/web/enrollment/autofill", { enterprise_number: enterprise.trim().replace(/^BE\s*/i, "").replace(/[.\s-]/g, "") }, enrollmentCsrf); if (!response.ok || !result.ok || result.company?.company_type !== "business" || !result.preflight_id || !result.preflight_fingerprint) throw new Error(result.error || "unknown_error"); setDetails(result); setEnterprise(result.company.enterprise_number || enterprise.trim()); setCompany(result.company.legal_name || ""); setDeclarations(initialDeclarations); } catch (reason) { setError(reason instanceof Error ? reason.message : "unknown_error"); } finally { setBusy(false); }
  }
  async function openDocument(document: LegalDocument) {
    const href = safeHref(document.view_url);
    if (!href) { setError("legal_acceptance_invalid"); return; }
    setDocumentLoading(true); setError("");
    try {
      const response = await fetch(href, { cache: "no-store", credentials: "same-origin" });
      const result = await json(response);
      if (!response.ok || !result.ok || typeof result.title !== "string" || typeof result.text !== "string") throw new Error(result.error || "unknown_error");
      setDocumentView({ title: result.title, text: result.text });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "unknown_error"); } finally { setDocumentLoading(false); }
  }
  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details?.preflight_id || !details.preflight_fingerprint || !legalReady || !Object.values(declarations).every(Boolean)) { setError("legal_acceptance_invalid"); return; }
    if (details.preflight_expires_at && Date.parse(details.preflight_expires_at) <= Date.now()) { setDetails(undefined); setDeclarations(initialDeclarations); setError("legal_preflight_expired"); return; }
    setBusy(true); setError("");
    try {
      const { response, result } = await request("/api/web/enrollment/complete", { company_type: "business", enterprise_number: enterprise.trim(), legal_name: company.trim(), support_phone: supportPhone.trim(), acceptant: { name: acceptantName.trim(), function: acceptantFunction.trim() }, declarations, choice_texts: details.legal?.choice_texts, preflight_id: details.preflight_id, preflight_fingerprint: details.preflight_fingerprint }, enrollmentCsrf);
      if (result.error === "legal_preflight_expired") { setDetails(undefined); setDeclarations(initialDeclarations); }
      if (!response.ok || !result.ok || result.authenticated !== true) throw new Error(result.error || "unknown_error");
      clearEnrollment();
      if (validSessionProjection(result)) { setAccount(result.account); setCsrf(result.csrf); setSessionRetryAvailable(false); setPhase("workspace"); }
      else {
        try { await loadSession(); }
        catch (reason) { setPhase("serviceUnavailable"); throw reason; }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "unknown_error"); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { const { response } = await request("/api/web/auth/logout", {}, csrf); if (!response.ok && response.status !== 401) throw new Error(); setAccount(undefined); setLicenseCode(""); setCsrf(""); setChallengeId(""); setCode(""); setAccountOpen(false); setBrowserSessions([]); setReferences({}); setCopyFeedback(undefined); setDownloadError(false); clearEnrollment(); setError("signed_out"); setPhase("login"); } catch { setError("unknown_error"); } finally { setBusy(false); }
  }
  async function loadBrowserSessions() {
    setAccountBusy(true); setBrowserSessions([]); setBrowserSessionsError(false); setError("");
    try {
      const response = await fetch("/api/web/auth/sessions", { cache: "no-store", credentials: "same-origin" });
      const result = await json(response);
      if (response.status === 401) { setAccount(undefined); setCsrf(""); setAccountOpen(false); setBrowserSessions([]); setError("session_expired"); setPhase("login"); return; }
      if (!response.ok || !result.ok || !Array.isArray(result.sessions)) throw new Error(result.error || "unknown_error");
      setBrowserSessions(result.sessions);
    } catch { setBrowserSessions([]); setBrowserSessionsError(true); } finally { setAccountBusy(false); }
  }
  async function loadAccountReferences() {
    setAccountReferenceBusy(true); setAccountReferenceError(false); setReferences({}); setCopyFeedback(undefined);
    try {
      const { response, result } = await request("/api/web/bridge/account_action", { action: "refresh" }, csrf);
      if (response.status === 401) { setAccount(undefined); setCsrf(""); setAccountOpen(false); setError("session_expired"); setPhase("login"); return; }
      if (!response.ok || !result.ok) throw new Error(result.error || "unknown_error");
      setReferences(accountReferences(result));
    } catch { setReferences({}); setAccountReferenceError(true); }
    finally { setAccountReferenceBusy(false); }
  }
  function openAccount() { setAccountOpen(true); void loadBrowserSessions(); void loadAccountReferences(); }
  async function copyReference(label: string, value: string | undefined) {
    if (!value) { setCopyFeedback({ message: t.copyFailed.replace("{label}", label), error: true }); return; }
    let copied = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); copied = true; } } catch {}
    if (!copied) {
      const area = document.createElement("textarea");
      area.value = value; area.readOnly = true; area.style.position = "fixed"; area.style.opacity = "0";
      document.body.append(area); area.select();
      try { copied = document.execCommand("copy"); } catch {} finally { area.remove(); }
    }
    setCopyFeedback({ message: (copied ? t.copiedReference : t.copyFailed).replace("{label}", label), error: !copied });
  }
  async function downloadDesktop() {
    if (downloadLock.current) return;
    downloadLock.current = true; setDownloadBusy(true); setDownloadError(false);
    try {
      const response = await fetch(`/api/web/desktop-download?lang=${shellLanguage}&format=json`, { cache: "no-store", credentials: "same-origin" });
      const result = await json(response);
      if (response.status === 401) {
        setAccount(undefined); setCsrf(""); setAccountOpen(false); setBrowserSessions([]); setReferences({}); setCopyFeedback(undefined); setError("session_expired"); setPhase("login"); return;
      }
      const href = response.ok && result.ok ? desktopDownloadHref(result.url) : undefined;
      if (!href) throw new Error("desktop_download_unavailable");
      const link = document.createElement("a");
      link.href = href; link.download = new URL(href).pathname.split("/").pop() || "BelgoBase_Setup.exe"; link.hidden = true; link.rel = "noopener";
      document.body.append(link);
      try { link.click(); } finally { link.remove(); }
    } catch { setDownloadError(true); }
    finally { downloadLock.current = false; setDownloadBusy(false); }
  }
  async function revokeBrowser(browser: BrowserSession) {
    if (!window.confirm(t.revokeConfirm)) return;
    setAccountBusy(true); setError("");
    try {
      const { response, result } = await request("/api/web/auth/revoke", { browser_id: browser.browser_id }, csrf);
      if (response.status === 401) { setAccount(undefined); setCsrf(""); setAccountOpen(false); setBrowserSessions([]); setError("session_expired"); setPhase("login"); return; }
      if (!response.ok || !result.ok) throw new Error(result.error || "unknown_error");
      if (result.current_session_revoked || browser.current) {
        setAccount(undefined); setCsrf(""); setAccountOpen(false); setBrowserSessions([]); setError("signed_out"); setPhase("login");
      } else {
        await loadBrowserSessions();
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "unknown_error"); } finally { setAccountBusy(false); }
  }
  function selectShellLanguage(language: ShellLanguage) {
    setShellLanguage(language);
    frame.current?.contentWindow?.postMessage({ type: "belgobase-web-language", language }, window.location.origin);
  }
  const back = () => { setError(""); setChallengeId(""); setCode(""); setSessionRetryAvailable(false); setResendIn(0); clearEnrollment(); setPhase("login"); };
  const documents = details?.legal?.documents || [];
  const choices = details?.legal?.choice_texts || {};
  const phone = phoneText[shellLanguage];
  const authorityText = choices.business_authority || details?.legal?.authority_declaration?.text;
  const legalReady = Boolean(authorityText?.trim()) && documents.length === 3 && ["general_terms", "usage_terms", "privacy_notice"].every((key) => typeof choices[key as keyof typeof choices] === "string" && choices[key as keyof typeof choices]?.trim());
  const codeInputLocked = retryLocksCodeInput(phase, sessionRetryAvailable);
  const licenseRequestHref = `mailto:david@belgobase.be?subject=${encodeURIComponent(t.requestLicenseSubject)}&body=${encodeURIComponent(t.requestLicenseBody)}`;

  if (phase === "workspace") return <main className={styles.workspace} lang={shellLanguage}>
    <div className={styles.workspaceBar}>
      <span className={styles.workspaceIdentity}>{account?.name || account?.email || "BelgoBase"}</span>
      <div className={styles.workspaceActions}>
        <label className={styles.languagePicker}><span className={styles.visuallyHidden}>Taal / Language / Langue</span><select aria-label="Taal / Language / Langue" value={shellLanguage} onChange={(event) => selectShellLanguage(event.target.value as ShellLanguage)}><option value="nl">NL</option><option value="fr">FR</option><option value="en">EN</option></select></label>
        <button type="button" onClick={openAccount} disabled={accountBusy}>{t.account}</button>
        <button type="button" onClick={() => void logout()} disabled={busy}>{t.logout}</button>
      </div>
    </div>
    {error ? <p role="alert" className={styles.error}>{errorMessage(error, t)}</p> : null}
    {accountOpen ? <section className={styles.accountPanel} aria-label={t.account}>
      <div className={styles.accountPanelHeader}><div><h2>{t.account}</h2><p>{t.accountIntro}</p></div><button className={styles.secondary} type="button" onClick={() => setAccountOpen(false)}>{t.closeAccount}</button></div>
      <h3>{t.accountReferences}</h3>
      {accountReferenceBusy ? <p className={styles.readonly} role="status">{t.referenceLoading}</p> : null}
      {!accountReferenceBusy ? <div className={styles.accountReferences}>
        <div><span>{t.customerNumber}</span><strong>{references.customerNumber || t.referenceUnavailable}</strong><button disabled={!references.customerNumber} type="button" onClick={() => void copyReference(t.customerNumber, references.customerNumber)}>{t.copyReference}</button></div>
        <div><span>{t.licenseId}</span><strong>{references.licenseId || t.referenceUnavailable}</strong><button disabled={!references.licenseId} type="button" onClick={() => void copyReference(t.licenseId, references.licenseId)}>{t.copyReference}</button></div>
      </div> : null}
      {accountReferenceError ? <p className={styles.referenceError} role="alert">{t.referenceLoadFailed}</p> : null}
      {copyFeedback ? <p className={copyFeedback.error ? styles.referenceError : styles.referenceSuccess} role={copyFeedback.error ? "alert" : "status"}>{copyFeedback.message}</p> : null}
      <div className={styles.windowsDownload}><button disabled={downloadBusy} type="button" onClick={() => void downloadDesktop()}>{downloadBusy ? t.downloadStarting : t.windowsDownload}</button><span>{t.windowsOnly}</span>{downloadError ? <p className={styles.referenceError} role="alert">{t.downloadUnavailable}</p> : null}</div>
      <h3>{t.activeBrowsers}</h3>
      {accountBusy ? <p className={styles.readonly} role="status">{t.accountLoading}</p> : null}
      {!accountBusy && browserSessionsError ? <p className={styles.referenceError} role="alert">{t.browserLoadFailed}</p> : null}
      {!accountBusy && !browserSessionsError && browserSessions.length === 0 ? <p className={styles.readonly}>{t.noBrowsers}</p> : null}
      {!accountBusy && browserSessions.length > 0 ? <ul className={styles.browserSessions}>{browserSessions.map((browser) => <li key={browser.browser_id}><div><strong>{browser.label}{browser.current ? ` — ${t.currentBrowser}` : ""}</strong><span>{t.lastSeen}: {new Date(browser.last_seen_at).toLocaleString(shellLanguage)}</span></div><button type="button" onClick={() => void revokeBrowser(browser)}>{t.revoke}</button></li>)}</ul> : null}
    </section> : null}
    {updateAvailable ? <div className={styles.workspaceBar} role="status"><span>{shellLanguage === "nl" ? "Een nieuwe versie van BelgoBase staat klaar. Rond je huidige werk af en vernieuw." : shellLanguage === "fr" ? "Une nouvelle version de BelgoBase est prête. Terminez votre travail puis actualisez." : "A new BelgoBase version is ready. Finish your current work, then refresh."}</span><button type="button" onClick={() => { const message = shellLanguage === "nl" ? "Heb je je werk opgeslagen en je opname afgerond? BelgoBase wordt opnieuw geopend." : shellLanguage === "fr" ? "Avez-vous enregistré votre travail et terminé votre enregistrement ? BelgoBase va s’actualiser." : "Have you saved your work and finished recording? BelgoBase will reopen."; if (window.confirm(message)) window.location.reload(); }}>{shellLanguage === "nl" ? "Nieuwe versie openen" : shellLanguage === "fr" ? "Ouvrir la nouvelle version" : "Open new version"}</button></div> : null}
    <iframe ref={frame} onLoad={() => { const version = frame.current?.contentDocument?.querySelector('meta[name="belgobase-release"]')?.getAttribute("content"); if (version) { setLoadedVersion(version); setUpdateAvailable(false); } }} className={styles.frame} title="BelgoBase workspace" src="/api/web/workspace" allow="microphone" />
  </main>;
  if (phase === "checking") return <main className={styles.loading}>{t.loading}</main>;
  if (phase === "serviceUnavailable") return <main className={styles.page} lang={shellLanguage}><section className={styles.card} aria-labelledby="service-unavailable-title">
    <p className={styles.brand}>BelgoBase</p>
    <div className={styles.formLanguage}><label><span className={styles.visuallyHidden}>Taal / Language / Langue</span><select aria-label="Taal / Language / Langue" value={shellLanguage} onChange={(event) => selectShellLanguage(event.target.value as ShellLanguage)}><option value="nl">NL</option><option value="fr">FR</option><option value="en">EN</option></select></label></div>
    <h1 id="service-unavailable-title">{t.serviceUnavailableTitle}</h1><p className={styles.intro}>{t.serviceUnavailableHelp}</p>
    {error ? <p role="alert" className={styles.error}>{errorMessage(error, t)}</p> : null}
    <button disabled={busy} type="button" onClick={() => void retrySession()}>{busy ? t.working : t.retrySession}</button>
  </section></main>;
  const codePhase = phase === "loginCode" || phase === "enrollCode";
  return <main className={styles.page} lang={shellLanguage}><section className={styles.card} aria-labelledby="app-title">
    <p className={styles.brand}>BelgoBase</p>
    <div className={styles.formLanguage}><label><span className={styles.visuallyHidden}>Taal / Language / Langue</span><select aria-label="Taal / Language / Langue" value={shellLanguage} onChange={(event) => selectShellLanguage(event.target.value as ShellLanguage)}><option value="nl">NL</option><option value="fr">FR</option><option value="en">EN</option></select></label></div>
    {codePhase ? <><h1 id="app-title">{t.codeTitle}</h1><p className={styles.intro}>{phase === "loginCode" ? t.loginCodeHelp : t.enrollmentCodeHelp}</p>{error ? <p role="alert" className={styles.error}>{errorMessage(error, t)}</p> : null}<form aria-busy={busy} className={styles.form} onSubmit={phase === "loginCode" ? verifyLogin : verifyEnrollment}><label>{t.code}<input autoComplete="one-time-code" disabled={codeInputLocked} inputMode="numeric" maxLength={12} required value={code} onChange={(event) => setCode(event.target.value)} /></label>{codeInputLocked ? <button disabled={busy} type="button" onClick={() => void retrySession(true)}>{busy ? t.working : t.retrySession}</button> : <><button disabled={busy} type="submit">{busy ? t.working : phase === "loginCode" ? t.login : t.verify}</button><button className={styles.secondary} disabled={busy || resendIn > 0} type="button" onClick={() => void (phase === "loginCode" ? resendLoginCode() : resendEnrollmentCode())}>{resendIn > 0 ? t.resendIn.replace("{seconds}", String(resendIn)) : t.resend}</button></>}<button className={styles.secondary} disabled={busy} type="button" onClick={back}>{t.otherEmail}</button></form></> : null}
    {phase === "profile" ? <>
      <h1 id="app-title">{t.profileTitle}</h1><p className={styles.intro}>{t.profileHelp}</p><p className={styles.legalLanguageNotice}>{t.legalLanguageNotice}</p>{error ? <p role="alert" className={styles.error}>{errorMessage(error, t, phone.invalid)}</p> : null}
      <form aria-busy={busy} className={styles.form} onSubmit={autofill}><label>{t.enterprise}<input autoComplete="off" inputMode="text" placeholder="BE 1006.303.437" aria-describedby="enterprise-help" required value={enterprise} onChange={(event) => { setEnterprise(event.target.value); setDetails(undefined); setDeclarations(initialDeclarations); }} /></label><small id="enterprise-help">{t.enterpriseHelp}</small><button disabled={busy} type="submit">{busy ? t.working : t.find}</button></form>
      {details ? <form className={styles.form + " " + styles.confirmation} onSubmit={complete}>
        <label>{t.company}<input readOnly required value={company} /></label>
        {addressLine(details.company?.address) ? <p className={styles.readonly}><strong>{t.address}</strong><span>{addressLine(details.company?.address)}</span></p> : null}
        <label>{phone.label}<input autoComplete="tel" inputMode="tel" maxLength={64} placeholder="+32 470 12 34 56" value={supportPhone} onChange={(event) => setSupportPhone(event.target.value)} /><small>{phone.help}</small></label>
        <label>{t.name}<input autoComplete="name" required value={acceptantName} onChange={(event) => setAcceptantName(event.target.value)} /></label>
        <label>{t.function}<input required value={acceptantFunction} onChange={(event) => setAcceptantFunction(event.target.value)} /></label>
        {documents.map((document) => {
          const declaration = declarationByRole[document.role];
          const choice = document.role === "contractual_terms" ? choices.general_terms : document.role === "acceptable_use_terms" ? choices.usage_terms : choices.privacy_notice;
          return <label className={styles.checkbox} key={document.document_id}><input checked={declarations[declaration]} required type="checkbox" onChange={(event) => setDeclarations((current) => ({ ...current, [declaration]: event.target.checked }))} /><span>{choice} <button className={styles.documentButton} disabled={documentLoading} type="button" onClick={() => void openDocument(document)}>{t.read}</button></span></label>;
        })}
        <label className={styles.checkbox}><input checked={declarations.authority_declared} required type="checkbox" onChange={(event) => setDeclarations((current) => ({ ...current, authority_declared: event.target.checked }))} /><span>{authorityText}</span></label>
        <button disabled={busy || documents.length !== 3 || !Object.values(declarations).every(Boolean)} type="submit">{busy ? t.working : t.finish}</button>
      </form> : null}
      <button className={styles.textButton} disabled={busy} type="button" onClick={back}>{t.back}</button>
    </> : null}
    {phase === "login" || phase === "enroll" ? <>
      <h1 id="app-title">{phase === "login" ? t.existing : t.new}</h1><p className={styles.intro}>{phase === "login" ? t.existingHelp : t.newHelp}</p>{error ? <p role="alert" className={styles.error}>{errorMessage(error, t)}</p> : null}
      <form aria-busy={busy} className={styles.form} onSubmit={phase === "login" ? startLogin : startEnrollment}>
        <label>{t.email}<input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        {phase === "enroll" ? <><label>{t.enrollmentLicense}<input autoComplete="off" required value={licenseCode} onChange={(event) => setLicenseCode(event.target.value)} /><small>{t.enrollmentLicenseHelp}</small></label><div className={styles.licenseRequest}><div><span>{t.requestLicenseIntro} </span><a href={licenseRequestHref}>{t.requestLicense}</a></div><small>{t.requestLicenseHelp}</small></div></> : null}
        <label className={styles.checkbox}><input checked={remember} type="checkbox" onChange={(event) => setRemember(event.target.checked)} />{t.remember}</label>
        <button disabled={busy} type="submit">{busy ? t.working : t.send}</button>
        {phase === "enroll" ? <button className={styles.secondary} disabled={busy} type="button" onClick={back}>{t.back}</button> : null}
      </form>
      {phase === "login" ? <p className={styles.createAccount}>{t.noAccount} <button type="button" onClick={() => { setError(""); setLicenseCode(""); setSessionRetryAvailable(false); setPhase("enroll"); }}>{t.createAccount}</button></p> : null}
    </> : null}
    {documentView ? <div className={styles.modalBackdrop} role="presentation"><section aria-label={documentView.title} aria-modal="true" className={styles.documentModal} role="dialog" onKeyDown={(event) => { if (event.key === "Escape") setDocumentView(undefined); if (event.key === "Tab") { event.preventDefault(); documentCloseButton.current?.focus(); } }}><div className={styles.documentHeader}><h2>{documentView.title}</h2><button ref={documentCloseButton} type="button" onClick={() => setDocumentView(undefined)}>{t.close}</button></div><article className={styles.documentText}>{documentView.text}</article></section></div> : null}
  </section></main>;
}
