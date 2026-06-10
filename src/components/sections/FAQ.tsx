"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={cn("faq-item", isOpen && "bg-surface-hover/30")}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-1 py-4 text-left sm:items-center sm:gap-4 sm:py-5"
        aria-expanded={isOpen}
      >
        <span className="text-left text-sm font-medium text-deep-navy sm:text-base">
          {question}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            isOpen ? "bg-primary/10 text-primary" : "bg-surface-hover text-muted",
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="px-1 pb-5 text-sm leading-relaxed text-muted">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  const { t } = useTranslations();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    { question: t("faq.q1"), answer: t("faq.a1") },
    { question: t("faq.q2"), answer: t("faq.a2") },
    { question: t("faq.q3"), answer: t("faq.a3") },
    { question: t("faq.q4"), answer: t("faq.a4") },
    { question: t("faq.q5"), answer: t("faq.a5") },
    { question: t("faq.q6"), answer: t("faq.a6") },
    { question: t("faq.q7"), answer: t("faq.a7") },
    { question: t("faq.q8"), answer: t("faq.a8") },
    { question: t("faq.q9"), answer: t("faq.a9") },
  ];

  return (
    <section id="faq" className="noise-overlay relative bg-surface py-16 sm:py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeader eyebrow={t("faq.eyebrow")} title={t("faq.title")} />

        <SectionReveal>
          <div className="premium-card mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-4 text-center sm:mb-10 sm:p-6">
            <p className="text-sm text-muted">{t("faq.ctaText")}</p>
            <div className="mt-4">
              <MagneticButton href="#contact">{t("faq.getFreeLeads")}</MagneticButton>
            </div>
          </div>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <div className="premium-card overflow-hidden px-4 sm:px-6">
            {faqs.map((faq, i) => (
              <FAQItem
                key={faq.question}
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
