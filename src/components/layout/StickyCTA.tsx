"use client";

import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { useTranslations } from "@/providers/TranslationsProvider";

export function StickyCTA() {
  const { t } = useTranslations();
  const [visible, setVisible] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > 500);
  });

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-6 bottom-6 z-50 hidden lg:block"
          >
            <div className="glass-toolbar flex items-center gap-4 rounded-full px-2 py-2 pl-5 shadow-xl">
              <p className="text-sm font-medium text-deep-navy">{t("stickyCta.label")}</p>
              <MagneticButton href="#contact" className="!py-2.5 !text-sm">
                {t("stickyCta.button")}
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 48 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 bottom-0 left-0 z-50 border-t border-border/60 bg-surface/90 p-3 backdrop-blur-xl lg:hidden"
          >
            <MagneticButton href="#contact" className="w-full">
              {t("stickyCta.button")}
              <ArrowRight className="h-4 w-4" />
            </MagneticButton>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
