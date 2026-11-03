import { z } from "zod";

export const travelFaqSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(3000),
});

export const travelInfoSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens."),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(1000).optional(),
  body: z.string().trim().min(1).max(10000),
  bullets: z.array(z.string().trim().min(1).max(500)).max(30),
  faqs: z.array(travelFaqSchema).max(30),
  sortOrder: z.number().int().min(0).max(1000),
  isPublished: z.boolean(),
});

export type TravelInfoInput = z.infer<typeof travelInfoSchema>;
