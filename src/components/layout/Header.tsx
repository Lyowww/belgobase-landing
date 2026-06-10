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
      className="fixed top-0 right-0 left-0 z-50 border-b backdrop-blur-xl"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <a href="#" className="flex min-w-0 shrink items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary sm:h-8 sm:w-8">
            <span className="text-xs font-bold text-white sm:text-sm">B</span>
          </div>
          <span className="truncate text-base font-semibold tracking-tight text-deep-navy sm:text-lg">
            BelgoBase
          </span>
        </a>

        <nav className="hidden items-center gap-6 lg:flex lg:gap-8">
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

        <div className="hidden items-center gap-2 lg:flex lg:gap-3">
          <MagneticButton
            href="#contact"
            variant="secondary"
            className="!px-4 !py-2.5 !text-xs xl:!px-5 xl:!text-sm"
          >
            Access Sample Leads
          </MagneticButton>
          <MagneticButton href="#contact" className="!px-4 !py-2.5 !text-xs xl:!px-5 xl:!text-sm">
            Get 30 Free Leads
          </MagneticButton>
        </div>

        <button
          type="button"
          className="shrink-0 rounded-lg p-1.5 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-border bg-white/95 backdrop-blur-xl transition-all duration-300 lg:hidden",
          mobileOpen
            ? "max-h-[24rem] opacity-100"
            : "max-h-0 border-transparent opacity-0",
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-4 sm:px-6">
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
