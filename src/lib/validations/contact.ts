import { z } from "zod";

export const emailSchema = z
  .string()
  .min(1, "emailRequired")
  .email("emailInvalid");

export const contactFormSchema = z.object({
  name: z.string().min(2, "nameMin"),
  email: emailSchema,
  company: z.string().min(2, "companyRequired"),
  phone: z.string().optional(),
  criteria: z.string().min(10, "criteriaRequired"),
  packageInterest: z.enum(["minimum", "plus", "pro", "unsure"], {
    message: "packageRequired",
  }),
  timeline: z.enum(["asap", "week", "month"], {
    message: "timelineRequired",
  }),
  gdprConfirm: z
    .string()
    .optional()
    .refine((val) => val === "on" || val === "true", {
      message: "gdprRequired",
    }),
  requestType: z.enum(["sample", "custom"]).default("custom"),
  website: z.string().max(0, "Invalid submission"),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
