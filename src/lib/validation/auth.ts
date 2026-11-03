import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(128),
  totp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the six-digit authenticator code.")
    .optional()
    .or(z.literal("")),
});

export const adminSetupSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: z.string().min(12, "Use at least 12 characters.").max(128),
    confirmPassword: z.string().min(12).max(128),
    totp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the six-digit authenticator code."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
});

export const createAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
});

export type AdminLoginValues = z.infer<typeof adminLoginSchema>;
export type AdminSetupValues = z.infer<typeof adminSetupSchema>;
