import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_CONTACT_MAIL_SLOTS,
  CONTACT_MAIL_WINDOW_MS,
  configuredContactMailSlots,
  contactDeliveryKey,
  isIdempotencyConflict,
} from "../src/lib/email/contact-abuse.ts";
import {
  CONTACT_FIELD_LIMITS,
  contactFormSchema,
} from "../src/lib/validations/contact.ts";
import { resolveAdminEmailCandidate } from "../src/lib/email/admin-recipient.ts";
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

test("contact delivery keys impose a provider-enforced fixed-window budget", () => {
  const now = CONTACT_MAIL_WINDOW_MS * 10 + 1234;
  const keys = new Set(
    Array.from({ length: 100 }, (_, index) =>
      contactDeliveryKey(`person-${index}@example.com`, now, DEFAULT_CONTACT_MAIL_SLOTS),
    ),
  );

  assert.ok(keys.size <= DEFAULT_CONTACT_MAIL_SLOTS);
  assert.equal(
    contactDeliveryKey(" PERSON@example.com ", now, DEFAULT_CONTACT_MAIL_SLOTS),
    contactDeliveryKey("person@example.com", now, DEFAULT_CONTACT_MAIL_SLOTS),
  );
  assert.notEqual(
    contactDeliveryKey("person@example.com", now, DEFAULT_CONTACT_MAIL_SLOTS),
    contactDeliveryKey("person@example.com", now + CONTACT_MAIL_WINDOW_MS, DEFAULT_CONTACT_MAIL_SLOTS),
  );
  assert.equal(configuredContactMailSlots("24"), 24);
  assert.equal(configuredContactMailSlots("0"), DEFAULT_CONTACT_MAIL_SLOTS);
  assert.equal(configuredContactMailSlots("not-a-number"), DEFAULT_CONTACT_MAIL_SLOTS);
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
});
