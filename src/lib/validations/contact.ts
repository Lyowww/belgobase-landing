import { z } from "zod";

export const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  company: z.string().min(2, "Company name is required"),
  phone: z.string().optional(),
  requestType: z.enum(["sample", "custom"], {
    message: "Please select a request type",
  }),
  criteria: z
    .string()
    .min(10, "Please describe your target criteria (min. 10 characters)"),
  website: z.string().max(0, "Invalid submission"),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
