"use client";

import { useTranslations } from "@/providers/TranslationsProvider";

export function Footer() {
  const { t } = useTranslations();

  return (
    <footer className="border-t border-border bg-surface pt-8 pb-sticky-cta sm:pt-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center sm:gap-6 sm:px-6 md:flex-row md:text-left lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary shadow-md shadow-primary/20">
            <span className="text-xs font-bold text-white">B</span>
          </div>
          <span className="text-sm font-semibold text-deep-navy">BelgoBase</span>
        </div>
        <p className="text-sm text-muted">{t("footer.tagline")}</p>
        <p className="text-sm text-muted">
          © {new Date().getFullYear()} BelgoBase. {t("footer.copyright")}
        </p>
      </div>
    </footer>
  );
}
