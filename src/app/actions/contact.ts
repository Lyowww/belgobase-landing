"use server";

import { redactLogDetail } from "@/lib/email/log-redaction";
import { sendDemoRequestEmail } from "@/lib/email/resend";
import {
  adminNotificationSubject,
  buildAdminNotificationHtml,
} from "@/lib/email/templates";
import {
  contactFormSchema,
  type ContactFormData,
} from "@/lib/validations/contact";
import { contactDeliveryState } from "@/lib/contact-state";
import {
  TURNSTILE_ACTIONS,
  verifyTurnstileToken,
} from "@/lib/security/turnstile";

export type ContactFormState = {
  success: boolean;
  message: string;
  errors?: Partial<Record<keyof ContactFormData, string>>;
  conversionId?: string;
  /** Changes after each attempt so the Turnstile widget remounts with a fresh token. */
  attemptId?: string;
};

function nextAttemptId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const attemptId = nextAttemptId();
  const captcha = await verifyTurnstileToken({
    token: formData.get("cf-turnstile-response"),
    action: TURNSTILE_ACTIONS.contact,
  });
  if (!captcha.ok) {
    return {
      success: false,
      attemptId,
      message:
        captcha.reason === "not_configured" ||
        captcha.reason === "timeout" ||
        captcha.reason === "provider_error"
          ? "serviceUnavailable"
          : "captchaFailed",
    };
  }

  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company"),
    phone: formData.get("phone") || undefined,
    gdprConfirm: formData.get("gdprConfirm") ?? undefined,
    requestType: formData.get("requestType") || "sample",
    website: formData.get("website") ?? "",
  };

  const parsed = contactFormSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ContactFormData, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ContactFormData;
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      success: false,
      attemptId,
      message: "fixErrors",
      errors: fieldErrors,
    };
  }

  const data = parsed.data;
  const fields = {
    name: data.name,
    email: data.email,
    company: data.company,
    phone: data.phone ?? null,
    requestType: data.requestType,
  };

  const result = await sendDemoRequestEmail({
    customerEmail: data.email,
    adminSubject: adminNotificationSubject(data.requestType, data.company),
    adminHtml: buildAdminNotificationHtml(fields),
  });

  if (!result.ok || !result.delivered) {
    console.error(
      "[contact] Failed to send admin notification:",
      result.ok ? "Provider did not confirm delivery" : redactLogDetail(result.errorDetail),
    );
    return { ...contactDeliveryState(false), attemptId };
  }

  return {
    ...contactDeliveryState(true),
    attemptId,
    conversionId: result.deliveryId,
  };
}
