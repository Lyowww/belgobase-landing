import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_CONTACT_MAIL_SLOTS,
  CONTACT_MAIL_WINDOW_MS,
  configuredContactMailSlots,
  contactDeliveryProbeKeys,
  contactSubmissionIdentity,
  deliverWithinBudget,
  isIdempotencyConflict,
} from "../src/lib/email/contact-abuse.ts";
import {
  CONTACT_FIELD_LIMITS,
  contactFormSchema,
} from "../src/lib/validations/contact.ts";
import { resolveAdminEmailCandidate } from "../src/lib/email/admin-recipient.ts";
import { redactLogDetail } from "../src/lib/email/log-redaction.ts";
import { salesContactEmail } from "../src/lib/site.ts";

test("demo requests use the commercial fallback while explicit admin configuration wins", () => {
  const originalAdminEmail = process.env.ADMIN_EMAIL;
  const originalContactEmail = process.env.CONTACT_EMAIL;

  try {
    delete process.env.ADMIN_EMAIL;
    delete process.env.CONTACT_EMAIL;
    assert.equal(
      resolveAdminEmailCandidate(salesContactEmail),
      "david@belgobase.be",
    );

    process.env.CONTACT_EMAIL = "contact-override@example.com";
    assert.equal(
      resolveAdminEmailCandidate(salesContactEmail),
      "contact-override@example.com",
    );

    process.env.ADMIN_EMAIL = "admin-override@example.com";
    assert.equal(
      resolveAdminEmailCandidate(salesContactEmail),
      "admin-override@example.com",
    );
  } finally {
    if (originalAdminEmail === undefined) {
      delete process.env.ADMIN_EMAIL;
    } else {
      process.env.ADMIN_EMAIL = originalAdminEmail;
    }

    if (originalContactEmail === undefined) {
      delete process.env.CONTACT_EMAIL;
    } else {
      process.env.CONTACT_EMAIL = originalContactEmail;
    }
  }
});

test("contact delivery uses every budget slot before rejecting a different request", async () => {
  const now = CONTACT_MAIL_WINDOW_MS * 10 + 1234;
  const identity = (email, company = "Example") => contactSubmissionIdentity({
    recipient: "admin@example.com",
    replyTo: email,
    subject: `Request — ${company}`,
    html: `<p>${email}</p>`,
  });
  const normalized = contactSubmissionIdentity({
    recipient: " Admin@Example.com ",
    replyTo: " PERSON@example.com ",
    subject: "Request",
    html: "<p>same</p>",
  });
  const canonical = contactSubmissionIdentity({
    recipient: "admin@example.com",
    replyTo: "person@example.com",
    subject: "Request",
    html: "<p>same</p>",
  });
  assert.equal(normalized, canonical);
  const first = contactDeliveryProbeKeys(normalized, now, DEFAULT_CONTACT_MAIL_SLOTS);
  assert.equal(first.length, DEFAULT_CONTACT_MAIL_SLOTS);
  assert.equal(new Set(first).size, DEFAULT_CONTACT_MAIL_SLOTS);
  assert.deepEqual(first, contactDeliveryProbeKeys(canonical, now, DEFAULT_CONTACT_MAIL_SLOTS));
  assert.notEqual(first[0], contactDeliveryProbeKeys(canonical, now + CONTACT_MAIL_WINDOW_MS, DEFAULT_CONTACT_MAIL_SLOTS)[0]);
  assert.equal(configuredContactMailSlots("24"), 24);
  assert.equal(configuredContactMailSlots("0"), DEFAULT_CONTACT_MAIL_SLOTS);
  assert.equal(configuredContactMailSlots("not-a-number"), DEFAULT_CONTACT_MAIL_SLOTS);

  const stored = new Map();
  const provider = async (body, key) => {
    const existing = stored.get(key);
    if (existing === undefined) {
      stored.set(key, body);
      return { status: "delivered", value: `id-${stored.size}` };
    }
    return existing === body ? { status: "delivered", value: `replay-${key}` } : { status: "occupied" };
  };

  const firstBody = identity("audit0@example.invalid", "First");
  const secondBody = identity("audit1@example.invalid", "Second");
  assert.notEqual(firstBody, secondBody);
  const sharedOrder = ["contact-admin-v3-window-0", "contact-admin-v3-window-1"];
  const firstDelivery = await deliverWithinBudget(sharedOrder, (key) => provider(firstBody, key), { wait: async () => undefined });
  const secondDelivery = await deliverWithinBudget(sharedOrder, (key) => provider(secondBody, key), { wait: async () => undefined });
  assert.equal(firstDelivery.status, "delivered");
  assert.equal(secondDelivery.status, "delivered");
  assert.notEqual(firstDelivery.value, secondDelivery.value);
  assert.equal(stored.size, 2);

  const replay = await deliverWithinBudget(sharedOrder, (key) => provider(firstBody, key), { wait: async () => undefined });
  assert.equal(replay.status, "delivered");
  assert.equal(stored.size, 2);

  const overflow = await deliverWithinBudget(
    sharedOrder,
    (key) => provider(identity("audit2@example.invalid", "Third"), key),
    { wait: async () => undefined },
  );
  assert.equal(overflow.status, "budget");
  assert.equal(stored.size, 2);

  let waits = 0;
  const inFlight = await deliverWithinBudget(
    ["contact-admin-v3-window-0"],
    async () => ({ status: "in-flight" }),
    { inFlightRetries: 1, wait: async () => { waits += 1; } },
  );
  assert.equal(inFlight.status, "error");
  assert.equal(waits, 1);
  assert.equal(stored.size, 2);
});

