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

const packageLabels: Record<string, string> = {
  minimum: "Minimum",
  plus: "Plus",
  pro: "Pro",
  unsure: "Not sure yet",
};

const timelineLabels: Record<string, string> = {
  asap: "ASAP (24h)",
  week: "This week",
  month: "This month",
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
    criteria: formData.get("criteria"),
    packageInterest: formData.get("packageInterest"),
    timeline: formData.get("timeline"),
    gdprConfirm: formData.get("gdprConfirm") ?? undefined,
    requestType: formData.get("requestType") || "custom",
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
      message: "fixErrors",
      errors: fieldErrors,
    };
  }

  const contactEmail = process.env.CONTACT_EMAIL;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!contactEmail || !resendApiKey) {
    console.error("Missing CONTACT_EMAIL or RESEND_API_KEY environment variables");
    return {
      success: false,
      message: "serviceUnavailable",
    };
  }

  const data = parsed.data;
  const packageLabel = packageLabels[data.packageInterest] ?? data.packageInterest;
  const timelineLabel = timelineLabels[data.timeline] ?? data.timeline;

  try {
    const resend = new Resend(resendApiKey);

    await resend.emails.send({
      from: "BelgoBase <onboarding@resend.dev>",
      to: contactEmail,
      replyTo: data.email,
      subject: `[BelgoBase] Custom B2B Leads List — ${data.company}`,
      html: `
        <h2>New BelgoBase Lead Request</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Company:</strong> ${data.company}</p>
        ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ""}
        <p><strong>Package interest:</strong> ${packageLabel}</p>
        <p><strong>Timeline:</strong> ${timelineLabel}</p>
        <p><strong>Target criteria:</strong></p>
        <p>${data.criteria.replace(/\n/g, "<br>")}</p>
        <p><strong>B2B data usage confirmed:</strong> Yes</p>
      `,
    });

    return {
      success: true,
      message: "successMessage",
    };
  } catch (error) {
    console.error("Resend error:", error);
    return {
      success: false,
      message: "errorMessage",
    };
  }
}
