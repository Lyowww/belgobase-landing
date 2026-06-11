"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { useTranslations } from "@/providers/TranslationsProvider";
import { cn } from "@/lib/utils";
import { emailSchema } from "@/lib/validations/contact";

const TOTAL_STEPS = 4;

const initialState: ContactFormState = {
  success: false,
  message: "",
};

const stepTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

type FormValues = {
  name: string;
  company: string;
  email: string;
  phone: string;
  criteria: string;
  packageInterest: string;
  timeline: string;
  gdprConfirm: boolean;
};

const emptyValues: FormValues = {
  name: "",
  company: "",
  email: "",
  phone: "",
  criteria: "",
  packageInterest: "",
  timeline: "",
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
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [stepError, setStepError] = useState<string | null>(null);

  const translateError = (key: string) => t(`validation.${key}`);

  useEffect(() => {
    if (state.success) {
      setStep(1);
      setValues(emptyValues);
      setStepError(null);
      formRef.current?.reset();
    }
  }, [state.success]);

  useEffect(() => {
    if (!state.errors) return;
    if (state.errors.name || state.errors.email) setStep(1);
    else if (state.errors.company) setStep(2);
    else if (state.errors.criteria) setStep(3);
    else setStep(4);
  }, [state.errors]);

  const isHero = variant === "hero";

  const update = (field: keyof FormValues, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (stepError) setStepError(null);
  };

  const validateStep = (current: number): boolean => {
    if (current === 1) {
      if (values.name.trim().length < 2) {
        setStepError(translateError("nameMin"));
        return false;
      }
      const emailResult = emailSchema.safeParse(values.email.trim());
      if (!emailResult.success) {
        const key = emailResult.error.issues[0]?.message ?? "emailInvalid";
        setStepError(translateError(key));
        return false;
      }
    }
    if (current === 2) {
      if (values.company.trim().length < 2) {
        setStepError(translateError("companyRequired"));
        return false;
      }
    }
    if (current === 3) {
      if (values.criteria.trim().length < 10) {
        setStepError(translateError("criteriaRequired"));
        return false;
      }
    }
    if (current === 4) {
      if (!values.packageInterest) {
        setStepError(translateError("packageRequired"));
        return false;
      }
      if (!values.timeline) {
        setStepError(translateError("timelineRequired"));
        return false;
      }
      if (!values.gdprConfirm) {
        setStepError(translateError("gdprRequired"));
        return false;
      }
    }
    setStepError(null);
    return true;
  };

  const handleContinue = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!validateStep(4)) {
      e.preventDefault();
    }
  };

  if (state.success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "form-surface rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center sm:rounded-2xl sm:p-10",
          isHero && "shadow-2xl shadow-primary/5",
        )}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500 sm:h-16 sm:w-16" />
        </motion.div>
        <h3 className="mb-2 text-lg font-semibold text-deep-navy sm:text-xl">
          {t("form.successTitle")}
        </h3>
        <p className="text-sm text-muted sm:text-base">
          {translateError(state.message)}
        </p>
      </motion.div>
    );
  }

  const packageOptions = [
    { value: "minimum", label: t("form.packageMinimum") },
    { value: "plus", label: t("form.packagePlus") },
    { value: "pro", label: t("form.packagePro") },
    { value: "unsure", label: t("form.packageUnsure") },
  ];

  const timelineOptions = [
    { value: "asap", label: t("form.timelineAsap") },
    { value: "week", label: t("form.timelineWeek") },
    { value: "month", label: t("form.timelineMonth") },
  ];

  const stepMeta = [
    { title: t("form.step1Title"), subtitle: t("form.step1Subtitle") },
    { title: t("form.step2Title"), subtitle: t("form.step2Subtitle") },
    { title: t("form.step3Title"), subtitle: t("form.step3Subtitle") },
    { title: t("form.step4Title"), subtitle: t("form.step4Subtitle") },
  ];

  const currentMeta = stepMeta[step - 1];

  return (
    <motion.form
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

      <input type="hidden" name="requestType" value="custom" />
      <input type="hidden" name="name" value={values.name} />
      <input type="hidden" name="email" value={values.email} />
      <input type="hidden" name="company" value={values.company} />
      <input type="hidden" name="phone" value={values.phone} />
      <input type="hidden" name="criteria" value={values.criteria} />
      <input type="hidden" name="packageInterest" value={values.packageInterest} />
      <input type="hidden" name="timeline" value={values.timeline} />
      {values.gdprConfirm && <input type="hidden" name="gdprConfirm" value="on" />}

      <div className="mb-6 flex items-center gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <motion.div
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i + 1 <= step ? "bg-primary" : "bg-border",
              )}
              animate={{ scale: i + 1 === step ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 0.3 }}
            />
          </div>
        ))}
      </div>

      <div className="mb-6 min-h-[3.5rem]">
        <AnimatePresence mode="wait">
          <motion.div key={step} {...stepTransition}>
            <h3 className="text-base font-semibold text-deep-navy sm:text-lg">
              {currentMeta.title}
            </h3>
            <p className="mt-1 text-sm text-muted">{currentMeta.subtitle}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="min-h-[140px]">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step-1" {...stepTransition} className="space-y-4">
              <div>
                <label htmlFor={`${variant}-name`} className="mb-1.5 block text-sm font-medium text-deep-navy">
                  {t("form.nameLabel")}
                </label>
                <input
                  id={`${variant}-name`}
                  type="text"
                  autoComplete="name"
                  autoFocus
                  value={values.name}
                  onChange={(e) => update("name", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleContinue())}
                  className={cn(
                    "form-input w-full rounded-xl px-3 py-2.5 text-base sm:px-4 sm:text-sm",
                    (stepError || state.errors?.name) && "border-red-400/60",
                  )}
                  placeholder={t("form.namePlaceholder")}
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
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleContinue())}
                  className={cn(
                    "form-input w-full rounded-xl px-3 py-2.5 text-base sm:px-4 sm:text-sm",
                    (stepError || state.errors?.email) && "border-red-400/60",
                  )}
                  placeholder={t("form.emailPlaceholder")}
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step-2" {...stepTransition} className="space-y-4">
              <div>
                <label htmlFor={`${variant}-company`} className="mb-1.5 block text-sm font-medium text-deep-navy">
                  {t("form.companyLabel")}
                </label>
                <input
                  id={`${variant}-company`}
                  type="text"
                  autoComplete="organization"
                  autoFocus
                  value={values.company}
                  onChange={(e) => update("company", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleContinue())}
                  className={cn(
                    "form-input w-full rounded-xl px-3 py-2.5 text-base sm:px-4 sm:text-sm",
                    (stepError || state.errors?.company) && "border-red-400/60",
                  )}
                  placeholder={t("form.companyPlaceholder")}
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
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleContinue())}
                  className="form-input w-full rounded-xl px-3 py-2.5 text-base sm:px-4 sm:text-sm"
                  placeholder={t("form.phonePlaceholder")}
                />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step-3" {...stepTransition}>
              <label htmlFor={`${variant}-criteria`} className="mb-1.5 block text-sm font-medium text-deep-navy">
                {t("form.criteriaLabel")}
              </label>
              <textarea
                id={`${variant}-criteria`}
                autoFocus
                rows={4}
                value={values.criteria}
                onChange={(e) => update("criteria", e.target.value)}
                className={cn(
                  "form-input w-full resize-none rounded-xl px-3 py-2.5 text-base sm:px-4 sm:text-sm",
                  (stepError || state.errors?.criteria) && "border-red-400/60",
                )}
                placeholder={t("form.criteriaPlaceholder")}
              />
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step-4" {...stepTransition} className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-deep-navy">
                  {t("form.packageLabel")}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {packageOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => update("packageInterest", option.value)}
                      className={cn(
                        "form-radio-option rounded-xl border px-3 py-2.5 text-center text-xs font-medium transition-colors sm:text-sm",
                        values.packageInterest === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-deep-navy hover:border-primary/30",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-deep-navy">
                  {t("form.timelineLabel")}
                </legend>
                <div className="flex flex-col gap-2">
                  {timelineOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => update("timeline", option.value)}
                      className={cn(
                        "form-radio-option rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors sm:text-sm",
                        values.timeline === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-deep-navy hover:border-primary/30",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/30 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                <input
                  type="checkbox"
                  checked={values.gdprConfirm}
                  onChange={(e) => update("gdprConfirm", e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary/30"
                />
                <span className="text-xs leading-relaxed text-muted sm:text-sm">
                  {t("form.gdprLabel")}
                </span>
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {(stepError ||
        state.errors?.name ||
        state.errors?.email ||
        state.errors?.company ||
        state.errors?.criteria ||
        state.errors?.packageInterest ||
        state.errors?.timeline ||
        state.errors?.gdprConfirm) && (
        <p className="mt-3 text-xs text-red-500" role="alert">
          {stepError ??
            (state.errors?.name
              ? translateError(state.errors.name)
              : state.errors?.email
                ? translateError(state.errors.email)
                : state.errors?.company
                  ? translateError(state.errors.company)
                  : state.errors?.criteria
                    ? translateError(state.errors.criteria)
                    : state.errors?.packageInterest
                      ? translateError(state.errors.packageInterest)
                      : state.errors?.timeline
                        ? translateError(state.errors.timeline)
                        : state.errors?.gdprConfirm
                          ? translateError(state.errors.gdprConfirm)
                          : "")}
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
          {translateError(state.message)}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        {step > 1 && (
          <MagneticButton
            type="button"
            variant="secondary"
            onClick={handleBack}
            className="!px-4"
            aria-label={t("form.back")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t("form.back")}</span>
          </MagneticButton>
        )}

        {step < TOTAL_STEPS ? (
          <MagneticButton type="button" onClick={handleContinue} className="flex-1">
            {t("form.continue")}
            <ArrowRight className="h-4 w-4" />
          </MagneticButton>
        ) : (
          <MagneticButton type="submit" disabled={isPending} className="flex-1">
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
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        {step} / {TOTAL_STEPS}
      </p>
    </motion.form>
  );
}
