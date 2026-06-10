"use client";

import { motion } from "framer-motion";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function FloatingToolbar() {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="glass-toolbar pointer-events-none fixed top-1/2 right-4 z-[60] hidden -translate-y-1/2 lg:block xl:right-6"
      aria-label="Site preferences"
    >
      <div className="pointer-events-auto flex flex-col items-center gap-1 p-1.5">
        <LanguageSwitcher variant="toolbar" />
        <div className="h-px w-6 bg-border/80" aria-hidden="true" />
        <ThemeToggle variant="toolbar" />
      </div>
    </motion.aside>
  );
}
