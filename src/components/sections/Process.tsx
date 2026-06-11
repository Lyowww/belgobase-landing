"use client";

import { motion } from "framer-motion";
import { ClipboardList, Euro, FileSpreadsheet } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";

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
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[20%] left-[10%] h-64 w-64 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute right-[8%] bottom-[15%] h-72 w-72 rounded-full bg-accent/8 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("process.eyebrow")}
          title={t("process.title")}
          description={
            <>
              {t("process.descriptionBefore")}
              <span className="underline decoration-primary underline-offset-4">
                {t("process.descriptionHighlight")}
              </span>
              {t("process.descriptionAfter")}
            </>
          }
        />

        <div className="relative mx-auto mt-12 max-w-4xl sm:mt-16">
          <div
            aria-hidden
            className="absolute top-6 bottom-6 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-primary/35 to-transparent md:block"
          />

          <div className="flex flex-col gap-12 sm:gap-16 md:gap-20">
            {steps.map((step, i) => {
              const cardOnLeft = i % 2 === 0;

              return (
                <SectionReveal
                  key={step.number}
                  delay={i * 0.15}
                  direction={cardOnLeft ? "left" : "right"}
                >
                  <div className="flex flex-col gap-3 md:hidden">
                    <StepLabel number={step.number} align="left" />
                    <ProcessCard step={step} />
                  </div>

                  <div className="hidden items-center md:grid md:grid-cols-[1fr_auto_1fr] md:gap-8 lg:gap-12">
                    <div className="flex min-w-0 justify-end">
                      {cardOnLeft ? (
                        <ProcessCard step={step} />
                      ) : (
                        <StepLabel number={step.number} align="right" />
                      )}
                    </div>

                    <div className="relative flex items-center justify-center">
                      <div className="relative z-10 flex h-4 w-4 items-center justify-center rounded-full border border-primary/40 bg-surface shadow-[0_0_16px_var(--glow-primary)]">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </div>
                    </div>

                    <div className="flex min-w-0 justify-start">
                      {cardOnLeft ? (
                        <StepLabel number={step.number} align="left" />
                      ) : (
                        <ProcessCard step={step} />
                      )}
                    </div>
                  </div>
                </SectionReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

type Step = {
  number: string;
  icon: typeof ClipboardList;
  title: string;
  description: string;
};

function StepLabel({
  number,
  align,
  className,
}: {
  number: string;
  align: "left" | "right";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "items-center",
        align === "left" ? "justify-start" : "justify-end",
        className,
      )}
    >
      <span className="text-sm font-medium tracking-[0.2em] text-primary/50 uppercase sm:text-base">
        Step {number}
      </span>
    </div>
  );
}

function ProcessCard({ step }: { step: Step }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="group relative w-full max-w-md md:max-w-sm lg:max-w-md"
    >
      <div
        aria-hidden
        className="absolute -inset-3 rounded-3xl bg-primary/10 opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-90"
      />

      <div className="glass relative overflow-hidden rounded-2xl border border-border/60 p-5 shadow-lg shadow-primary/5 sm:p-6">
        <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />

        <div className="relative flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 shadow-[0_0_20px_var(--glow-primary)] transition-colors group-hover:bg-primary/15 sm:h-12 sm:w-12">
            <step.icon className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
          </div>
          <h3 className="pt-1 text-lg font-semibold text-deep-navy sm:text-xl">{step.title}</h3>
        </div>

        <p className="relative mt-4 text-sm leading-relaxed text-muted">{step.description}</p>
      </div>
    </motion.div>
  );
}
