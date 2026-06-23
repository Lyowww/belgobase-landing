"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import { MagneticButton } from "@/components/ui/MagneticButton";
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
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label
            htmlFor="database-industry"
            className="mb-1.5 block text-sm font-medium text-deep-navy"
          >
            {t("database.formIndustryLabel")}
          </label>
          <select
            id="database-industry"
            value={industry}
            onChange={(e) => onIndustryChange(e.target.value)}
            className={cn(
              "form-input form-select w-full rounded-xl px-3 py-2.5 text-base sm:px-4 sm:text-sm",
              !industry && "text-muted",
            )}
          >
            <option value="" disabled>
              {t("database.formIndustryPlaceholder")}
            </option>
            {INDUSTRY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1">
          <label
            htmlFor="database-email"
            className="mb-1.5 block text-sm font-medium text-deep-navy"
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
            className="form-input w-full rounded-xl px-3 py-2.5 text-base placeholder:text-muted sm:px-4 sm:text-sm"
          />
        </div>
      </div>

      <MagneticButton
        type="submit"
        disabled={submitted || !industry}
        className="w-full"
      >
        <Mail className="h-4 w-4" />
        {submitted ? t("database.formSubmitted") : t("database.formSubmit")}
      </MagneticButton>

      <p className="text-center text-xs text-muted sm:text-sm">{t("database.formNote")}</p>
    </form>
  );
}

export { INDUSTRY_OPTIONS };
