"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

type TranslationsContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  t: (key: string) => string;
};

const TranslationsContext = createContext<TranslationsContextValue | null>(null);

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const value = path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);

  return typeof value === "string" ? value : path;
}

type TranslationsProviderProps = {
  children: ReactNode;
  locale: Locale;
  dictionary: Dictionary;
};

export function TranslationsProvider({
  children,
  locale,
  dictionary,
}: TranslationsProviderProps) {
  const t = useCallback(
    (key: string) => getNestedValue(dictionary as Record<string, unknown>, key),
    [dictionary],
  );

  const value = useMemo(
    () => ({ locale, dictionary, t }),
    [locale, dictionary, t],
  );

  return (
    <TranslationsContext.Provider value={value}>
      {children}
    </TranslationsContext.Provider>
  );
}

export function useTranslations() {
  const context = useContext(TranslationsContext);
  if (!context) {
    throw new Error("useTranslations must be used within TranslationsProvider");
  }
  return context;
}
