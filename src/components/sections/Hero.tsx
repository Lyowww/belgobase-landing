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
    <section className="noise-overlay mesh-hero relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
      <motion.div
        className="pointer-events-none absolute h-[500px] w-[500px] rounded-full bg-accent/8 blur-[100px]"
        animate={{ x: x * 0.02 - 250, y: y * 0.02 - 250 }}
        transition={{ type: "spring", stiffness: 50, damping: 30 }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div variants={container} initial="hidden" animate="show">
            <motion.div variants={item}>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 py-1.5 text-sm font-medium text-primary shadow-sm backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Trusted by 500+ Belgian B2B teams
              </span>
            </motion.div>

            <motion.h1
              variants={item}
              className="mt-8 text-4xl font-semibold leading-[1.08] tracking-tight text-deep-navy sm:text-5xl lg:text-6xl"
            >
              Reach Your Next{" "}
              <span className="text-gradient-accent">100+ Clients</span>
              <br />
              With Targeted B2B Leads
            </motion.h1>

            <motion.p
              variants={item}
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted md:text-xl"
            >
              Struggling to generate consistent leads? Get a custom B2B leads list
              built from 2M+ Belgian companies and start closing more sales faster.
            </motion.p>

            <motion.div variants={item} className="mt-8 flex flex-wrap gap-4">
              <MagneticButton href="#contact">
                Get 30 Free Leads
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
              <MagneticButton href="#contact" variant="secondary">
                Access Sample Leads
              </MagneticButton>
            </motion.div>

            <motion.div
              variants={item}
              className="mt-12 grid gap-4 sm:grid-cols-3"
            >
              {trustIndicators.map((indicator) => (
                <div
                  key={indicator.label}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-white/50 p-4 backdrop-blur-sm"
                >
                  <indicator.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
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
            initial={{ opacity: 0, scale: 0.95, x: 40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroVisualization />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
