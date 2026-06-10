"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Process", href: "#process" },
  { label: "Industries", href: "#industries" },
  { label: "Results", href: "#results" },
  { label: "Pricing", href: "#pricing" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();
  const headerBg = useTransform(
    scrollY,
    [0, 80],
    ["rgba(248, 250, 252, 0)", "rgba(248, 250, 252, 0.85)"],
  );
  const headerBorder = useTransform(
    scrollY,
    [0, 80],
    ["rgba(226, 232, 240, 0)", "rgba(226, 232, 240, 1)"],
  );

  return (
    <motion.header
      style={{
        backgroundColor: headerBg,
        borderBottomColor: headerBorder,
      }}
      className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <a href="#" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-white">B</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-deep-navy">
            BelgoBase
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-deep-navy"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <MagneticButton href="#contact" variant="secondary" className="!px-5 !py-2.5">
            Access Sample Leads
          </MagneticButton>
          <MagneticButton href="#contact" className="!px-5 !py-2.5">
            Get 30 Free Leads
          </MagneticButton>
        </div>

        <button
          type="button"
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-border bg-white/95 backdrop-blur-xl transition-all duration-300 md:hidden",
          mobileOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0 border-transparent",
        )}
      >
        <nav className="flex flex-col gap-1 px-6 py-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-light-bg hover:text-deep-navy"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-3 flex flex-col gap-2">
            <MagneticButton href="#contact" variant="secondary" className="w-full">
              Access Sample Leads
            </MagneticButton>
            <MagneticButton href="#contact" className="w-full">
              Get 30 Free Leads
            </MagneticButton>
          </div>
        </nav>
      </div>
    </motion.header>
  );
}
