import { createHash } from "node:crypto";

export const CONTACT_MAIL_WINDOW_MS = 10 * 60 * 1000;
export const DEFAULT_CONTACT_MAIL_SLOTS = 10;
export const MAX_CONTACT_MAIL_SLOTS = 100;

export function configuredContactMailSlots(
  configuredValue: string | undefined = process.env.CONTACT_MAIL_SLOTS,
): number {
  const parsed = Number(configuredValue);
  if (
    Number.isInteger(parsed) &&
    parsed >= 1 &&
    parsed <= MAX_CONTACT_MAIL_SLOTS
  ) {
    return parsed;
  }
  return DEFAULT_CONTACT_MAIL_SLOTS;
}

/**
 * Provider-enforced delivery budget for the public contact form.
 *
 * Resend stores idempotency keys across requests and instances. Mapping every
 * request to a bounded set of keys per ten-minute window therefore caps
 * accepted admin notifications without relying on process-local memory. The
 * default is ten; CONTACT_MAIL_SLOTS can tune it between 1 and 100.
 */
export function contactDeliveryKey(
  email: string,
  nowMs: number = Date.now(),
  slots: number = configuredContactMailSlots(),
): string {
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new RangeError("nowMs must be a non-negative finite number");
  }
  if (!Number.isInteger(slots) || slots < 1 || slots > MAX_CONTACT_MAIL_SLOTS) {
    throw new RangeError(`slots must be an integer between 1 and ${MAX_CONTACT_MAIL_SLOTS}`);
  }

  const recipientHash = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest();
  const slot = recipientHash.readUInt32BE(0) % slots;
  const window = Math.floor(nowMs / CONTACT_MAIL_WINDOW_MS);

  return `contact-admin-v2-${window}-${slot}`;
}

export function isIdempotencyConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as Record<string, unknown>).name;
  return (
    name === "invalid_idempotent_request" ||
    name === "concurrent_idempotent_requests"
  );
}
