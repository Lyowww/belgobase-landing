"use client";

import { ChevronDown, Mail } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";

const INDUSTRY_OPTIONS = [
  "Construction",
  "Bookkeeping & Accounting",
  "Law Firms",
  "Dental Clinics",
  "Retail Stores",
  "Car Repair",
  "Electricity, Gas, Air",
  "Barbershops & Hair Salons",
  "E-commerce Stores",
  "Radio & TV",
  "Pharmaceutical",
  "Waste Management",
  "Tobacco",
  "Gambling",
] as const;

type DatabaseEstimateFormProps = {
  industry: string;
  onIndustryChange: (value: string) => void;
  className?: string;
};

export function DatabaseEstimateForm({
  industry,
  onIndustryChange,
  className,
}: DatabaseEstimateFormProps) {
  const { t } = useTranslations();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !industry) return;
    setSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-5", className)}>
      <div>
        <label
          htmlFor="database-industry"
          className="mb-2 block text-sm font-semibold text-white"
        >
          {t("database.formIndustryLabel")}
        </label>
        <div className="relative">
          <select
            id="database-industry"
            value={industry}
            onChange={(e) => onIndustryChange(e.target.value)}
            className="w-full appearance-none rounded-xl border border-white/10 bg-[#1c1c1c] px-4 py-3.5 pr-10 text-sm text-white outline-none transition-colors focus:border-white/25 focus:ring-2 focus:ring-white/10"
          >
            <option value="" disabled className="text-zinc-400">
              {t("database.formIndustryPlaceholder")}
            </option>
            {INDUSTRY_OPTIONS.map((option) => (
              <option key={option} value={option} className="bg-[#1c1c1c] text-white">
                {option}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="database-email"
          className="mb-2 block text-sm font-semibold text-white"
        >
          {t("database.formEmailLabel")}
        </label>
        <input
          id="database-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("database.formEmailPlaceholder")}
          className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-4 py-3.5 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-white/25 focus:ring-2 focus:ring-white/10"
        />
      </div>

      <button
        type="submit"
        disabled={submitted || !industry}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-[#2a2a2a] px-6 py-3.5 text-sm font-medium text-zinc-300 transition-colors hover:border-white/20 hover:bg-[#333333] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Mail className="h-4 w-4" />
        {submitted ? t("database.formSubmitted") : t("database.formSubmit")}
      </button>

      <p className="text-center text-xs text-zinc-500">{t("database.formNote")}</p>
    </form>
  );
}

export { INDUSTRY_OPTIONS };
