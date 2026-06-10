"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";

const plans = [
  {
    name: "Starter",
    price: "€299",
    period: "per list",
    leads: "Up to 500 companies",
    description: "Perfect for testing outbound in a specific niche or region.",
    features: [
      "500 targeted Belgian companies",
      "Company + contact details",
      "Excel delivery within 24h",
      "Basic filtering (sector, region)",
      "Client exclusion included",
    ],
    popular: false,
  },
  {
    name: "Growth",
    price: "€799",
    period: "per list",
    leads: "Up to 2,000 companies",
    description: "Our most popular plan for scaling outbound sales teams.",
    features: [
      "2,000 targeted Belgian companies",
      "Full enrichment package",
      "Excel delivery within hours",
      "Advanced filtering (NACE, revenue, age)",
      "Client exclusion + deduplication",
      "Priority support",
    ],
    popular: true,
  },
  {
    name: "Scale",
    price: "€1,499",
    period: "per list",
    leads: "Up to 5,000 companies",
    description: "Maximum reach for agencies and high-volume sales teams.",
    features: [
      "5,000 targeted Belgian companies",
      "Premium enrichment + insights",
      "Express delivery (< 4 hours)",
      "All filtering criteria available",
      "Dedicated list review",
      "Lookalike analysis included",
    ],
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="section-alt noise-overlay relative py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          eyebrow="Pricing"
          title="Transparent, pay-per-list pricing"
          description="No contracts. No recurring fees. Get a fixed price upfront before we start — you only pay for what you need."
        />

        <div className="grid gap-8 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <SectionReveal key={plan.name} delay={i * 0.12}>
              <motion.div
                whileHover={{ y: -8 }}
                transition={{ duration: 0.3 }}
                className={`relative h-full rounded-2xl p-8 ${
                  plan.popular
                    ? "border-2 border-primary bg-white shadow-xl shadow-primary/10"
                    : "border border-border/60 bg-white shadow-sm"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-white shadow-lg shadow-primary/30">
                      <Sparkles className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-deep-navy">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted">{plan.leads}</p>
                </div>

                <div className="mb-2 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-deep-navy">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted">{plan.period}</span>
                </div>
                <p className="mb-8 text-sm text-muted">{plan.description}</p>

                <ul className="mb-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-deep-navy"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <MagneticButton
                  href="#contact"
                  variant={plan.popular ? "primary" : "secondary"}
                  className="w-full"
                >
                  Get Started
                </MagneticButton>
              </motion.div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
