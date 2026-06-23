"use client";

import { AnimatePresence, m } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CustomSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  className?: string;
  disabled?: boolean;
};

export function CustomSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
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

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(-1);
    }
  }, [open]);

  const selectOption = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "Escape") {
      setOpen(false);
      return;
    }

    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      setHighlightedIndex(Math.max(0, options.findIndex((o) => o === value)));
      return;
    }

    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (highlightedIndex >= 0) {
        selectOption(options[highlightedIndex]!);
      }
    }
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "form-input flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-base transition-colors sm:px-4 sm:text-sm",
          "focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15",
          disabled && "cursor-not-allowed opacity-60",
          !value && "text-muted",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <m.ul
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="listbox"
            aria-labelledby={id}
            className="glass-dropdown absolute top-full right-0 left-0 z-50 mt-2 max-h-60 overflow-y-auto rounded-xl p-1 shadow-lg"
          >
            {options.map((option, index) => {
              const isSelected = value === option;
              const isHighlighted = highlightedIndex === index;

              return (
                <li key={option} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectOption(option)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : isHighlighted
                          ? "bg-surface-hover text-foreground"
                          : "text-muted hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    <span className="truncate">{option}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
