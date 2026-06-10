"use client";

import { motion } from "framer-motion";
import { Zap, Users, RefreshCw, ShieldCheck } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { useTranslations } from "@/providers/TranslationsProvider";

export function AddOns() {
  const { t } = useTranslations();

  const addOns = [
    {
      icon: Users,
      title: t("addOns.lookalikeTitle"),
      price: t("addOns.lookalikePrice"),
      description: t("addOns.lookalikeDesc"),
    },
    {
      icon: Zap,
      title: t("addOns.rushTitle"),
      price: t("addOns.rushPrice"),
      description: t("addOns.rushDesc"),
    },
    {
      icon: RefreshCw,
      title: t("addOns.enrichmentTitle"),
      price: t("addOns.enrichmentPrice"),
      description: t("addOns.enrichmentDesc"),
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

        <div className="grid gap-6 sm:grid-cols-2">
          {addOns.map((addon, i) => (
            <SectionReveal key={addon.title} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="gradient-border flex h-full flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:gap-5 sm:p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <addon.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="mb-1 flex flex-wrap items-start justify-between gap-2 sm:gap-4">
                    <h3 className="font-semibold text-deep-navy">{addon.title}</h3>
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      {addon.price}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted">
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
