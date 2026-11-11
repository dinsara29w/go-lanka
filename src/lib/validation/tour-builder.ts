import { z } from "zod";

import { BOARD_TYPES, BUDGET_TIERS } from "@/lib/tour-builder";

export type { BoardType, BudgetTier } from "@/lib/tour-builder";

export const tourBuilderRequestSchema = z
  .object({
    locations: z.array(z.string().trim().min(1).max(120)).min(1).max(10),
    budget: z.enum(BUDGET_TIERS),
    board: z.enum(BOARD_TYPES),
    selfDrive: z.boolean(),
    // The vehicle the traveller picked; null lets the team choose.
    vehicleId: z.string().uuid().nullable().optional(),
    days: z.number().int().min(1).max(21),
    nights: z.number().int().min(0).max(21),
    adults: z.number().int().min(1).max(10),
    children: z.number().int().min(0).max(10),
    travelMonth: z.number().int().min(1).max(12),
    notes: z.string().trim().max(800).optional(),
    turnstileToken: z.string().min(1).max(2048),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.nights > value.days) {
      context.addIssue({
        code: "custom",
        path: ["nights"],
        message: "Nights cannot be longer than the tour.",
      });
    }
  });

export const generatedItinerarySchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(1000),
  // Optional: used only when published packages exist; otherwise null.
  selected_package_slug: z.string().trim().max(120).nullable(),
  days: z
    .array(
      z.object({
        day: z.number().int().min(1).max(21),
        title: z.string().trim().min(1).max(200),
        destination_slug: z.string().trim().min(1).max(120),
        activities: z.array(z.string().trim().min(1).max(80)).max(8),
        overnight: z.string().trim().min(1).max(200),
        notes: z.string().trim().max(1000),
        travel_km: z.number().min(0).max(600),
      }),
    )
    .min(1)
    .max(21),
});

export const quoteRequestSchema = z
  .object({
    sessionId: z.string().uuid(),
    reference: z.string().trim().min(6).max(40),
    travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().toLowerCase().email().max(320),
    phone: z.string().trim().min(5).max(50),
    country: z.string().trim().min(1).max(100),
    message: z.string().trim().max(5000).optional(),
    turnstileToken: z.string().min(1).max(2048),
    idempotencyKey: z.string().min(16).max(128),
  })
  .strict();

export type TourBuilderRequest = z.infer<typeof tourBuilderRequestSchema>;
export type GeneratedItinerary = z.infer<typeof generatedItinerarySchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
