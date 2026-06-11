"use client";

import { m } from "framer-motion";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AmbientGlow, AnimatedGrid } from "@/components/visuals/AmbientBackground";
import { useTranslations } from "@/providers/TranslationsProvider";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ComingSoon() {
  const { t } = useTranslations();

  return (
    <div className="noise-overlay mesh-hero relative flex min-h-screen flex-col overflow-hidden">
      <AnimatedGrid />
      <AmbientGlow className="left-[15%] top-[20%] h-[350px] w-[350px]" color="accent" />
      <AmbientGlow className="right-[10%] bottom-[15%] h-[300px] w-[300px]" color="primary" />

      <header className="glass-nav relative z-10">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/25 sm:h-8 sm:w-8">
              <span className="text-xs font-bold text-white sm:text-sm">B</span>
            </div>
            <span className="text-base font-semibold tracking-tight text-deep-navy sm:text-lg">
              BelgoBase
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <m.div
          className="mx-auto max-w-2xl"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <m.p
            variants={item}
            className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary"
          >
            {t("comingSoon.badge")}
          </m.p>
          <m.h1
            variants={item}
            className="text-4xl font-bold tracking-tight text-deep-navy sm:text-5xl md:text-6xl"
          >
            {t("comingSoon.title")}
          </m.h1>
          <m.p
            variants={item}
            className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-muted sm:text-xl"
          >
            {t("comingSoon.description")}
          </m.p>
        </m.div>
      </main>

      <footer className="relative z-10 border-t border-border/50 py-6 text-center">
        <p className="text-sm text-muted">
          © {new Date().getFullYear()} BelgoBase. {t("footer.copyright")}
        </p>
      </footer>
    </div>
  );
}
