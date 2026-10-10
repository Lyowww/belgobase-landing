"use client";

import { Menu, Phone, Search, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useThrottledScroll } from "@/hooks/useThrottledScroll";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { useTranslations } from "@/providers/TranslationsProvider";
import { contactPhone, contactPhoneHref } from "@/lib/site";
import { cn } from "@/lib/utils";
import { companyCopy } from "@/lib/public-company/copy";
import type { Locale } from "@/i18n/config";

type HeaderProps = {
  variant?: "default" | "comingSoon" | "lookup";
  onBeforeLanguageChange?: (locale: Locale) => boolean;
};

export function Header({ variant = "default", onBeforeLanguageChange }: HeaderProps) {
  const { t, locale } = useTranslations();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const scrolled = useThrottledScroll(40);
  const isComingSoon = variant === "comingSoon";
  const isLookup = variant === "lookup";

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1536px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const navLinks = [
    { label: companyCopy[locale].navigation, href: "/bedrijf-zoeken" },
    { label: t("nav.process"), href: "#process" },
    { label: t("nav.industries"), href: "#industries" },
    { label: t("nav.results"), href: "#database" },
    { label: t("nav.pricing"), href: "#pricing" },
    { label: "Blog", href: "/blog" },
  ];

  return (
    <header
      className={cn(
        "glass-nav fixed top-0 right-0 left-0 z-[60] pt-safe transition-shadow duration-300",
        mobileOpen && "site-menu-open",
        scrolled || mobileOpen
          ? "opacity-100 shadow-lg shadow-black/5 dark:shadow-black/20"
          : "opacity-100",
      )}
    >


      <div className="mx-auto flex h-14 max-w-[1480px] items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
        <Link
          href={`/${locale}`}
          onClick={(e) => {
            setMobileOpen(false);
            if (window.location.pathname.replace(/\/$/, "") === `/${locale}`) {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          aria-label="BelgoBase"
          className="relative z-10 flex min-w-0 shrink-0 items-center gap-2"
        >
          <Image
            src="/brand/belgobase-bb-logo.png"
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            className="h-7 w-7 shrink-0 rounded-lg shadow-lg shadow-primary/25 sm:h-8 sm:w-8"
          />
          <span className="truncate text-base font-semibold tracking-tight text-deep-navy sm:text-lg">
            BelgoBase
          </span>
        </Link>

      <nav
        aria-label={t("nav.mainNavigation")}
        className={cn(
          "hidden shrink-0 items-center gap-4 2xl:flex 2xl:gap-5",
          (isComingSoon || isLookup) && "2xl:hidden",
        )}
      >
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={`/${locale}${link.href}`}
            className="text-sm font-medium text-foreground/90 transition-colors duration-200 hover:text-foreground"
          >
            {link.label}
          </a>
        ))}
      </nav>

        {!isComingSoon && !isLookup && (
          <div className="relative z-10 hidden items-center gap-3 2xl:flex">
            <a href={`/${locale}/app`} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-deep-navy transition-colors hover:border-primary hover:text-primary">
              {t("nav.signIn")}
            </a>
            <a
              href={contactPhoneHref}
              className="inline-flex items-center justify-center rounded-full border border-border bg-surface-elevated p-2.5 text-deep-navy transition-colors hover:border-primary/30 hover:bg-surface-hover"
              aria-label={`${t("nav.questions")} ${contactPhone}`}
              title={`${t("nav.questions")} ${contactPhone}`}
            >
              <Phone className="h-4 w-4 text-primary" />
            </a>
            <MagneticButton
              href={`/${locale}#contact`}
              className="!min-w-[11rem] !px-8 !py-2.5 !text-sm 2xl:!min-w-[12rem] 2xl:!px-10"
            >
              {t("nav.getFreeLeads")}
            </MagneticButton>
          </div>
        )}

        <div
          className={cn(
            "flex items-center gap-1.5",
            isLookup ? "relative z-10" : "2xl:hidden",
          )}
        >
          {!isComingSoon && !isLookup && <Link href={`/${locale}/bedrijf-zoeken`} className="mr-2 hidden items-center gap-2 text-sm font-semibold text-primary md:inline-flex"><Search className="h-4 w-4" aria-hidden="true" />{companyCopy[locale].navigation}</Link>}
          {isLookup && <Link href={`/${locale}`} className="mr-3 hidden text-sm font-medium text-foreground transition-colors hover:text-primary sm:inline-flex">{companyCopy[locale].about}</Link>}
          <LanguageSwitcher onBeforeLanguageChange={onBeforeLanguageChange} />
          <ThemeToggle />
          {!isComingSoon && !isLookup && (
            <button
              ref={mobileMenuButtonRef}
              type="button"
              className="shrink-0 rounded-xl p-2 transition-colors hover:bg-surface-hover touch-manipulation"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-controls="site-navigation-mobile"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      <div
        inert={!mobileOpen}
        aria-hidden={!mobileOpen}
        className={cn(
          "overflow-hidden border-t border-border bg-surface 2xl:hidden",
          (isComingSoon || isLookup) && "hidden",
          mobileOpen
            ? "h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] sm:h-[calc(100dvh-4rem-env(safe-area-inset-top,0px))] opacity-100"
            : "max-h-0 border-transparent opacity-0",
        )}
      >
        <nav id="site-navigation-mobile" aria-label={t("nav.mainNavigation")} className="flex h-full flex-col gap-1 overflow-y-auto overscroll-contain px-4 py-4 pb-8 sm:px-6">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={`/${locale}${link.href}`}
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/90 transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-3 space-y-3">
            <a href={`/${locale}/app`} onClick={() => setMobileOpen(false)} className="flex items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white">
              {t("nav.signIn")}
            </a>
            <a
              href={`/${locale}#contact`}
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-deep-navy transition-colors hover:bg-surface-hover"
            >
              {t("footer.contact")}
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
