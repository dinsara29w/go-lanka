import { z } from "zod";

export const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(320),
  phone: z.string().trim().max(50, "Phone number is too long.").optional(),
  message: z
    .string()
    .trim()
    .min(10, "Please add a little more detail.")
    .max(5000, "Message is too long."),
  website: z.string().max(200).optional(),
});

export const contactRequestSchema = contactFormSchema
  .extend({
    turnstileToken: z.string().min(1, "Please complete the verification.").max(2048),
  })
  .strict();

export type ContactFormValues = z.infer<typeof contactFormSchema>;
export type ContactRequest = z.infer<typeof contactRequestSchema>;
