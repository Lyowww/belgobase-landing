"use client";

import { Menu, Phone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useThrottledScroll } from "@/hooks/useThrottledScroll";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { useTranslations } from "@/providers/TranslationsProvider";
import { contactPhone, contactPhoneHref } from "@/lib/site";
import { cn } from "@/lib/utils";

type HeaderProps = {
  variant?: "default" | "comingSoon";
};

export function Header({ variant = "default" }: HeaderProps) {
  const { t } = useTranslations();
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrolled = useThrottledScroll(40);
  const isComingSoon = variant === "comingSoon";

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const navLinks = [
    { label: t("nav.process"), href: "#process" },
    { label: t("nav.industries"), href: "#industries" },
    { label: t("nav.results"), href: "#database" },
    { label: t("nav.pricing"), href: "#pricing" },
  ];

  return (
    <header
      className={cn(
        "glass-nav relative fixed top-0 right-0 left-0 z-50 pt-safe transition-[opacity,box-shadow] duration-500",
        scrolled
          ? "opacity-100 shadow-lg shadow-black/5 dark:shadow-black/20"
          : "opacity-[0.88]",
      )}
    >
      <nav
        aria-label="Main"
        className={cn(
          "pointer-events-none absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-6 lg:flex lg:gap-8",
          isComingSoon && "lg:hidden",
        )}
      >
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="pointer-events-auto text-sm font-medium text-foreground/90 transition-colors duration-200 hover:text-foreground"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="relative z-10 flex min-w-0 shrink items-center gap-2"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/25 sm:h-8 sm:w-8">
            <span className="text-xs font-bold text-white sm:text-sm">B</span>
          </div>
          <span className="truncate text-base font-semibold tracking-tight text-deep-navy sm:text-lg">
            BelgoLeads
          </span>
        </a>

        {!isComingSoon && (
          <div className="relative z-10 hidden items-center gap-3 lg:flex">
            <a
              href={contactPhoneHref}
              className="inline-flex items-center justify-center rounded-full border border-border bg-surface-elevated p-2.5 text-deep-navy transition-colors hover:border-primary/30 hover:bg-surface-hover"
              aria-label={`${t("nav.questions")} ${contactPhone}`}
              title={`${t("nav.questions")} ${contactPhone}`}
            >
              <Phone className="h-4 w-4 text-primary" />
            </a>
            <MagneticButton
              href="#contact"
              className="!min-w-[11rem] !px-8 !py-2.5 !text-sm xl:!min-w-[12rem] xl:!px-10"
            >
              {t("nav.getFreeLeads")}
            </MagneticButton>
          </div>
        )}

        <div
          className={cn(
            "flex items-center gap-1.5",
            isComingSoon ? "relative z-10 lg:hidden" : "lg:hidden",
          )}
        >
          <LanguageSwitcher />
          <ThemeToggle />
          {!isComingSoon && (
            <button
              type="button"
              className="shrink-0 rounded-xl p-2 transition-colors hover:bg-surface-hover touch-manipulation"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-border bg-surface/98 mobile-backdrop-none backdrop-blur-xl transition-[max-height,opacity] duration-300 lg:hidden",
          isComingSoon && "hidden",
          mobileOpen
            ? "max-h-[28rem] opacity-100"
            : "max-h-0 border-transparent opacity-0",
        )}
      >
        <nav className="flex max-h-[min(28rem,calc(100dvh-4rem))] flex-col gap-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/90 transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-3 space-y-3">
            <a
              href={contactPhoneHref}
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-3 text-sm font-medium text-deep-navy transition-colors hover:bg-surface-hover"
            >
              <Phone className="h-4 w-4 text-primary" />
              {t("nav.questions")}
            </a>
            <MagneticButton href="#contact" className="w-full">
              {t("nav.getFreeLeads")}
            </MagneticButton>
          </div>
        </nav>
      </div>
    </header>
  );
}
