"use client";

import { m } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";
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
  liteAnimation,
  answerId,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  isLast: boolean;
  liteAnimation: boolean;
  answerId: string;
}) {
  return (
    <div className={cn("border-t border-border", isLast && "border-b")}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 py-5 text-left touch-manipulation sm:items-center sm:gap-6 sm:py-6"
        aria-expanded={isOpen}
        aria-controls={answerId}
      >
        <span className="min-w-0 flex-1 text-base font-medium text-balance text-deep-navy sm:text-lg">
          {question}
        </span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-deep-navy">
          {isOpen ? (
            <Minus className="h-5 w-5" strokeWidth={1.5} />
          ) : (
            <Plus className="h-5 w-5" strokeWidth={1.5} />
          )}
        </span>
      </button>
      {liteAnimation ? (
        <div id={answerId} hidden={!isOpen}>
          <p className="pb-5 text-sm leading-relaxed text-muted sm:pb-6 sm:text-base">
            {answer}
          </p>
        </div>
      ) : (
        <m.div
          id={answerId}
          initial={false}
          animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden={!isOpen}
          className="overflow-hidden"
        >
          <p className="pb-5 text-sm leading-relaxed text-muted sm:pb-6 sm:text-base">
            {answer}
          </p>
        </m.div>
      )}
    </div>
  );
}

export function FAQ() {
  const { t } = useTranslations();
  const { isMobile } = usePerformanceMode();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const primaryFaqs = [5, 3, 7, 8, 11];
  const additionalFaqs = [1, 2, 4, 6, 9, 10, 12, 13];
  const renderFaq = (number: number, index: number, isLast: boolean) => (
    <FAQItem
      key={number}
      question={t(`faq.q${number}`)}
      answer={t(`faq.a${number}`)}
      isOpen={openIndex === index}
      onToggle={() => setOpenIndex(openIndex === index ? null : index)}
      isLast={isLast}
      liteAnimation={isMobile}
      answerId={`faq-answer-${number}`}
    />
  );

  return (
    <section id="faq" className="noise-overlay relative bg-surface py-16 sm:py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-[2fr_3fr] lg:gap-16 xl:gap-24">
          <SectionReveal className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-deep-navy sm:text-4xl lg:text-5xl">
              {t("faq.title")}
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:mt-6 sm:text-lg">
              {t("faq.ctaText")}
            </p>
            <div className="mt-6 sm:mt-8">
              <MagneticButton
                href="#contact"
                className="w-full !min-w-0 !px-8 !py-3 !text-sm sm:w-auto sm:!min-w-[12rem] sm:!px-10"
              >
                {t("faq.getFreeLeads")}
              </MagneticButton>
            </div>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <div>
              {primaryFaqs.map((number, index) => renderFaq(number, index, index === primaryFaqs.length - 1))}
              <details className="mt-6">
                <summary className="cursor-pointer py-3 text-base font-medium text-deep-navy underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">{t("faq.moreQuestions")}</summary>
                <div className="mt-3">
                  {additionalFaqs.map((number, index) => renderFaq(number, primaryFaqs.length + index, index === additionalFaqs.length - 1))}
                </div>
              </details>
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
