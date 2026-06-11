"use client";

import { AnimatePresence, m } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
  isLast,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  return (
    <div className={cn("border-t border-border", isLast && "border-b")}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-6 py-5 text-left sm:py-6"
        aria-expanded={isOpen}
      >
        <span className="text-base font-medium text-deep-navy sm:text-lg">{question}</span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-deep-navy">
          {isOpen ? (
            <Minus className="h-5 w-5" strokeWidth={1.5} />
          ) : (
            <Plus className="h-5 w-5" strokeWidth={1.5} />
          )}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-muted sm:pb-6 sm:text-base">
              {answer}
            </p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  const { t } = useTranslations();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-[2fr_3fr] lg:gap-16 xl:gap-24">
          <SectionReveal className="lg:sticky lg:top-28 lg:self-start">
            <p className="mb-3 text-xs font-medium tracking-[0.15em] text-primary uppercase sm:mb-4 sm:text-sm sm:tracking-[0.2em]">
              {t("faq.eyebrow")}
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-deep-navy sm:text-4xl lg:text-5xl">
              {t("faq.title")}
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:mt-6 sm:text-lg">
              {t("faq.ctaText")}
            </p>
            <div className="mt-6 sm:mt-8">
              <MagneticButton
                href="#contact"
                className="!min-w-[11rem] !px-8 !py-3 !text-sm sm:!min-w-[12rem] sm:!px-10"
              >
                {t("faq.getFreeLeads")}
              </MagneticButton>
            </div>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <div>
              {faqs.map((faq, i) => (
                <FAQItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openIndex === i}
                  onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                  isLast={i === faqs.length - 1}
                />
              ))}
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
