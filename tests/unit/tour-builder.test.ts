import { describe, expect, it } from "vitest";

import { generatedItinerarySchema, quoteRequestSchema } from "@/lib/validation/tour-builder";
import {
  computeQuote,
  vehiclesForParty,
  type TourBuilderRates,
  type VehicleRate,
} from "@/server/ai/pricing";
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
  vehicleId: null,
  days: 1,
  nights: 0,
  travelMonth: 2,
  adults: 2,
  children: 1,
  notes: "",
  turnstileToken: "test",
};

// The client's rate card (db/migrations/20261108090000_client_rate_card.sql).
const car: VehicleRate = {
  id: vehicleId,
  name: "Car",
  mode: "driver",
  minPax: 1,
  maxPax: 3,
  perKmRateLkr: 180,
  dailyRateLkr: 0,
  includedKmPerDay: 0,
};
const selfDriveCar: VehicleRate = {
  ...car,
  id: "33333333-3333-4333-8333-333333333333",
  mode: "self_drive",
  dailyRateLkr: 6000,
  includedKmPerDay: 200,
};
const bike: VehicleRate = {
  ...selfDriveCar,
  id: "44444444-4444-4444-8444-444444444444",
  name: "Bike",
  maxPax: 2,
  perKmRateLkr: 0,
  dailyRateLkr: 1500,
};
const van: VehicleRate = {
  ...car,
  id: "55555555-5555-4555-8555-555555555555",
  name: "Van",
  maxPax: 9,
  perKmRateLkr: 250,
};

const rates: TourBuilderRates = {
  adminWhatsAppNumber: null,
  tierRatesLkr: { economy: 15_000, star: 60_000, luxury: 125_000 },
  roomOnlyPercent: -10,
  halfBoardPercent: 5,
  fullBoardPercent: 10,
  childRatePercent: 50,
  vehicles: [car, selfDriveCar, bike, van],
};

const basePackage = { id: packageId, title: "Test package", slug: "test-package" };

function quote(overrides: Partial<Parameters<typeof computeQuote>[0]> = {}) {
  return computeQuote({
    package: basePackage,
    rates,
    budget: "star",
    board: "bed_breakfast",
    days: 7,
    nights: 6,
    adults: 2,
    children: 0,
    mode: "driver",
    distanceKm: 500,
    vehicle: car,
    ...overrides,
  });
}

const breakdown = quote({ days: 1, nights: 0, adults: 2, children: 1, board: "half_board" });

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
  it("prices hotels per person per night by budget tier, bed and breakfast", () => {
    const result = quote();
    expect(result.stay.ratePerPersonNightLkr).toBe(60_000);
    expect(result.stay.baseLkr).toBe(720_000);
    expect(result.stay.boardPercent).toBe(0);
    expect(result.stay.subtotalLkr).toBe(720_000);
  });

  it("applies the meal-plan percentage to the hotel total", () => {
    const economy = { budget: "economy" as const, nights: 2, adults: 2, children: 1 };
    // 15,000 × 2 nights × 2.5 traveller units (child at 50%) = 75,000
    expect(quote({ ...economy, board: "room_only" }).stay.subtotalLkr).toBe(67_500);
    expect(quote({ ...economy, board: "bed_breakfast" }).stay.subtotalLkr).toBe(75_000);
    expect(quote({ ...economy, board: "half_board" }).stay.subtotalLkr).toBe(78_750);
    expect(quote({ ...economy, board: "full_board" }).stay.subtotalLkr).toBe(82_500);
  });

  it("charges a driven vehicle per km of the route", () => {
    const result = quote();
    expect(result.ride.chargedKm).toBe(500);
    expect(result.ride.distanceLkr).toBe(90_000);
    expect(result.ride.subtotalLkr).toBe(90_000);
    expect(result.totalLkr).toBe(810_000);
  });

  it("charges self-drive per day with 200 km/day included and extra km per km", () => {
    const result = quote({ mode: "self_drive", vehicle: selfDriveCar, days: 3, distanceKm: 700 });
    expect(result.ride.dailyLkr).toBe(18_000);
    expect(result.ride.includedKm).toBe(600);
    expect(result.ride.chargedKm).toBe(100);
    expect(result.ride.distanceLkr).toBe(18_000);
    expect(result.ride.subtotalLkr).toBe(36_000);
  });

  it("does not charge extra km when the allowance covers the route", () => {
    const result = quote({ mode: "self_drive", vehicle: selfDriveCar, days: 3, distanceKm: 450 });
    expect(result.ride.chargedKm).toBe(0);
    expect(result.ride.subtotalLkr).toBe(18_000);
  });

  it("flags extra km for the team when a self-drive vehicle has no per-km rate", () => {
    const result = quote({ mode: "self_drive", vehicle: bike, days: 3, distanceKm: 700 });
    expect(result.ride.distanceLkr).toBe(0);
    expect(result.notes.some((note) => note.includes("extra-km"))).toBe(true);
  });

  it("offers only vehicles of the chosen type that seat the party", () => {
    expect(vehiclesForParty(rates.vehicles, "driver", 2).map((v) => v.name)).toEqual([
      "Car",
      "Van",
    ]);
    expect(vehiclesForParty(rates.vehicles, "driver", 5).map((v) => v.name)).toEqual(["Van"]);
    expect(vehiclesForParty(rates.vehicles, "self_drive", 3).map((v) => v.name)).toEqual(["Car"]);
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
          heroImage: null,
        },
      ],
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
