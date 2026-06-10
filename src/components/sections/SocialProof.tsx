"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";

const metrics = [
  { value: 500, suffix: "+", label: "Belgian businesses served" },
  { value: 2, suffix: "M+", label: "Companies in database" },
  { value: 150000, suffix: "+", label: "Leads delivered" },
  { value: 94, suffix: "%", label: "Client satisfaction" },
];

const logos = [
  "Deloitte Partners",
  "Flanders Tech",
  "Brussels Growth Co.",
  "Antwerp Digital",
  "Wallonia SaaS",
  "Benelux Advisory",
];

const testimonials = [
  {
    quote:
      "BelgoBase cut our prospecting time by 80%. The data quality is exceptional — every lead is actionable from day one.",
    author: "Sophie Vermeulen",
    role: "Head of Sales, Flanders Tech",
    rating: 5,
  },
  {
    quote:
      "Finally, a Belgian lead provider that understands GDPR and delivers real KBO data. Our outbound conversion doubled.",
    author: "Marc Janssens",
    role: "CEO, Brussels Growth Co.",
    rating: 5,
  },
  {
    quote:
      "The lookalike analysis alone was worth it. We found 200 companies matching our best clients in under 24 hours.",
    author: "Elena De Smet",
    role: "Growth Lead, Antwerp Digital",
    rating: 5,
  },
];

export function SocialProof() {
  return (
    <section id="social-proof" className="noise-overlay relative bg-white py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          eyebrow="Social Proof"
          title="Trusted by Belgian B2B teams"
          description="From startups to enterprise sales teams — BelgoBase powers outbound growth across Belgium."
        />

        <div className="mb-20 grid grid-cols-2 gap-6 md:grid-cols-4">
          {metrics.map((metric, i) => (
            <SectionReveal key={metric.label} delay={i * 0.1}>
              <div className="text-center">
                <p className="text-3xl font-semibold tracking-tight text-deep-navy md:text-4xl">
                  <AnimatedCounter value={metric.value} suffix={metric.suffix} />
                </p>
                <p className="mt-2 text-sm text-muted">{metric.label}</p>
              </div>
            </SectionReveal>
          ))}
        </div>

        <SectionReveal>
          <div className="mb-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 opacity-60">
            {logos.map((logo) => (
              <span
                key={logo}
                className="text-sm font-medium tracking-wide text-deep-navy/70 uppercase"
              >
                {logo}
              </span>
            ))}
          </div>
        </SectionReveal>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, i) => (
            <SectionReveal key={testimonial.author} delay={i * 0.15}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.3 }}
                className="gradient-border group h-full rounded-2xl p-6 shadow-sm"
              >
                <Quote className="mb-4 h-8 w-8 text-primary/20" />
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: testimonial.rating }).map((_, j) => (
                    <Star
                      key={j}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="mb-6 text-sm leading-relaxed text-muted">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div>
                  <p className="text-sm font-semibold text-deep-navy">
                    {testimonial.author}
                  </p>
                  <p className="text-xs text-muted">{testimonial.role}</p>
                </div>
              </motion.div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
