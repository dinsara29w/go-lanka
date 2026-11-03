import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .refine((value) => !value || /^https?:\/\//i.test(value), "Enter a full http(s) URL.");

export const siteSettingsSchema = z.object({
  whatsappNumber: z.string().trim().max(50).optional(),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(320)
    .optional()
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "Enter a valid email.",
    ),
  phone: z.string().trim().max(50).optional(),
  facebook: optionalUrl,
  instagram: optionalUrl,
  youtube: optionalUrl,
});

export type SiteSettingsValues = z.infer<typeof siteSettingsSchema>;