test("only Resend idempotency conflicts are treated as delivery conflicts", () => {
  assert.equal(isIdempotencyConflict({ name: "invalid_idempotent_request" }), true);
  assert.equal(isIdempotencyConflict({ name: "concurrent_idempotent_requests" }), true);
  assert.equal(isIdempotencyConflict({ name: "rate_limit_exceeded" }), false);
  assert.equal(isIdempotencyConflict(new Error("network failure")), false);
});

test("contact fields are trimmed and reject oversized input", () => {
  const valid = contactFormSchema.safeParse({
    name: "  Ada Lovelace  ",
    email: " ada@example.com ",
    company: "  Analytical Engines  ",
    phone: " +32 1 23 45 67 ",
    gdprConfirm: "on",
    requestType: "sample",
    website: "",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.name, "Ada Lovelace");
    assert.equal(valid.data.email, "ada@example.com");
    assert.equal(valid.data.company, "Analytical Engines");
    assert.equal(valid.data.phone, "+32 1 23 45 67");
  }

  for (const [field, maximum] of Object.entries(CONTACT_FIELD_LIMITS)) {
    const oversized = {
      name: "Ada Lovelace",
      email: "ada@example.com",
      company: "Analytical Engines",
      phone: "+32 1 23 45 67",
      gdprConfirm: "on",
      requestType: "sample",
      website: "",
      [field]: "x".repeat(maximum + 1),
    };
      assert.equal(contactFormSchema.safeParse(oversized).success, false, field);
  }

  assert.equal(contactFormSchema.safeParse({
    name: "Ada Lovelace",
    email: "ada@example.com",
    company: "Analytical\r\nBcc: spam@example.com",
    phone: "+32 1 23 45 67",
    gdprConfirm: "on",
    requestType: "sample",
    website: "",
  }).success, false);
});

test("public contact responses expose no provider detail or caller-addressed mail", async () => {
  const [action, form, mailer] = await Promise.all([
    readFile(new URL("../src/app/actions/contact.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../src/components/forms/ProgressiveContactForm.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/lib/email/resend.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(action, /errorDetail\s*:/);
  assert.doesNotMatch(form, /state\.errorDetail/);
  assert.doesNotMatch(action, /buildCustomerConfirmationHtml/);
  assert.doesNotMatch(mailer, /sendCustomerConfirmationEmail/);
  assert.match(mailer, /id:\s*data\.id/);
  assert.match(mailer, /deliveryId:\s*outcome\.value\.id/);
  assert.match(action, /conversionId:\s*result\.deliveryId/);
});

test("mail failure logs do not keep addresses or provider keys", () => {
  const detail = redactLogDetail(
    "Resend rejected owner@example.test with key re_live_example_key_value_123456",
  );
  assert.equal(detail.includes("owner@example.test"), false);
  assert.equal(detail.includes("re_live_example_key_value_123456"), false);
  assert.match(detail, /\[redacted-email\]/);
  assert.match(detail, /\[redacted-key\]/);
});
