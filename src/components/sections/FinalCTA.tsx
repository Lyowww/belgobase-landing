"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { cn } from "@/lib/utils";

const initialState: ContactFormState = {
  success: false,
  message: "",
};

export function FinalCTA() {
  const [state, formAction, isPending] = useActionState(
    submitContactForm,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && formRef.current) {
      formRef.current.reset();
    }
  }, [state.success]);

  return (
    <section
      id="contact"
      className="relative overflow-hidden bg-gradient-to-b from-light-bg via-white to-light-bg py-16 sm:py-24 md:py-32"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-[min(600px,100vw)] w-[min(600px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid min-w-0 items-start gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionReveal direction="left">
            <p className="mb-3 text-xs font-medium tracking-[0.15em] text-primary uppercase sm:mb-4 sm:text-sm sm:tracking-[0.2em]">
              Get Started
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-deep-navy sm:text-3xl md:text-4xl lg:text-5xl">
              Get your custom B2B leads list today
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted sm:mt-6 sm:text-lg">
              Start reaching high-intent Belgian companies with up to{" "}
              <span className="font-semibold text-deep-navy">
                72% higher engagement potential
              </span>{" "}
              than generic prospect lists.
            </p>
            <p className="mt-3 text-sm text-muted sm:mt-4 sm:text-base">
              It takes just 2 minutes to submit the form and start pitching to the
              right people. You&apos;re one strong leads list away from your next
              wave of clients.
            </p>
            <p className="mt-6 text-lg font-semibold text-gradient-accent sm:mt-8 sm:text-xl">
              More Leads, More Connections, More Clients
            </p>
          </SectionReveal>

          <SectionReveal direction="right" delay={0.15}>
            <AnimatePresence mode="wait">
              {state.success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:rounded-2xl sm:p-10"
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
              ) : (
                <motion.form
                  key="form"
                  ref={formRef}
                  action={formAction}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative rounded-xl border border-border/60 bg-white p-5 shadow-xl shadow-primary/5 sm:rounded-2xl sm:p-8"
                >
                  <div className="pointer-events-none absolute -inset-px -z-10 rounded-xl bg-gradient-to-br from-primary/20 via-transparent to-accent/20 opacity-50 blur-sm sm:rounded-2xl" />

                  <div className="mb-4 grid gap-4 sm:mb-6 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label
                        htmlFor="name"
                        className="mb-1.5 block text-sm font-medium text-deep-navy"
                      >
                        Full Name *
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        className={cn(
                          "w-full rounded-lg border bg-white px-3 py-2.5 text-base sm:px-4 sm:text-sm",
                          "transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                          state.errors?.name ? "border-red-300" : "border-border",
                        )}
                        placeholder="Jan Janssens"
                      />
                      {state.errors?.name && (
                        <p className="mt-1 text-xs text-red-500">{state.errors.name}</p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <label
                        htmlFor="email"
                        className="mb-1.5 block text-sm font-medium text-deep-navy"
                      >
                        Work Email *
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        className={cn(
                          "w-full rounded-lg border bg-white px-3 py-2.5 text-base sm:px-4 sm:text-sm",
                          "transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                          state.errors?.email ? "border-red-300" : "border-border",
                        )}
                        placeholder="jan@company.be"
                      />
                      {state.errors?.email && (
                        <p className="mt-1 text-xs text-red-500">{state.errors.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="mb-4 grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label
                        htmlFor="company"
                        className="mb-1.5 block text-sm font-medium text-deep-navy"
                      >
                        Company *
                      </label>
                      <input
                        id="company"
                        name="company"
                        type="text"
                        required
                        className={cn(
                          "w-full rounded-lg border bg-white px-3 py-2.5 text-base sm:px-4 sm:text-sm",
                          "transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                          state.errors?.company ? "border-red-300" : "border-border",
                        )}
                        placeholder="Your Company BVBA"
                      />
                      {state.errors?.company && (
                        <p className="mt-1 text-xs text-red-500">
                          {state.errors.company}
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <label
                        htmlFor="phone"
                        className="mb-1.5 block text-sm font-medium text-deep-navy"
                      >
                        Phone
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:text-sm"
                        placeholder="+32 2 123 4567"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <fieldset>
                      <legend className="mb-2 block text-sm font-medium text-deep-navy">
                        Request Type *
                      </legend>
                      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="requestType"
                            value="sample"
                            defaultChecked
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="text-sm text-deep-navy">
                            Get My Free Sample List
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="requestType"
                            value="custom"
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="text-sm text-deep-navy">
                            Find My Next Clients
                          </span>
                        </label>
                      </div>
                    </fieldset>
                    {state.errors?.requestType && (
                      <p className="mt-1 text-xs text-red-500">
                        {state.errors.requestType}
                      </p>
                    )}
                  </div>

                  <div className="mb-5 sm:mb-6">
                    <label
                      htmlFor="criteria"
                      className="mb-1.5 block text-sm font-medium text-deep-navy"
                    >
                      Target Criteria *
                    </label>
                    <textarea
                      id="criteria"
                      name="criteria"
                      rows={4}
                      required
                      className={cn(
                        "w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-base sm:px-4 sm:text-sm",
                        "transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                        state.errors?.criteria ? "border-red-300" : "border-border",
                      )}
                      placeholder="e.g. IT services companies in Flanders, BVBA, 5-50 employees..."
                    />
                    {state.errors?.criteria && (
                      <p className="mt-1 text-xs text-red-500">
                        {state.errors.criteria}
                      </p>
                    )}
                  </div>

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

                  <MagneticButton
                    type="submit"
                    disabled={isPending}
                    className="w-full"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Get My Free Sample List
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </MagneticButton>
                </motion.form>
              )}
            </AnimatePresence>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
