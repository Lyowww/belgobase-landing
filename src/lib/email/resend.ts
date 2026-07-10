import { Resend } from "resend";
import { contactEmail as defaultRecipientEmail } from "@/lib/site";

/** Default verified sender identity — not a mailbox. Never use as `to`. */
export const DEFAULT_FROM_EMAIL = "BelgoBase <noreply@belgobase.be>";

const NON_RECEIVING_LOCAL_PARTS = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
]);

export type SendNotificationEmailInput = {
  subject: string;
  html: string;
  /** Customer's email — used only as Reply-To. */
  replyTo: string;
};

export type SendNotificationEmailResult =
  | { ok: true }
  | { ok: false; errorDetail: string };

function extractAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

function isNonReceivingAddress(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return NON_RECEIVING_LOCAL_PARTS.has(local);
}

/**
 * Inbox for internal notifications.
 * Prefer ADMIN_EMAIL → CONTACT_EMAIL → site contact email.
 * Never allow noreply-style addresses.
 */
export function resolveNotificationRecipient():
  | { ok: true; email: string }
  | { ok: false; errorDetail: string } {
  const candidate =
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    defaultRecipientEmail;

  const address = extractAddress(candidate);

  if (!address.includes("@")) {
    return {
      ok: false,
      errorDetail: "Notification recipient is not a valid email address",
    };
  }

  if (isNonReceivingAddress(address)) {
    return {
      ok: false,
      errorDetail:
        "Notification recipient must be a real mailbox, not a noreply sender identity",
    };
  }

  return { ok: true, email: address };
}

export function resolveFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
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

/**
 * Send an internal notification via Resend.
 * From = verified sender domain · To = admin mailbox · Reply-To = customer.
 */
export async function sendNotificationEmail(
  input: SendNotificationEmailInput,
): Promise<SendNotificationEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    return {
      ok: false,
      errorDetail: "Missing environment variable(s): RESEND_API_KEY",
    };
  }

  const recipient = resolveNotificationRecipient();
  if (!recipient.ok) {
    return recipient;
  }

  const from = resolveFromEmail();
  const fromAddress = extractAddress(from);

  if (fromAddress === recipient.email) {
    return {
      ok: false,
      errorDetail:
        "Notification recipient must differ from the From address (noreply is send-only)",
    };
  }

  try {
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: recipient.email,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
    });

    if (error) {
      const errorDetail = formatEmailError(error);
      console.error("[email] Resend API error:", errorDetail);
      return { ok: false, errorDetail };
    }

    if (!data?.id) {
      const errorDetail = "Resend returned success without a message id";
      console.error("[email]", errorDetail);
      return { ok: false, errorDetail };
    }

    return { ok: true };
  } catch (error) {
    const errorDetail = formatEmailError(error);
    console.error("[email] Resend request failed:", errorDetail);
    return { ok: false, errorDetail };
  }
}
