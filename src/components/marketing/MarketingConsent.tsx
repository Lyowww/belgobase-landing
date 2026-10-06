"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import {
  clearDisabledMarketingStorage,
  isMarketingPublicPathname,
  marketingMeasurementEnabled,
  readMarketingConsent,
  setMarketingConsent,
  syncMarketingMeasurementForPath,
  type MarketingConsentPreferences,
} from "@/lib/marketing-measurement";

const copy = {
  fr: {
    "title": "Votre choix de confidentialité",
    "body": "Avec votre accord, nous mesurons l’usage du site public et les résultats publicitaires. Le contenu des formulaires et les données de l’espace de travail ne sont pas envoyés à Google.",
    "reject": "Refuser",
    "acceptAll": "Tout autoriser",
    "configure": "Configurer",
    "save": "Enregistrer le choix",
    "settings": "Préférences de cookies",
    "more": "Déclaration relative aux cookies",
    "analyticsTitle": "Analyse du site",
    "analyticsBody": "GA4 mesure des pages vues filtrées, le temps d’engagement et un nombre limité d’actions de défilement, de boutons et de vidéos.",
    "adsTitle": "Mesure publicitaire",
    "adsBody": "Google Ads relie les visites publicitaires à une demande reçue, sans données du formulaire."
},
  nl: {
    title: "Uw privacykeuze",
    body: "Met uw toestemming meten we gebruik van de openbare website en het resultaat van advertenties. Formulierinhoud en werkruimtegegevens gaan niet naar Google.",
    reject: "Weigeren",
    acceptAll: "Alles toestaan",
    configure: "Instellen",
    save: "Keuze opslaan",
    settings: "Cookievoorkeuren",
    more: "Cookieverklaring",
    analyticsTitle: "Website-analyse",
    analyticsBody: "GA4 meet veilige paginaweergaven, betrokken tijd en beperkte scroll-, knop- en videoacties.",
    adsTitle: "Advertentiemeting",
    adsBody: "Google Ads koppelt advertentiebezoeken aan een geslaagde aanvraag, zonder formuliergegevens.",
  },
  en: {
    title: "Your privacy choice",
    body: "With your permission, we measure use of the public website and advertising results. Form contents and workspace data are not sent to Google.",
    reject: "Reject",
    acceptAll: "Allow all",
    configure: "Configure",
    save: "Save choice",
    settings: "Cookie preferences",
    more: "Cookie notice",
    analyticsTitle: "Website analytics",
    analyticsBody: "GA4 measures safe page views, engaged time and limited scroll, button and video actions.",
    adsTitle: "Advertising measurement",
    adsBody: "Google Ads links ad visits to a successfully received enquiry, without form details.",
  },
} as const;

const denied: MarketingConsentPreferences = { version: 2, analytics: false, ads: false };
const granted: MarketingConsentPreferences = { version: 2, analytics: true, ads: true };

export function MarketingConsent({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const [choice, setChoice] = useState<MarketingConsentPreferences | null>(null);
  const [draft, setDraft] = useState<MarketingConsentPreferences>(denied);
  const [open, setOpen] = useState(false);
  const [detailed, setDetailed] = useState(false);
  const enabled = marketingMeasurementEnabled();
  const isMarketingPage = enabled && isMarketingPublicPathname(pathname);
  const text = copy[locale];

  useEffect(() => {
    if (!enabled) {
      clearDisabledMarketingStorage();
      return;
    }
    syncMarketingMeasurementForPath(pathname);
    const frame = window.requestAnimationFrame(() => {
      const storedChoice = readMarketingConsent();
      setChoice(storedChoice);
      setDraft(storedChoice ?? denied);
      setDetailed(false);
      setOpen(isMarketingPublicPathname(pathname) && storedChoice === null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, pathname]);

  if (!isMarketingPage) return null;

  const choose = (preferences: MarketingConsentPreferences) => {
    setMarketingConsent(preferences);
    setChoice(preferences);
    setDraft(preferences);
    setOpen(false);
    setDetailed(false);
  };
  const openSettings = () => {
    setDraft(choice ?? denied);
    setDetailed(true);
    setOpen(true);
  };
  const buttonClass =
    "min-h-10 rounded-lg border border-primary/40 bg-surface px-4 py-2 text-sm font-semibold text-deep-navy transition-colors hover:border-primary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <>
      {open ? (
        <aside
          aria-label={text.title}
          className="fixed right-3 bottom-3 left-3 z-[80] mx-auto max-w-2xl rounded-xl border border-border bg-surface-elevated p-4 shadow-2xl sm:right-5 sm:bottom-5 sm:left-5 sm:p-5"
        >
          <h2 className="text-sm font-semibold text-deep-navy">{text.title}</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted sm:text-sm">
            {text.body}{" "}
            <Link href={`/${locale}/cookies`} className="font-medium text-primary underline underline-offset-2">
              {text.more}
            </Link>
          </p>
          {detailed && (
            <fieldset className="mt-4 space-y-3">
              <legend className="sr-only">{text.configure}</legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                <input
                  type="checkbox"
                  checked={draft.analytics}
                  onChange={(event) => setDraft({ ...draft, analytics: event.target.checked })}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-semibold text-deep-navy">{text.analyticsTitle}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">{text.analyticsBody}</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                <input
                  type="checkbox"
                  checked={draft.ads}
                  onChange={(event) => setDraft({ ...draft, ads: event.target.checked })}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-semibold text-deep-navy">{text.adsTitle}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">{text.adsBody}</span>
                </span>
              </label>
            </fieldset>
          )}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button type="button" className={buttonClass} onClick={() => choose(denied)}>
              {text.reject}
            </button>
            {detailed ? (
              <button type="button" className={`${buttonClass} sm:col-span-2`} onClick={() => choose(draft)}>
                {text.save}
              </button>
            ) : (
              <>
                <button type="button" className={buttonClass} onClick={() => setDetailed(true)}>
                  {text.configure}
                </button>
                <button type="button" className={buttonClass} onClick={() => choose(granted)}>
                  {text.acceptAll}
                </button>
              </>
            )}
          </div>
        </aside>
      ) : choice ? (
        <button
          type="button"
          className="fixed bottom-3 left-3 z-[70] rounded-full border border-border bg-surface-elevated px-3 py-2 text-xs font-medium text-muted shadow-lg transition-colors hover:text-deep-navy sm:bottom-5 sm:left-5"
          onClick={openSettings}
        >
          {text.settings}
        </button>
      ) : null}
    </>
  );
}
