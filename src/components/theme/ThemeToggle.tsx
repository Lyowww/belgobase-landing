"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { DEFAULT_THEME, type Theme } from "@/lib/theme";
import { useTranslations } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";

const options: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
  { value: "light", icon: Sun, labelKey: "theme.light" },
  { value: "dark", icon: Moon, labelKey: "theme.dark" },
  { value: "system", icon: Monitor, labelKey: "theme.system" },
];

export function ThemeToggle({
  className,
  variant = "inline",
}: {
  className?: string;
  variant?: "inline" | "toolbar";
}) {
  const { theme, setTheme, mounted } = useTheme();
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayTheme = mounted ? theme : DEFAULT_THEME;
  const ActiveIcon =
    options.find((o) => o.value === displayTheme)?.icon ?? Monitor;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "glass-control flex items-center justify-center rounded-xl transition-colors hover:bg-surface-hover",
          variant === "toolbar" ? "h-10 w-10" : "h-9 w-9",
        )}
        aria-label={t(`theme.${displayTheme === "system" ? "system" : displayTheme}`)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <ActiveIcon className="h-4 w-4 text-foreground" />
      </button>

      <AnimatePresence>
        {open && mounted && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "glass-dropdown absolute z-50 min-w-[160px] overflow-hidden rounded-xl p-1",
              variant === "toolbar"
                ? "top-0 right-full mr-2"
                : "top-full right-0 mt-2",
            )}
            role="listbox"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={theme === option.value}
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  theme === option.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <option.icon className="h-4 w-4" />
                {t(option.labelKey)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
