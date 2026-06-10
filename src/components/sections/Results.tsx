"use client";

import { TrendingUp, Clock, Target, Users } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";

const results = [
  {
    icon: TrendingUp,
    metric: 72,
    suffix: "%",
    label: "Higher engagement vs. generic lists",
    description:
      "Targeted Belgian company data drives significantly better outreach response rates.",
  },
  {
    icon: Clock,
    metric: 80,
    suffix: "%",
    label: "Reduction in prospecting time",
    description:
      "Skip manual LinkedIn and Google searches. Get a CRM-ready list in hours.",
  },
  {
    icon: Target,
    metric: 94,
    suffix: "%",
    label: "Data accuracy rate",
    description:
      "Every list is quality-checked against official KBO records before delivery.",
  },
  {
    icon: Users,
    metric: 3,
    suffix: "x",
    label: "More qualified meetings booked",
    description:
      "Sales teams report 3x more booked meetings with BelgoBase-targeted lists.",
  },
];

export function Results() {
  return (
    <section id="results" className="noise-overlay relative bg-white py-16 sm:py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Results"
          title="Measurable impact for Belgian B2B teams"
          description="Real outcomes from teams using BelgoBase to power their outbound sales."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((result, i) => (
            <SectionReveal key={result.label} delay={i * 0.1}>
              <div className="group h-full rounded-xl border border-border/60 bg-gradient-to-b from-white to-light-bg/50 p-5 transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 sm:rounded-2xl sm:p-8">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                  <result.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-3xl font-semibold tracking-tight text-deep-navy sm:text-4xl">
                  <AnimatedCounter
                    value={result.metric}
                    suffix={result.suffix}
                  />
                </p>
                <p className="mt-2 text-sm font-semibold text-deep-navy">
                  {result.label}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {result.description}
                </p>
              </div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
