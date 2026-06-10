"use client";

import { motion } from "framer-motion";
import { Zap, Users, RefreshCw, ShieldCheck } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";

const addOns = [
  {
    icon: Users,
    title: "Lookalike Company Analysis",
    price: "€149",
    description:
      "Provide 10–30 best customers. We identify matching companies across 2M+ Belgian businesses with ranked similarity scores.",
  },
  {
    icon: Zap,
    title: "Rush Delivery",
    price: "€99",
    description:
      "Need your list urgently? Priority processing and delivery within 2 hours of confirmation.",
  },
  {
    icon: RefreshCw,
    title: "Contact Enrichment Boost",
    price: "€0.15/company",
    description:
      "Enhanced email and phone discovery for companies with limited public contact data.",
  },
  {
    icon: ShieldCheck,
    title: "Client Exclusion Setup",
    price: "Free",
    description:
      "Share your client enterprise numbers and we'll automatically exclude them from every future list.",
  },
];

export function AddOns() {
  return (
    <section id="addons" className="section-alt noise-overlay relative py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          eyebrow="Add-ons"
          title="Enhance your lead list"
          description="Optional add-ons to maximize the value of every list you order."
        />

        <div className="grid gap-6 sm:grid-cols-2">
          {addOns.map((addon, i) => (
            <SectionReveal key={addon.title} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -4 }}
                className="gradient-border flex h-full gap-5 rounded-2xl p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <addon.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-4">
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
