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

export function contactSubmissionIdentity(parts: {
  recipient: string;
  replyTo: string;
  subject: string;
  html: string;
}): string {
  return JSON.stringify([
    parts.recipient.trim().toLowerCase(),
    parts.replyTo.trim().toLowerCase(),
    parts.subject,
    parts.html,
  ]);
}

/**
 * Ordered idempotency keys for one contact submission.
 *
 * The provider stores each key with the exact message. Identical retries start
 * at the same slot and reuse that message. A different message that finds the
 * slot already taken continues through the remaining slots in the window, so
 * the budget is the number of distinct accepted messages rather than a hash
 * collision. Keys are shared by every instance because the provider stores them.
 */
export function contactDeliveryProbeKeys(
  identity: string,
  nowMs: number = Date.now(),
  slots: number = configuredContactMailSlots(),
): string[] {
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new RangeError("nowMs must be a non-negative finite number");
  }
  if (!Number.isInteger(slots) || slots < 1 || slots > MAX_CONTACT_MAIL_SLOTS) {
    throw new RangeError(`slots must be an integer between 1 and ${MAX_CONTACT_MAIL_SLOTS}`);
  }

  const start = createHash("sha256").update(identity).digest().readUInt32BE(0) % slots;
  const window = Math.floor(nowMs / CONTACT_MAIL_WINDOW_MS);
  return Array.from({ length: slots }, (_, offset) => {
    const slot = (start + offset) % slots;
    return `contact-admin-v3-${window}-${slot}`;
  });
}

export type DeliveryAttempt<T> =
  | { status: "delivered"; value: T }
  | { status: "occupied" }
  | { status: "in-flight" }
  | { status: "error"; errorDetail: string };

export type DeliveryBudgetResult<T> =
  | { status: "delivered"; value: T }
  | { status: "budget" }
  | { status: "error"; errorDetail: string };

/**
 * Walk the submission's slot order. An occupied slot has a different message.
 * An in-flight slot is the same key still being stored, so it is retried rather
 * than skipped: skipping it would send a second copy on the next slot.
 */
export async function deliverWithinBudget<T>(
  keys: readonly string[],
  attempt: (key: string) => Promise<DeliveryAttempt<T>>,
  options?: { inFlightRetries?: number; wait?: (attempt: number) => Promise<void> },
): Promise<DeliveryBudgetResult<T>> {
  const inFlightRetries = options?.inFlightRetries ?? 2;
  const wait = options?.wait ?? (async () => undefined);
  for (const key of keys) {
    let flights = 0;
    while (true) {
      const result = await attempt(key);
      if (result.status === "delivered") return result;
      if (result.status === "occupied") break;
      if (result.status === "in-flight") {
        if (flights >= inFlightRetries) {
          return {
            status: "error",
            errorDetail: "Contact delivery could not be confirmed. Retry the same request.",
          };
        }
        flights += 1;
        await wait(flights);
        continue;
      }
      return result;
    }
  }
  return { status: "budget" };
}

export function isIdempotencyConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as Record<string, unknown>).name;
  return (
    name === "invalid_idempotent_request" ||
    name === "concurrent_idempotent_requests"
  );
}
