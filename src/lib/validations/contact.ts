import { z } from "zod";

export const CONTACT_FIELD_LIMITS = {
  name: 100,
  email: 254,
  company: 200,
  phone: 50,
} as const;

function hasNoControlCharacters(value: string): boolean {
  return !/[\u0000-\u001f\u007f\u2028\u2029]/.test(value);
}

const readableText = (schema: z.ZodString, message: string) =>
  schema.refine(hasNoControlCharacters, { message });

export const emailSchema = readableText(
  z
    .string()
    .trim()
    .min(1, "emailRequired")
    .max(CONTACT_FIELD_LIMITS.email, "emailMax")
    .email("emailInvalid"),
  "emailInvalid",
);

export const contactFormSchema = z.object({
  name: readableText(
    z
      .string()
      .trim()
      .min(2, "nameMin")
      .max(CONTACT_FIELD_LIMITS.name, "nameMax"),
    "nameInvalid",
  ),
  email: emailSchema,
  company: readableText(
    z
      .string()
      .trim()
      .min(2, "companyRequired")
      .max(CONTACT_FIELD_LIMITS.company, "companyMax"),
    "companyInvalid",
  ),
  phone: readableText(
    z.string().trim().max(CONTACT_FIELD_LIMITS.phone, "phoneMax"),
    "phoneInvalid",
  ).optional(),
  gdprConfirm: z
    .string()
    .optional()
    .refine((val) => val === "on" || val === "true", {
      message: "gdprRequired",
    }),
  requestType: z.enum(["sample", "custom"]).default("sample"),
  // Honeypot: never surface a distinctive message to clients.
  website: z.string().max(0, "formErrors"),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
