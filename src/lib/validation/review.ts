import { z } from "zod";

export const reviewSchema = z.object({
  id: z.string().uuid().optional(),
  packageId: z.string().uuid(),
  authorName: z.string().trim().min(1).max(200),
  country: z.string().trim().max(120).optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1).max(5000),
  isVerified: z.boolean(),
  isPublished: z.boolean(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
