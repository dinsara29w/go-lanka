import { z } from "zod";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.");

const mediaPath = z
  .string()
  .trim()
  .max(500)
  .regex(/^\/media\/[a-z0-9-]+\/[a-f0-9-]+\.webp$/i, "Upload an image first.");

export const galleryImageSchema = z.object({
  path: mediaPath,
  alt: z.string().trim().min(1, "Alt text is required.").max(200),
});

export const itineraryDaySchema = z.object({
  dayNumber: z.number().int().min(1).max(60),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  destinationId: z.string().uuid().nullable(),
  accommodation: z.string().trim().max(300).optional().default(""),
  meals: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
});

export const adminPackageSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200),
    slug,
    summary: z.string().trim().min(1).max(2000),
    durationDays: z.number().int().min(1).max(60),
    basePriceLkr: z.number().min(0).max(100_000_000),
    dailyRateLkr: z.number().min(0).max(100_000_000),
    tier: z.enum(["economy", "star", "luxury"]),
    activities: z.array(z.string().trim().min(1).max(80)).max(20),
    inclusions: z.array(z.string().trim().min(1).max(300)).max(30),
    exclusions: z.array(z.string().trim().min(1).max(300)).max(30),
    isPublished: z.boolean(),
    featured: z.boolean(),
    heroImage: mediaPath.nullable(),
    heroImageAlt: z.string().trim().max(200).nullable(),
    gallery: z.array(galleryImageSchema).max(12),
    destinationIds: z.array(z.string().uuid()).max(20),
    itinerary: z.array(itineraryDaySchema).max(60),
  })
  .superRefine((value, context) => {
    if (value.heroImage && !value.heroImageAlt) {
      context.addIssue({
        code: "custom",
        path: ["heroImageAlt"],
        message: "Alt text is required for the hero image.",
      });
    }

    const dayNumbers = value.itinerary.map((day) => day.dayNumber);
    if (new Set(dayNumbers).size !== dayNumbers.length) {
      context.addIssue({
        code: "custom",
        path: ["itinerary"],
        message: "Itinerary day numbers must be unique.",
      });
    }

    if (value.itinerary.some((day) => day.dayNumber > value.durationDays)) {
      context.addIssue({
        code: "custom",
        path: ["itinerary"],
        message: "Itinerary days cannot exceed the package duration.",
      });
    }
  });

export const adminDestinationSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(160),
    slug,
    region: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(4000),
    heroImage: mediaPath.nullable(),
    heroImageAlt: z.string().trim().max(200).nullable(),
    mapRegionId: z.string().trim().min(1).max(80),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    bestSeason: z.string().trim().max(200).nullable(),
    highlights: z.array(z.string().trim().min(1).max(200)).max(20),
  })
  .superRefine((value, context) => {
    if (value.heroImage && !value.heroImageAlt) {
      context.addIssue({
        code: "custom",
        path: ["heroImageAlt"],
        message: "Alt text is required for the hero image.",
      });
    }
  });

export type AdminPackageInput = z.infer<typeof adminPackageSchema>;
export type AdminDestinationInput = z.infer<typeof adminDestinationSchema>;
