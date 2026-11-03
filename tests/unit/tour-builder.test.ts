import { describe, expect, it } from "vitest";

import { generatedItinerarySchema, quoteRequestSchema } from "@/lib/validation/tour-builder";
import { computeQuote, type TourBuilderRates } from "@/server/ai/pricing";
import { generateItineraryPdf } from "@/server/ai/pdf";

const packageId = "11111111-1111-4111-8111-111111111111";
const vehicleId = "22222222-2222-4222-8222-222222222222";

const itinerary = {
  title: "Seven days in Sri Lanka",
  summary: "A balanced route through culture and coast.",
  selected_package_slug: "test-package",
  days: [
    {
      day: 1,
      title: "Arrival",
      destination_slug: "colombo",
      activities: ["Culture"],
      overnight: "To be confirmed by the team",
      notes: "Arrive and settle in.",
      travel_km: 120,
    },
  ],
};

const quiz = {
  locations: ["colombo"],
  budget: "star" as const,
  board: "half_board" as const,
  selfDrive: false,
  days: 1,
  nights: 0,
  travelMonth: 2,
  adults: 2,
  children: 1,
  notes: "",
  turnstileToken: "test",
};

const rates: TourBuilderRates = {
  adminWhatsAppNumber: null,
  roomOnlyPercent: -10,
  halfBoardPercent: 5,
  fullBoardPercent: 10,
  childRatePercent: 50,
  vehicles: [
    {
      id: vehicleId,
      name: "Test van",
      minPax: 1,
      maxPax: 6,
      perKmRateLkr: 100,
      driverDailyRateLkr: 5000,
    },
  ],
};

const breakdown = computeQuote({
  package: {
    id: packageId,
    title: "Test package",
    slug: "test-package",
    tier: "star",
    dailyRateLkr: 10_000,
  },
  rates,
  board: quiz.board,
  days: quiz.days,
  adults: quiz.adults,
  children: quiz.children,
  selfDrive: quiz.selfDrive,
  distanceKm: itinerary.days[0].travel_km,
  vehicle: rates.vehicles[0],
});

describe("tour builder validation", () => {
  it("accepts a valid generated itinerary", () => {
    expect(generatedItinerarySchema.safeParse(itinerary).success).toBe(true);
  });

  it("rejects malformed quote requests", () => {
    expect(
      quoteRequestSchema.safeParse({
        sessionId: "not-a-uuid",
        reference: "GL-ABCDEFGHIJ",
        travelDate: "next week",
        name: "Tester",
        email: "tester@example.com",
        phone: "123",
        country: "LK",
        turnstileToken: "token",
        idempotencyKey: "1234567890123456",
      }).success,
    ).toBe(false);
  });
});

describe("tour builder pricing", () => {
  it("prices the package by day, board percentage and traveller units", () => {
    expect(breakdown.package.travellerUnits).toBe(2.5);
    expect(breakdown.package.adjustedDailyRateLkr).toBe(10_500);
    expect(breakdown.package.subtotalLkr).toBe(26_250);
  });

  it("prices transport per kilometre plus a driver day", () => {
    expect(breakdown.ride.distanceLkr).toBe(12_000);
    expect(breakdown.ride.driverLkr).toBe(5_000);
    expect(breakdown.ride.subtotalLkr).toBe(17_000);
    expect(breakdown.totalLkr).toBe(43_300);
  });

  it("removes the driver charge for self-drive", () => {
    const selfDrive = computeQuote({
      package: {
        id: packageId,
        title: "Test package",
        slug: "test-package",
        tier: "star",
        dailyRateLkr: 10_000,
      },
      rates,
      board: quiz.board,
      days: quiz.days,
      adults: quiz.adults,
      children: quiz.children,
      selfDrive: true,
      distanceKm: itinerary.days[0].travel_km,
      vehicle: rates.vehicles[0],
    });
    expect(selfDrive.ride.driverLkr).toBe(0);
    expect(selfDrive.totalLkr).toBe(38_300);
  });
});

describe("itinerary PDF", () => {
  it("generates a PDF buffer", { timeout: 30_000 }, async () => {
    const pdf = await generateItineraryPdf({
      quiz,
      itinerary,
      breakdown,
      totalLkr: breakdown.totalLkr,
      reference: "GL-ABCDEFGHIJ",
      packageTitle: "Test package",
      destinations: [
        {
          name: "Colombo",
          slug: "colombo",
          region: "Western",
          description: "",
          bestSeason: null,
          highlights: [],
          lat: 6.9271,
          lng: 79.8612,
        },
      ],
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
