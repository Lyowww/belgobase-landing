"use client";

import { AnimatePresence, m } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  i18n,
  localeFlags,
  localeNames,
  type Locale,
} from "@/i18n/config";
import { useTranslations } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";

function getLocalizedPath(pathname: string, locale: Locale) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && i18n.locales.includes(segments[0] as Locale)) {
    segments[0] = locale;
  } else {
    segments.unshift(locale);
  }
  return `/${segments.join("/")}`;
}

export function LanguageSwitcher({
  className,
  variant = "inline",
}: {
  className?: string;
  variant?: "inline" | "toolbar";
}) {
  const { locale, t } = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "glass-control flex items-center justify-center transition-colors hover:bg-surface-hover",
          variant === "toolbar"
            ? "h-10 w-10 rounded-xl"
            : "h-9 gap-1.5 rounded-xl px-2.5 sm:px-3",
        )}
        aria-label={t("language.select")}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-base leading-none">{localeFlags[locale]}</span>
        {variant === "inline" && (
          <>
            <span className="hidden text-xs font-medium text-foreground sm:inline">
              {locale.toUpperCase()}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "glass-dropdown absolute z-50 min-w-[160px] overflow-hidden rounded-xl p-1",
              variant === "toolbar"
                ? "top-0 right-full mr-2"
                : "top-full right-0 mt-2",
            )}
            role="listbox"
          >
            {i18n.locales.map((loc) => (
              <Link
                key={loc}
                href={getLocalizedPath(pathname, loc)}
                role="option"
                aria-selected={locale === loc}
                onClick={() => {
                  document.cookie = `NEXT_LOCALE=${loc};path=/;max-age=31536000;samesite=lax`;
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  locale === loc
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <span>{localeFlags[loc]}</span>
                <span>{localeNames[loc]}</span>
              </Link>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
