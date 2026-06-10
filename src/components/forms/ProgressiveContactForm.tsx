"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { cn } from "@/lib/utils";
import { emailSchema } from "@/lib/validations/contact";

const initialState: ContactFormState = {
  success: false,
  message: "",
};

const expandTransition = {
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1] as const,
};

const fieldVariants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

type ProgressiveContactFormProps = {
  variant?: "hero" | "default";
  id?: string;
};

export function ProgressiveContactForm({
  variant = "default",
  id,
}: ProgressiveContactFormProps) {
  const [state, formAction, isPending] = useActionState(
    submitContactForm,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.success && formRef.current) {
      formRef.current.reset();
      setExpanded(false);
      setEmailValue("");
      setEmailError(null);
    }
  }, [state.success]);

  useEffect(() => {
    if (
      state.errors &&
      (state.errors.name || state.errors.company || state.errors.phone)
    ) {
      setExpanded(true);
    }
  }, [state.errors]);

  useEffect(() => {
    if (expanded && nameRef.current) {
      const timer = setTimeout(() => nameRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [expanded]);

  const handleContinue = () => {
    const result = emailSchema.safeParse(emailValue.trim());
    if (!result.success) {
      setEmailError(result.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setEmailError(null);
    setExpanded(true);
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !expanded) {
      e.preventDefault();
      handleContinue();
    }
  };

  const isHero = variant === "hero";

  if (state.success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:rounded-2xl sm:p-10",
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
          Request received!
        </h3>
        <p className="text-sm text-muted sm:text-base">{state.message}</p>
      </motion.div>
    );
  }

  return (
    <motion.form
      ref={formRef}
      id={id}
      action={formAction}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: isHero ? 0.3 : 0 }}
      className={cn(
        "relative rounded-xl border border-border/60 bg-white p-5 shadow-xl shadow-primary/5 sm:rounded-2xl sm:p-8",
        isHero && "shadow-2xl",
      )}
      aria-label="Lead request form"
    >
      <div className="pointer-events-none absolute -inset-px -z-10 rounded-xl bg-gradient-to-br from-primary/20 via-transparent to-accent/20 opacity-50 blur-sm sm:rounded-2xl" />

      <input type="hidden" name="requestType" value="sample" />
      <input type="hidden" name="criteria" value="Lead request via website form" />

      <div className="mb-4">
        <label
          htmlFor={`${variant}-email`}
          className="mb-1.5 block text-sm font-medium text-deep-navy"
        >
          Email Address *
        </label>
        <input
          id={`${variant}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          value={emailValue}
          onChange={(e) => {
            setEmailValue(e.target.value);
            if (emailError) setEmailError(null);
          }}
          onKeyDown={handleEmailKeyDown}
          aria-invalid={!!(emailError || state.errors?.email)}
          aria-describedby={
            emailError || state.errors?.email ? `${variant}-email-error` : undefined
          }
          className={cn(
            "w-full rounded-lg border bg-white px-3 py-2.5 text-base sm:px-4 sm:text-sm",
            "transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
            emailError || state.errors?.email ? "border-red-300" : "border-border",
          )}
          placeholder="Fill out your email address"
        />
        {(emailError || state.errors?.email) && (
          <p
            id={`${variant}-email-error`}
            className="mt-1 text-xs text-red-500"
            role="alert"
          >
            {emailError ?? state.errors?.email}
          </p>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded-fields"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={expandTransition}
            className="overflow-hidden"
            aria-live="polite"
          >
            <div className="space-y-4 pb-1">
              <motion.div
                custom={0}
                variants={fieldVariants}
                initial="hidden"
                animate="show"
              >
                <label
                  htmlFor={`${variant}-name`}
                  className="mb-1.5 block text-sm font-medium text-deep-navy"
                >
                  Full Name *
                </label>
                <input
                  ref={nameRef}
                  id={`${variant}-name`}
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  className={cn(
                    "w-full rounded-lg border bg-white px-3 py-2.5 text-base sm:px-4 sm:text-sm",
                    "transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                    state.errors?.name ? "border-red-300" : "border-border",
                  )}
                  placeholder="Jan Janssens"
                />
                {state.errors?.name && (
                  <p className="mt-1 text-xs text-red-500" role="alert">
                    {state.errors.name}
                  </p>
                )}
              </motion.div>

              <motion.div
                custom={1}
                variants={fieldVariants}
                initial="hidden"
                animate="show"
              >
                <label
                  htmlFor={`${variant}-company`}
                  className="mb-1.5 block text-sm font-medium text-deep-navy"
                >
                  Company Name *
                </label>
                <input
                  id={`${variant}-company`}
                  name="company"
                  type="text"
                  required
                  autoComplete="organization"
                  className={cn(
                    "w-full rounded-lg border bg-white px-3 py-2.5 text-base sm:px-4 sm:text-sm",
                    "transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                    state.errors?.company ? "border-red-300" : "border-border",
                  )}
                  placeholder="Your Company BVBA"
                />
                {state.errors?.company && (
                  <p className="mt-1 text-xs text-red-500" role="alert">
                    {state.errors.company}
                  </p>
                )}
              </motion.div>

              <motion.div
                custom={2}
                variants={fieldVariants}
                initial="hidden"
                animate="show"
              >
                <label
                  htmlFor={`${variant}-phone`}
                  className="mb-1.5 block text-sm font-medium text-deep-navy"
                >
                  Phone Number
                </label>
                <input
                  id={`${variant}-phone`}
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className={cn(
                    "w-full rounded-lg border bg-white px-3 py-2.5 text-base sm:px-4 sm:text-sm",
                    "transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                    state.errors?.phone ? "border-red-300" : "border-border",
                  )}
                  placeholder="+32 2 123 4567"
                />
                {state.errors?.phone && (
                  <p className="mt-1 text-xs text-red-500" role="alert">
                    {state.errors.phone}
                  </p>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      {!state.success && state.message && (
        <p className="mb-4 text-sm text-red-500" role="alert">
          {state.message}
        </p>
      )}

      <div className="mt-4">
        {!expanded ? (
          <MagneticButton
            type="button"
            onClick={handleContinue}
            className="w-full"
            aria-expanded={false}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </MagneticButton>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <MagneticButton
              type="submit"
              disabled={isPending}
              className="w-full"
              aria-expanded={true}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </MagneticButton>
          </motion.div>
        )}
      </div>
    </motion.form>
  );
}
