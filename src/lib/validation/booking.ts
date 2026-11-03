import { z } from "zod";

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid travel date.");

export const bookingFormSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(200),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(320),
  phone: z.string().trim().min(1, "Please enter a phone number.").max(50),
  country: z.string().trim().min(1, "Please enter your country.").max(100),
  travelDate: dateString,
  adults: z.number().int().min(1, "At least one adult is required.").max(30),
  children: z.number().int().min(0).max(20),
  message: z.string().trim().max(5000).optional(),
  website: z.string().max(200).optional(),
});

export const bookingRequestSchema = bookingFormSchema
  .extend({
    packageId: z.string().uuid(),
    turnstileToken: z.string().min(1, "Please complete the verification.").max(2048),
    idempotencyKey: z.string().min(16).max(128),
  })
  .strict();

export type BookingFormValues = z.infer<typeof bookingFormSchema>;
export type BookingRequest = z.infer<typeof bookingRequestSchema>;
