"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
const faqs = [
  {
    question: "How quickly will I receive my lead list?",
    answer:
      "Most lists are delivered within hours of confirmation. Larger or highly specific requests may take longer.",
  },
  {
    question: "Where does the data come from?",
    answer:
      "We use official Belgian company data from the Crossroads Bank for Enterprises (KBO), enriched with publicly available business information where available.",
  },
  {
    question: "Is the data GDPR-compliant?",
    answer:
      "Yes. We provide company data and general business contact information only. No personal data or LinkedIn scraping.",
  },
  {
    question: "Can I choose my own criteria?",
    answer:
      "Yes. Filter by sector, region, legal form, company age, revenue, employee count, NACE codes, and more.",
  },
  {
    question: "Can I exclude existing clients?",
    answer:
      "Yes. Share your client list or enterprise numbers and we'll remove them from your results.",
  },
  {
    question: "What format will I receive?",
    answer:
      "Your list is delivered in Excel and can be imported into most CRM systems.",
  },
  {
    question: "Do you cover all of Belgium?",
    answer:
      "Yes. Our database contains 2M+ Belgian companies from the official KBO.",
  },
  {
    question: "Can I see a sample before ordering?",
    answer:
      "Yes. Request 30 free sample leads to evaluate the data before purchasing.",
  },
];

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
    <div className="border-b border-border/60">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={isOpen}
      >
        <span className="text-base font-medium text-deep-navy">{question}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="shrink-0"
        >
          <ChevronDown className="h-5 w-5 text-muted" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-muted">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="noise-overlay relative bg-white py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-3xl px-6 lg:px-8">
        <SectionHeader eyebrow="FAQ" title="Still have questions?" />

        <SectionReveal>
          <div className="mb-10 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-6 text-center">
            <p className="text-sm text-muted">
              Request 30 free sample leads and see exactly what you&apos;ll receive.
            </p>
            <div className="mt-4">
              <MagneticButton href="#contact">Get 30 Free Leads</MagneticButton>
            </div>
          </div>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <div className="rounded-2xl border border-border/60 bg-white px-6">
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
