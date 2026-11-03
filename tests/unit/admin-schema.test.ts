import { describe, expect, it } from "vitest";

import { adminDestinationSchema, adminPackageSchema } from "@/lib/validation/admin";
import { siteSettingsSchema } from "@/lib/validation/settings";

const validPackage = {
  title: "Test package",
  slug: "test-package",
  summary: "A valid test package summary.",
  durationDays: 5,
  basePriceLkr: 125000,
  dailyRateLkr: 25000,
  tier: "star",
  activities: ["Culture"],
  inclusions: ["Accommodation"],
  exclusions: ["Flights"],
  isPublished: true,
  featured: false,
  heroImage: null,
  heroImageAlt: null,
  gallery: [],
  destinationIds: [],
  itinerary: [
    {
      dayNumber: 1,
      title: "Arrival",
      description: "Arrive and transfer.",
      destinationId: null,
      accommodation: "Hotel",
      meals: ["Breakfast"],
    },
  ],
};

describe("admin package validation", () => {
  it("accepts a valid package", () => {
    expect(adminPackageSchema.safeParse(validPackage).success).toBe(true);
  });

  it("requires alt text when a hero image is present", () => {
    const result = adminPackageSchema.safeParse({
      ...validPackage,
      heroImage: "/media/packages/123e4567-e89b-12d3-a456-426614174000.webp",
    });
    expect(result.success).toBe(false);
  });

  it("rejects itinerary days beyond the package duration", () => {
    const result = adminPackageSchema.safeParse({
      ...validPackage,
      durationDays: 2,
      itinerary: [{ ...validPackage.itinerary[0], dayNumber: 3 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate day numbers", () => {
    const result = adminPackageSchema.safeParse({
      ...validPackage,
      itinerary: [validPackage.itinerary[0], validPackage.itinerary[0]],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-upload media paths", () => {
    const result = adminPackageSchema.safeParse({
      ...validPackage,
      gallery: [{ path: "https://example.com/image.jpg", alt: "Remote image" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("admin destination validation", () => {
  const validDestination = {
    name: "Test destination",
    slug: "test-destination",
    region: "Test",
    description: "A valid destination.",
    heroImage: null,
    heroImageAlt: null,
    mapRegionId: "test-region",
    lat: 6.9271,
    lng: 79.8612,
    bestSeason: "Year round",
    highlights: ["Scenery"],
  };

  it("accepts a valid destination", () => {
    expect(adminDestinationSchema.safeParse(validDestination).success).toBe(true);
  });

  it("rejects out-of-range coordinates", () => {
    expect(adminDestinationSchema.safeParse({ ...validDestination, lat: 100 }).success).toBe(false);
  });
});

describe("site settings validation", () => {
  it("accepts empty optional fields", () => {
    expect(
      siteSettingsSchema.safeParse({
        whatsappNumber: "",
        contactEmail: "",
        phone: "",
        facebook: "",
        instagram: "",
        youtube: "",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid social URL", () => {
    expect(
      siteSettingsSchema.safeParse({
        whatsappNumber: "",
        contactEmail: "",
        phone: "",
        facebook: "javascript:alert(1)",
        instagram: "",
        youtube: "",
      }).success,
    ).toBe(false);
  });
});
