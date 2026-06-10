"use client";

import { ProgressiveContactForm } from "@/components/forms/ProgressiveContactForm";
import { SectionReveal } from "@/components/ui/SectionReveal";

export function FinalCTA() {
  return (
    <section
      id="contact"
      className="relative overflow-hidden bg-gradient-to-b from-light-bg via-white to-light-bg py-16 sm:py-24 md:py-32"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-[min(600px,100vw)] w-[min(600px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid min-w-0 items-start gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionReveal direction="left">
            <p className="mb-3 text-xs font-medium tracking-[0.15em] text-primary uppercase sm:mb-4 sm:text-sm sm:tracking-[0.2em]">
              Get Started
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-deep-navy sm:text-3xl md:text-4xl lg:text-5xl">
              Get your custom B2B leads list today and start reaching high-intent
              Belgian companies with up to{" "}
              <span className="font-semibold text-gradient-accent">
                72% higher engagement potential
              </span>{" "}
              than generic prospect lists.
            </h2>
            <p className="mt-4 text-sm text-muted sm:mt-6 sm:text-base">
              It takes just 2 minutes to submit the form and start pitching to the
              right people. You&apos;re one strong leads list away from your next
              wave of clients.
            </p>
            <p className="mt-6 text-lg font-semibold text-gradient-accent sm:mt-8 sm:text-xl">
              Better Leads, Better Connections, More Clients
            </p>
          </SectionReveal>

          <SectionReveal direction="right" delay={0.15}>
            <ProgressiveContactForm variant="default" />
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
