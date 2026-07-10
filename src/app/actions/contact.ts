"use server";

import { Resend } from "resend";
import {
  contactFormSchema,
  type ContactFormData,
} from "@/lib/validations/contact";

export type ContactFormState = {
  success: boolean;
  message: string;
  /** Raw provider/server error for Network + browser console debugging. */
  errorDetail?: string;
  errors?: Partial<Record<keyof ContactFormData, string>>;
};

function formatErrorDetail(error: unknown): string {
  if (error == null) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") {
      const name = typeof record.name === "string" ? `${record.name}: ` : "";
      return `${name}${record.message}`;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  const contactEmail = process.env.CONTACT_EMAIL?.trim();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  // Must be a verified domain sender in production.
  // onboarding@resend.dev only delivers to the Resend account email.
  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "BelgoBase <onboarding@resend.dev>";

  if (!contactEmail || !resendApiKey) {
    const missing = [
      !resendApiKey ? "RESEND_API_KEY" : null,
      !contactEmail ? "CONTACT_EMAIL" : null,
    ]
      .filter(Boolean)
      .join(", ");
    const errorDetail = `Missing environment variable(s): ${missing}`;
    console.error("[contact]", errorDetail);
    return {
      success: false,
      message: "errorMessage",
      errorDetail,
    };
  }

  const data = parsed.data;
  const name = escapeHtml(data.name);
  const email = escapeHtml(data.email);
  const company = escapeHtml(data.company);
  const phone = data.phone ? escapeHtml(data.phone) : null;

  try {
    const resend = new Resend(resendApiKey);

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: contactEmail,
      replyTo: data.email,
      subject: `[BelgoBase] Demo Request — ${data.company}`,
      html: `
        <h2>New Demo Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company}</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
        <p><strong>Data usage confirmed:</strong> Yes</p>
      `,
    });

    if (error) {
      const errorDetail = formatErrorDetail(error);
      console.error("[contact] Resend API error:", errorDetail, error);
      return {
        success: false,
        message: "errorMessage",
        errorDetail,
      };
    }

    return {
      success: true,
      message: "successMessage",
    };
  } catch (error) {
    const errorDetail = formatErrorDetail(error);
    console.error("[contact] Resend error:", errorDetail, error);
    return {
      success: false,
      message: "errorMessage",
      errorDetail,
    };
  }
}
