"use client";

import { motion } from "framer-motion";
import { Mail, Users, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";

export function AddOns() {
  const { t } = useTranslations();

  const addOns = [
    {
      icon: Mail,
      title: t("addOns.enrichmentTitle"),
      price: t("addOns.enrichmentPrice"),
      description: t("addOns.enrichmentDesc"),
    },
    {
      icon: Users,
      title: t("addOns.lookalikeTitle"),
      price: t("addOns.lookalikePrice"),
      description: t("addOns.lookalikeDesc"),
    },
    {
      icon: SlidersHorizontal,
      title: t("addOns.segmentationTitle"),
      price: t("addOns.segmentationPrice"),
      description: t("addOns.segmentationDesc"),
    },
    {
      icon: ShieldCheck,
      title: t("addOns.exclusionTitle"),
      price: t("addOns.exclusionPrice"),
      description: t("addOns.exclusionDesc"),
    },
  ];

  return (
    <section id="addons" className="section-alt noise-overlay relative py-16 sm:py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t("addOns.eyebrow")}
          title={t("addOns.title")}
          description={t("addOns.description")}
        />

        <div className="grid items-stretch gap-6 sm:grid-cols-2">
          {addOns.map((addon, i) => (
            <SectionReveal key={addon.title} delay={i * 0.1} className="h-full">
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="addon-card flex h-full flex-col gap-4 rounded-2xl p-5 sm:p-6"
              >
                <motion.div
                  whileHover={{ scale: 1.08, rotate: 3 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 shadow-sm"
                >
                  <addon.icon className="h-6 w-6 text-primary" />
                </motion.div>
                <div className="flex flex-1 flex-col">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold text-deep-navy">{addon.title}</h3>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {addon.price}
                    </span>
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-muted">
                    {addon.description}
                  </p>
                </div>
              </motion.div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
