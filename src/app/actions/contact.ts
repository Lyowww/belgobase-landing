"use server";

import { Resend } from "resend";
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
    requestType: formData.get("requestType"),
    criteria: formData.get("criteria"),
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
      message: "Please fix the errors below.",
      errors: fieldErrors,
    };
  }

  const contactEmail = process.env.CONTACT_EMAIL;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!contactEmail || !resendApiKey) {
    console.error("Missing CONTACT_EMAIL or RESEND_API_KEY environment variables");
    return {
      success: false,
      message: "Service temporarily unavailable. Please try again later.",
    };
  }

  const data = parsed.data;
  const requestLabel =
    data.requestType === "sample"
      ? "30 Free Sample Leads"
      : "Custom B2B Leads List";

  try {
    const resend = new Resend(resendApiKey);

    await resend.emails.send({
      from: "BelgoBase <onboarding@resend.dev>",
      to: contactEmail,
      replyTo: data.email,
      subject: `[BelgoBase] ${requestLabel} — ${data.company}`,
      html: `
        <h2>New BelgoBase Lead Request</h2>
        <p><strong>Request:</strong> ${requestLabel}</p>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Company:</strong> ${data.company}</p>
        ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ""}
        <p><strong>Target Criteria:</strong></p>
        <p>${data.criteria.replace(/\n/g, "<br>")}</p>
      `,
    });

    return {
      success: true,
      message:
        "Thank you! We'll review your request and get back to you within hours.",
    };
  } catch (error) {
    console.error("Resend error:", error);
    return {
      success: false,
      message: "Something went wrong. Please try again or email us directly.",
    };
  }
}
