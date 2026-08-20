"use client";

import { useTranslations } from "@/providers/TranslationsProvider";

export function ComingSoon() {
  const { t } = useTranslations();

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p>{t("comingSoon.title")}</p>
    </main>
  );
}
