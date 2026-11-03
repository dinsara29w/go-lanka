import "server-only";

import type { BoardType, BudgetTier } from "@/lib/validation/tour-builder";

export type TourBuilderRates = {
  adminWhatsAppNumber: string | null;
  roomOnlyPercent: number;
  halfBoardPercent: number;
  fullBoardPercent: number;
  childRatePercent: number;
  vehicles: VehicleRate[];
};

export type VehicleRate = {
  id: string;
  name: string;
  minPax: number;
  maxPax: number;
  perKmRateLkr: number;
  driverDailyRateLkr: number;
};

export type QuotePackage = {
  id: string;
  title: string;
  slug: string;
  tier: BudgetTier;
  dailyRateLkr: number;
};

export type QuoteBreakdown = {
  package: {
    id: string;
    title: string;
    slug: string;
    tier: BudgetTier;
    dailyRateLkr: number;
    days: number;
    travellerUnits: number;
    board: BoardType;
    boardPercent: number;
    adjustedDailyRateLkr: number;
    subtotalLkr: number;
  };
  ride: {
    vehicleId: string | null;
    vehicleName: string | null;
    perKmRateLkr: number;
    distanceKm: number;
    distanceLkr: number;
    selfDrive: boolean;
    driverDays: number;
    driverDailyRateLkr: number;
    driverLkr: number;
    subtotalLkr: number;
  };
  totalLkr: number;
  notes: string[];
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundTotal(value: number): number {
  return Math.max(0, Math.round(value / 100) * 100);
}

export function boardPercentFor(board: BoardType, rates: TourBuilderRates): number {
  if (board === "room_only") return rates.roomOnlyPercent;
  if (board === "full_board") return rates.fullBoardPercent;
  return rates.halfBoardPercent;
}

export function selectVehicle(
  vehicles: VehicleRate[],
  partySize: number,
): { vehicle: VehicleRate | null; capacityShortfall: boolean } {
  const sorted = [...vehicles].sort((a, b) => a.maxPax - b.maxPax);
  const fitting = sorted.filter((vehicle) => vehicle.maxPax >= partySize);
  if (fitting.length === 0) {
    const largest = sorted.at(-1) ?? null;
    return { vehicle: largest, capacityShortfall: largest !== null };
  }
  const inRange = fitting.find((vehicle) => vehicle.minPax <= partySize);
  return { vehicle: inRange ?? fitting[0] ?? null, capacityShortfall: false };
}

export function computeQuote(input: {
  package: QuotePackage;
  rates: TourBuilderRates;
  board: BoardType;
  days: number;
  adults: number;
  children: number;
  selfDrive: boolean;
  distanceKm: number;
  vehicle: VehicleRate | null;
  capacityShortfall?: boolean;
}): QuoteBreakdown {
  const notes: string[] = [];
  const boardPercent = boardPercentFor(input.board, input.rates);
  const travellerUnits =
    input.adults + (input.children * input.rates.childRatePercent) / 100;
  const adjustedDailyRateLkr = Math.max(
    0,
    roundMoney(input.package.dailyRateLkr * (1 + boardPercent / 100)),
  );
  const packageSubtotal = roundMoney(
    adjustedDailyRateLkr * input.days * travellerUnits,
  );

  const perKmRateLkr = input.vehicle?.perKmRateLkr ?? 0;
  const distanceLkr = roundMoney(perKmRateLkr * input.distanceKm);
  const driverDailyRateLkr = input.vehicle?.driverDailyRateLkr ?? 0;
  const driverDays = input.selfDrive ? 0 : input.days;
  const driverLkr = roundMoney(driverDailyRateLkr * driverDays);
  const rideSubtotal = roundMoney(distanceLkr + driverLkr);

  if (!input.vehicle) {
    notes.push("No active vehicle matches this party size. Add a vehicle rate.");
  } else if (input.capacityShortfall) {
    notes.push(
      `The largest vehicle (${input.vehicle.name}) seats ${input.vehicle.maxPax}; confirm transport for ${input.adults + input.children} travellers.`,
    );
  }
  if (input.selfDrive) {
    notes.push("Self-drive: vehicle supplied without a driver.");
  }
  if (input.children > 0) {
    notes.push(
      `Children are charged at ${input.rates.childRatePercent}% of the adult rate.`,
    );
  }

  return {
    package: {
      id: input.package.id,
      title: input.package.title,
      slug: input.package.slug,
      tier: input.package.tier,
      dailyRateLkr: roundMoney(input.package.dailyRateLkr),
      days: input.days,
      travellerUnits: roundMoney(travellerUnits),
      board: input.board,
      boardPercent,
      adjustedDailyRateLkr,
      subtotalLkr: packageSubtotal,
    },
    ride: {
      vehicleId: input.vehicle?.id ?? null,
      vehicleName: input.vehicle?.name ?? null,
      perKmRateLkr: roundMoney(perKmRateLkr),
      distanceKm: roundMoney(input.distanceKm),
      distanceLkr,
      selfDrive: input.selfDrive,
      driverDays,
      driverDailyRateLkr: roundMoney(driverDailyRateLkr),
      driverLkr,
      subtotalLkr: rideSubtotal,
    },
    totalLkr: roundTotal(packageSubtotal + rideSubtotal),
    notes,
  };
}
