import { z } from "zod";

export const emailSchema = z
  .string()
  .min(1, "Please enter your email address")
  .email("Please enter a valid email address");

export const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: emailSchema,
  company: z.string().min(2, "Company name is required"),
  phone: z.string().optional(),
  requestType: z.enum(["sample", "custom"]).default("sample"),
  criteria: z.string().default("Lead request via website form"),
  website: z.string().max(0, "Invalid submission"),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
