"use server";

import { sendNotificationEmail } from "@/lib/email/resend";
import {
  contactFormSchema,
  type ContactFormData,
} from "@/lib/validations/contact";

export type ContactFormState = {
  success: boolean;
  message: string;
  /** Sanitized provider/server error for Network + browser console debugging. */
  errorDetail?: string;
  errors?: Partial<Record<keyof ContactFormData, string>>;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function requestSubject(requestType: ContactFormData["requestType"], company: string): string {
  const label = requestType === "custom" ? "Contact Request" : "Demo Request";
  return `[BelgoBase] ${label} — ${company}`;
}

function requestHeading(requestType: ContactFormData["requestType"]): string {
  return requestType === "custom" ? "New Contact Request" : "New Demo Request";
}

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
  const name = escapeHtml(data.name);
  const email = escapeHtml(data.email);
  const company = escapeHtml(data.company);
  const phone = data.phone ? escapeHtml(data.phone) : null;

  const result = await sendNotificationEmail({
    replyTo: data.email,
    subject: requestSubject(data.requestType, data.company),
    html: `
        <h2>${requestHeading(data.requestType)}</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company}</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
        <p><strong>Data usage confirmed:</strong> Yes</p>
      `,
  });

  if (!result.ok) {
    // errorDetail is safe for logs/devtools (no API keys); keep the user message generic.
    console.error("[contact] Failed to send notification:", result.errorDetail);
    return {
      success: false,
      message: "errorMessage",
      errorDetail: result.errorDetail,
    };
  }

  return {
    success: true,
    message: "successMessage",
  };
}
