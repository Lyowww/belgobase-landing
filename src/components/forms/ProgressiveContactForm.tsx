"use client";

import { m } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { useTranslations } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";
import { emailSchema } from "@/lib/validations/contact";

const initialState: ContactFormState = {
  success: false,
  message: "",
};

type FormValues = {
  name: string;
  company: string;
  email: string;
  phone: string;
  gdprConfirm: boolean;
};

const emptyValues: FormValues = {
  name: "",
  company: "",
  email: "",
  phone: "",
  gdprConfirm: false,
};

type ProgressiveContactFormProps = {
  variant?: "hero" | "default";
  id?: string;
};

export function ProgressiveContactForm({
  variant = "default",
  id,
}: ProgressiveContactFormProps) {
  const { t } = useTranslations();
  const [state, formAction, isPending] = useActionState(
    submitContactForm,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [formError, setFormError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<keyof FormValues | null>(null);

  const translateError = (key: string) => t(`validation.${key}`);
  const isHero = variant === "hero";

  useEffect(() => {
    if (state.success) {
      setValues(emptyValues);
      setFormError(null);
      setErrorField(null);
      formRef.current?.reset();
    }
  }, [state.success]);

  useEffect(() => {
    if (!state.success && state.errorDetail) {
      console.error("[contact form]", state.errorDetail);
    }
  }, [state.success, state.errorDetail]);

  const update = (field: keyof FormValues, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError(null);
    if (errorField === field) setErrorField(null);
  };

  const validateForm = (): boolean => {
    if (values.name.trim().length < 2) {
      setErrorField("name");
      setFormError(translateError("nameMin"));
      return false;
    }
    if (values.company.trim().length < 2) {
      setErrorField("company");
      setFormError(translateError("companyRequired"));
      return false;
    }
    const emailResult = emailSchema.safeParse(values.email.trim());
    if (!emailResult.success) {
      setErrorField("email");
      const key = emailResult.error.issues[0]?.message ?? "emailInvalid";
      setFormError(translateError(key));
      return false;
    }
    if (!values.gdprConfirm) {
      setErrorField("gdprConfirm");
      setFormError(translateError("gdprRequired"));
      return false;
    }
    setFormError(null);
    setErrorField(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!validateForm()) {
      e.preventDefault();
    }
  };

  if (state.success) {
    return (
      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "form-surface rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center sm:rounded-2xl sm:p-10",
          isHero && "shadow-2xl shadow-primary/5",
        )}
      >
        <m.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500 sm:h-16 sm:w-16" />
        </m.div>
        <h3 className="mb-2 text-lg font-semibold text-deep-navy sm:text-xl">
          {t("form.successTitle")}
        </h3>
        <p className="text-sm text-muted sm:text-base">
          {translateError(state.message)}
        </p>
      </m.div>
    );
  }

  const fieldError =
    formError ??
    (state.errors?.name
      ? translateError(state.errors.name)
      : state.errors?.email
        ? translateError(state.errors.email)
        : state.errors?.company
          ? translateError(state.errors.company)
          : state.errors?.gdprConfirm
            ? translateError(state.errors.gdprConfirm)
            : null);

  return (
    <m.form
      ref={formRef}
      id={id}
      action={formAction}
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: isHero ? 0.3 : 0 }}
      className={cn(
        "form-surface relative overflow-hidden rounded-xl p-5 sm:rounded-2xl sm:p-8",
        isHero && "shadow-2xl",
      )}
      aria-label={t("form.ariaLabel")}
    >
      <div className="pointer-events-none absolute -inset-px -z-10 rounded-xl bg-gradient-to-br from-primary/20 via-transparent to-accent/20 opacity-50 blur-sm sm:rounded-2xl" />

      <input type="hidden" name="requestType" value="sample" />
      <input type="hidden" name="name" value={values.name} />
      <input type="hidden" name="email" value={values.email} />
      <input type="hidden" name="company" value={values.company} />
      <input type="hidden" name="phone" value={values.phone} />
      {values.gdprConfirm && <input type="hidden" name="gdprConfirm" value="on" />}

      <div className="space-y-4">
        <div>
          <label htmlFor={`${variant}-name`} className="mb-1.5 block text-sm font-medium text-deep-navy">
            {t("form.nameLabel")}
          </label>
          <input
            id={`${variant}-name`}
            type="text"
            autoComplete="name"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            className={cn(
              "form-input w-full rounded-xl px-3 py-2.5 text-base sm:px-4 sm:text-sm",
              (errorField === "name" || state.errors?.name) && "border-red-400/60",
            )}
            placeholder={t("form.namePlaceholder")}
          />
        </div>

        <div>
          <label htmlFor={`${variant}-company`} className="mb-1.5 block text-sm font-medium text-deep-navy">
            {t("form.companyLabel")}
          </label>
          <input
            id={`${variant}-company`}
            type="text"
            autoComplete="organization"
            value={values.company}
            onChange={(e) => update("company", e.target.value)}
            className={cn(
              "form-input w-full rounded-xl px-3 py-2.5 text-base sm:px-4 sm:text-sm",
              (errorField === "company" || state.errors?.company) && "border-red-400/60",
            )}
            placeholder={t("form.companyPlaceholder")}
          />
        </div>

        <div>
          <label htmlFor={`${variant}-email`} className="mb-1.5 block text-sm font-medium text-deep-navy">
            {t("form.emailLabel")}
          </label>
          <input
            id={`${variant}-email`}
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            className={cn(
              "form-input w-full rounded-xl px-3 py-2.5 text-base sm:px-4 sm:text-sm",
              (errorField === "email" || state.errors?.email) && "border-red-400/60",
            )}
            placeholder={t("form.emailPlaceholder")}
          />
        </div>

        <div>
          <label htmlFor={`${variant}-phone`} className="mb-1.5 block text-sm font-medium text-deep-navy">
            {t("form.phoneLabel")}
          </label>
          <input
            id={`${variant}-phone`}
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="form-input w-full rounded-xl px-3 py-2.5 text-base sm:px-4 sm:text-sm"
            placeholder={t("form.phonePlaceholder")}
          />
        </div>

        <div
          className={cn(
            "rounded-xl border p-3",
            errorField === "gdprConfirm" || state.errors?.gdprConfirm
              ? "border-red-400/60"
              : "border-border/60",
          )}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={values.gdprConfirm}
              onChange={(e) => update("gdprConfirm", e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary/30"
            />
            <span className="text-sm font-medium text-deep-navy">{t("form.confirmLabel")}</span>
          </label>
          <p className="mt-2 pl-7 text-xs leading-relaxed text-muted sm:text-sm">
            {t("form.dataUsageNote")}
          </p>
        </div>
      </div>

      {fieldError && (
        <p className="mt-3 text-xs text-red-500" role="alert">
          {fieldError}
        </p>
      )}

      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      {!state.success && state.message && !state.errors && (
        <p className="mt-3 text-sm text-red-500" role="alert">
          {state.errorDetail ?? translateError(state.message)}
        </p>
      )}

      <div className="mt-6">
        <MagneticButton type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("form.submitting")}
            </>
          ) : (
            <>
              {t("form.submit")}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </MagneticButton>
      </div>
    </m.form>
  );
}
