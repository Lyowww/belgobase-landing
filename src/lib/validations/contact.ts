import { z } from "zod";

export const CONTACT_FIELD_LIMITS = {
  name: 100,
  email: 254,
  company: 200,
  phone: 50,
} as const;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "emailRequired")
  .max(CONTACT_FIELD_LIMITS.email, "emailMax")
  .email("emailInvalid");

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "nameMin")
    .max(CONTACT_FIELD_LIMITS.name, "nameMax"),
  email: emailSchema,
  company: z
    .string()
    .trim()
    .min(2, "companyRequired")
    .max(CONTACT_FIELD_LIMITS.company, "companyMax"),
  phone: z.string().trim().max(CONTACT_FIELD_LIMITS.phone, "phoneMax").optional(),
  gdprConfirm: z
    .string()
    .optional()
    .refine((val) => val === "on" || val === "true", {
      message: "gdprRequired",
    }),
  requestType: z.enum(["sample", "custom"]).default("sample"),
  website: z.string().max(0, "Invalid submission"),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
