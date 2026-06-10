"use client";

import { motion } from "framer-motion";
import { ArrowRight, Shield, MapPin, FileCheck } from "lucide-react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { HeroVisualization } from "@/components/visuals/HeroVisualization";
import { useMousePosition } from "@/hooks/useMousePosition";

const trustIndicators = [
  { icon: Shield, label: "GDPR-safe", sub: "Official company data only" },
  { icon: MapPin, label: "Belgium-only", sub: "2M+ KBO companies" },
  { icon: FileCheck, label: "No contracts", sub: "Pay per list only" },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function Hero() {
  const { x, y } = useMousePosition();

  return (
    <section className="noise-overlay mesh-hero relative overflow-hidden pt-24 pb-16 sm:pt-28 sm:pb-20 md:pt-36 md:pb-28">
      <motion.div
        className="pointer-events-none absolute h-[300px] w-[300px] rounded-full bg-accent/8 blur-[80px] sm:h-[500px] sm:w-[500px] sm:blur-[100px]"
        animate={{ x: x * 0.02 - 150, y: y * 0.02 - 150 }}
        transition={{ type: "spring", stiffness: 50, damping: 30 }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid min-w-0 items-center gap-8 sm:gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="min-w-0"
          >
            <motion.div variants={item}>
              <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-3 py-1.5 text-xs font-medium text-primary shadow-sm backdrop-blur-sm sm:px-4 sm:text-sm">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="truncate">Trusted by 500+ Belgian B2B teams</span>
              </span>
            </motion.div>

            <motion.h1
              variants={item}
              className="mt-6 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-balance text-deep-navy sm:mt-8 sm:text-4xl sm:leading-[1.08] md:text-5xl lg:text-6xl"
            >
              Reach Your Next{" "}
              <span className="text-gradient-accent">100+ Clients</span>
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>
              With Targeted B2B Leads
            </motion.h1>

            <motion.p
              variants={item}
              className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:mt-6 sm:text-lg md:text-xl"
            >
              Struggling to generate consistent leads? Get a custom B2B leads list
              built from 2M+ Belgian companies and start closing more sales faster.
            </motion.p>

            <motion.div
              variants={item}
              className="mt-6 flex w-full flex-col gap-3 sm:mt-8 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-4"
            >
              <MagneticButton href="#contact" className="w-full sm:w-auto">
                Get 30 Free Leads
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
              <MagneticButton href="#contact" variant="secondary" className="w-full sm:w-auto">
                Access Sample Leads
              </MagneticButton>
            </motion.div>

            <motion.div
              variants={item}
              className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-4"
            >
              {trustIndicators.map((indicator) => (
                <div
                  key={indicator.label}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-white/50 p-3 backdrop-blur-sm sm:p-4"
                >
                  <indicator.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-deep-navy">
                      {indicator.label}
                    </p>
                    <p className="text-xs text-muted">{indicator.sub}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: 0 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0 lg:translate-x-0"
          >
            <HeroVisualization />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
