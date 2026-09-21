import { Resend } from "resend";
import { salesContactEmail as defaultRecipientEmail } from "@/lib/site";
import { emailSchema } from "@/lib/validations/contact";
import {
  contactDeliveryKey,
  isIdempotencyConflict,
} from "@/lib/email/contact-abuse";
import { resolveAdminEmailCandidate } from "@/lib/email/admin-recipient";

/** Default verified sender identity — not a mailbox. Never use as `to`. */
export const DEFAULT_FROM_EMAIL = "BelgoBase <noreply@belgobase.be>";

const NON_RECEIVING_LOCAL_PARTS = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
]);

export type SendEmailResult =
  | { ok: true; delivered: boolean }
  | { ok: false; errorDetail: string };

/** @deprecated Prefer SendEmailResult */
export type SendNotificationEmailResult = SendEmailResult;

export type SendAdminNotificationInput = {
  subject: string;
  html: string;
  /** Customer's email — used as Reply-To so admin can reply directly. */
  replyTo: string;
};

function extractAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

function isNonReceivingAddress(email: string): string | null {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (NON_RECEIVING_LOCAL_PARTS.has(local)) {
    return "Address must be a real mailbox, not a noreply sender identity";
  }
  return null;
}

/**
 * Validate an email for use as a recipient.
 * Rejects empty, invalid, and noreply-style addresses.
 */
export function validateRecipientEmail(
  email: string,
): { ok: true; email: string } | { ok: false; errorDetail: string } {
  const parsed = emailSchema.safeParse(email.trim());
  if (!parsed.success) {
    return {
      ok: false,
      errorDetail: "Customer email is not a valid email address",
    };
  }

  const address = extractAddress(parsed.data);
  const noreplyError = isNonReceivingAddress(address);
  if (noreplyError) {
    return { ok: false, errorDetail: noreplyError };
  }

  return { ok: true, email: address };
}

/**
 * Inbox for internal notifications / company contact (Reply-To on customer mail).
 * Prefer ADMIN_EMAIL → CONTACT_EMAIL → site contact email.
 * Never allow noreply-style addresses.
 */
export function resolveAdminEmail():
  | { ok: true; email: string }
  | { ok: false; errorDetail: string } {
  const candidate = resolveAdminEmailCandidate(defaultRecipientEmail);

  const address = extractAddress(candidate);

  if (!address.includes("@")) {
    return {
      ok: false,
      errorDetail: "Admin email is not a valid email address",
    };
  }

  const noreplyError = isNonReceivingAddress(address);
  if (noreplyError) {
    return {
      ok: false,
      errorDetail:
        "Admin email must be a real mailbox, not a noreply sender identity",
    };
  }

  return { ok: true, email: address };
}

/** @deprecated Use resolveAdminEmail */
export function resolveNotificationRecipient() {
  return resolveAdminEmail();
}

/**
 * Verified From identity.
 * Prefer FROM_EMAIL → RESEND_FROM_EMAIL → default.
 * Bare addresses are wrapped as `BelgoBase <address>`.
 */
export function resolveFromEmail(): string {
  const raw =
    process.env.FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    DEFAULT_FROM_EMAIL;

  if (!raw.includes("<") && raw.includes("@")) {
    return `BelgoBase <${raw}>`;
  }

  return raw;
}

export function formatEmailError(error: unknown): string {
  if (error == null) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message =
      typeof record.message === "string" ? record.message : null;
    const name = typeof record.name === "string" ? record.name : null;
    const statusCode =
      typeof record.statusCode === "number" ? record.statusCode : null;

    if (message) {
      const parts = [
        name,
        statusCode != null ? `status ${statusCode}` : null,
        message,
      ].filter(Boolean);
      return parts.join(" — ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function getResendClient():
  | { ok: true; client: Resend }
  | { ok: false; errorDetail: string } {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    return {
      ok: false,
      errorDetail: "Missing environment variable(s): RESEND_API_KEY",
    };
  }
  return { ok: true, client: new Resend(resendApiKey) };
}

async function sendViaResend(input: {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}): Promise<SendEmailResult> {
  const clientResult = getResendClient();
  if (!clientResult.ok) return clientResult;

  try {
    const { data, error } = await clientResult.client.emails.send(
      {
        from: input.from,
        to: input.to,
        replyTo: input.replyTo,
        subject: input.subject,
        html: input.html,
      },
      { idempotencyKey: input.idempotencyKey },
    );

    if (error) {
      if (isIdempotencyConflict(error)) {
        const errorDetail = "Contact delivery budget reached for the current window";
        console.warn("[email]", errorDetail);
        return { ok: false, errorDetail };
      }
      const errorDetail = formatEmailError(error);
      console.error("[email] Resend API error:", errorDetail);
      return { ok: false, errorDetail };
    }

    if (!data?.id) {
      const errorDetail = "Resend returned success without a message id";
      console.error("[email]", errorDetail);
      return { ok: false, errorDetail };
    }

    return { ok: true, delivered: true };
  } catch (error) {
    if (isIdempotencyConflict(error)) {
      const errorDetail = "Contact delivery budget reached for the current window";
      console.warn("[email]", errorDetail);
      return { ok: false, errorDetail };
    }
    const errorDetail = formatEmailError(error);
    console.error("[email] Resend request failed:", errorDetail);
    return { ok: false, errorDetail };
  }
}

/**
 * Internal notification via Resend.
 * From = verified sender · To = ADMIN_EMAIL · Reply-To = customer.
 */
export async function sendAdminNotificationEmail(
  input: SendAdminNotificationInput,
): Promise<SendEmailResult> {
  const customer = validateRecipientEmail(input.replyTo);
  if (!customer.ok) {
    return {
      ok: false,
      errorDetail: `Invalid customer Reply-To: ${customer.errorDetail}`,
    };
  }

  const admin = resolveAdminEmail();
  if (!admin.ok) return admin;

  const from = resolveFromEmail();
  const fromAddress = extractAddress(from);

  if (fromAddress === admin.email) {
    return {
      ok: false,
      errorDetail:
        "Admin email must differ from the From address (noreply is send-only)",
    };
  }

  return sendViaResend({
    from,
    to: admin.email,
    replyTo: customer.email,
    subject: input.subject,
    html: input.html,
    idempotencyKey: contactDeliveryKey(customer.email),
  });
}

/**
 * Send one internal notification. The public form never sends mail to the
 * caller-controlled address, so it cannot be used as a third-party mail relay.
 */
export async function sendDemoRequestEmail(input: {
  customerEmail: string;
  adminSubject: string;
  adminHtml: string;
}): Promise<SendEmailResult> {
  return sendAdminNotificationEmail({
    replyTo: input.customerEmail,
    subject: input.adminSubject,
    html: input.adminHtml,
  });
}

/** @deprecated Use sendAdminNotificationEmail */
export async function sendNotificationEmail(
  input: SendAdminNotificationInput,
): Promise<SendEmailResult> {
  return sendAdminNotificationEmail(input);
}
