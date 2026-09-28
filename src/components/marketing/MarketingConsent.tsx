"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import {
  isMarketingPublicPathname,
  marketingMeasurementEnabled,
  readMarketingConsent,
  setMarketingConsent,
  syncMarketingMeasurementForPath,
  type MarketingConsentChoice,
} from "@/lib/marketing-measurement";

const copy = {
  nl: {
    title: "Marketingmeting",
    body: "Met uw toestemming meten we alleen of een aanvraag na een Google-advertentie is ontvangen. We delen geen formuliergegevens en gebruiken dit niet voor gepersonaliseerde advertenties.",
    accept: "Toestaan",
    reject: "Weigeren",
    settings: "Cookievoorkeuren",
    more: "Cookieverklaring",
  },
  en: {
    title: "Marketing measurement",
    body: "With your permission, we only measure whether a request was received after a Google ad. We do not share form details or use this for personalised advertising.",
    accept: "Allow",
    reject: "Reject",
    settings: "Cookie preferences",
    more: "Cookie notice",
  },
} as const;

export function MarketingConsent({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const [choice, setChoice] = useState<MarketingConsentChoice | null>(null);
  const [open, setOpen] = useState(false);
  const enabled = marketingMeasurementEnabled();
  const isMarketingPage = enabled && isMarketingPublicPathname(pathname);
  const text = copy[locale];

  useEffect(() => {
    if (!enabled) return;
    syncMarketingMeasurementForPath(pathname);
    const frame = window.requestAnimationFrame(() => {
      const storedChoice = readMarketingConsent();
      setChoice(storedChoice);
      setOpen(isMarketingPublicPathname(pathname) && storedChoice === null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, pathname]);

  if (!isMarketingPage) return null;

  const choose = (nextChoice: MarketingConsentChoice) => {
    setMarketingConsent(nextChoice);
    setChoice(nextChoice);
    setOpen(false);
  };

  const choiceButtonClass =
    "min-h-10 flex-1 rounded-lg border border-primary/40 bg-surface px-4 py-2 text-sm font-semibold text-deep-navy transition-colors hover:border-primary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

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
            <Link
              href={`/${locale}/cookies`}
              className="font-medium text-primary underline underline-offset-2"
            >
              {text.more}
            </Link>
          </p>
          <div className="mt-4 flex gap-3">
            <button type="button" className={choiceButtonClass} onClick={() => choose("denied")}>
              {text.reject}
            </button>
            <button type="button" className={choiceButtonClass} onClick={() => choose("granted")}>
              {text.accept}
            </button>
          </div>
        </aside>
      ) : choice ? (
        <button
          type="button"
          className="fixed bottom-3 left-3 z-[70] rounded-full border border-border bg-surface-elevated px-3 py-2 text-xs font-medium text-muted shadow-lg transition-colors hover:text-deep-navy sm:bottom-5 sm:left-5"
          onClick={() => setOpen(true)}
        >
          {text.settings}
        </button>
      ) : null}
    </>
  );
}
