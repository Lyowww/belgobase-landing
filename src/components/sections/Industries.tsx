"use client";

import { motion } from "framer-motion";
import { Rocket, Briefcase, Building, X } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";

const industries = [
  {
    icon: Rocket,
    title: "Sales & Growth Teams",
    subtitle: "Sales, marketing, SaaS, startups, enterprise teams",
    benefits: ["Faster outbound", "Better targeting"],
  },
  {
    icon: Briefcase,
    title: "Service & Advisory Firms",
    subtitle: "Agencies, consulting, recruitment, financial services",
    benefits: ["New client acquisition", "Qualified prospects"],
  },
  {
    icon: Building,
    title: "Local & Specialized Professionals",
    subtitle: "Real estate, notaries, regional businesses",
    benefits: ["Local market access", "Structured company data"],
  },
];

const notFit = [
  "You want generic, non-targeted lead lists",
  "You rely only on inbound leads",
  "You're not actively doing outbound sales or outreach",
];

export function Industries() {
  return (
    <section id="industries" className="noise-overlay relative bg-white py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          eyebrow="Industries"
          title="If you sell to Belgian companies, BelgoBase is for you"
          description="Industries we serve and the solutions they receive:"
        />

        <div className="mb-12 grid gap-6 md:grid-cols-3">
          {industries.map((industry, i) => (
            <SectionReveal key={industry.title} delay={i * 0.12}>
              <motion.div
                whileHover={{ y: -6, scale: 1.01 }}
                transition={{ duration: 0.3 }}
                className="gradient-border group h-full rounded-2xl p-8"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 transition-all group-hover:from-primary/20 group-hover:to-accent/20">
                  <industry.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-deep-navy">
                  {industry.title}
                </h3>
                <p className="mb-5 text-sm text-muted">{industry.subtitle}</p>
                <ul className="space-y-2">
                  {industry.benefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-center gap-2 text-sm text-deep-navy"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        ✓
                      </span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </SectionReveal>
          ))}
        </div>

        <SectionReveal>
          <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-orange-50/40 p-8 md:p-10">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <X className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-deep-navy">Not a fit if</h3>
            </div>
            <ul className="grid gap-3 md:grid-cols-3">
              {notFit.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-muted"
                >
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
