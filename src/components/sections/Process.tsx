"use client";

import { motion } from "framer-motion";
import { ClipboardList, Euro, FileSpreadsheet } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";

export function Process() {
  const { t } = useTranslations();

  const steps = [
    {
      number: "01",
      icon: ClipboardList,
      title: t("process.step1Title"),
      description: t("process.step1Description"),
    },
    {
      number: "02",
      icon: Euro,
      title: t("process.step2Title"),
      description: t("process.step2Description"),
    },
    {
      number: "03",
      icon: FileSpreadsheet,
      title: t("process.step3Title"),
      description: t("process.step3Description"),
    },
  ];

  return (
    <section id="process" className="section-alt noise-overlay relative py-16 sm:py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("process.eyebrow")}
          title={t("process.title")}
          description={t("process.description")}
        />

        <div className="relative">
          <div className="absolute top-24 right-0 left-0 hidden h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent md:block" />

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <SectionReveal key={step.number} delay={i * 0.15}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative"
                >
                  {i < steps.length - 1 && (
                    <div className="absolute top-12 -right-4 hidden h-px w-8 bg-primary/20 md:block" />
                  )}

                  <div className="premium-card rounded-2xl p-5 sm:p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                        <step.icon className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-3xl font-light text-primary/20">
                        {step.number}
                      </span>
                    </div>
                    <h3 className="mb-3 text-xl font-semibold text-deep-navy">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
