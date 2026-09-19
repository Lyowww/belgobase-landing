"use server";

import { sendDemoRequestEmail } from "@/lib/email/resend";
import {
  adminNotificationSubject,
  buildAdminNotificationHtml,
} from "@/lib/email/templates";
import {
  contactFormSchema,
  type ContactFormData,
} from "@/lib/validations/contact";

export type ContactFormState = {
  success: boolean;
  message: string;
  errors?: Partial<Record<keyof ContactFormData, string>>;
};

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
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
      message: "formErrors",
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

  if (!result.ok) {
    console.error("[contact] Failed to send admin notification:", result.errorDetail);
    return {
      success: false,
      message: "errorMessage",
    };
  }

  return {
    success: true,
    message: "successMessage",
  };
}
