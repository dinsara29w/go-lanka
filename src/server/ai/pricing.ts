import "server-only";

import { formatLkr } from "@/lib/currency";
import {
  BOARD_LABELS,
  BUDGET_LABELS,
  VEHICLE_MODE_LABELS,
  type BoardType,
  type BudgetTier,
  type VehicleMode,
} from "@/lib/tour-builder";

export type TourBuilderRates = {
  adminWhatsAppNumber: string | null;
  /** Hotel rate per person per night, bed and breakfast, by budget tier. */
  tierRatesLkr: Record<BudgetTier, number>;
  roomOnlyPercent: number;
  halfBoardPercent: number;
  fullBoardPercent: number;
  childRatePercent: number;
  vehicles: VehicleRate[];
};

export type VehicleRate = {
  id: string;
  name: string;
  mode: VehicleMode;
  minPax: number;
  maxPax: number;
  /** Driver: charged for every km. Self-drive: charged for km above the daily allowance. */
  perKmRateLkr: number;
  /** Driver: optional driver allowance per day. Self-drive: rental per day. */
  dailyRateLkr: number;
  /** Self-drive only: km included in each day's rental. */
  includedKmPerDay: number;
};

export type QuoteBreakdown = {
  /** The published package the AI used as the route basis (not priced); null when none fits. */
  package: { id: string; title: string; slug: string } | null;
  stay: {
    tier: BudgetTier;
    ratePerPersonNightLkr: number;
    nights: number;
    travellerUnits: number;
    board: BoardType;
    boardPercent: number;
    baseLkr: number;
    subtotalLkr: number;
  };
  ride: {
    vehicleId: string | null;
    vehicleName: string | null;
    mode: VehicleMode;
    distanceKm: number;
    days: number;
    dailyRateLkr: number;
    dailyLkr: number;
    includedKm: number;
    chargedKm: number;
    perKmRateLkr: number;
    distanceLkr: number;
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

/** Bed and breakfast is the base rate; the other boards adjust it by an admin-set percentage. */
export function boardPercentFor(board: BoardType, rates: TourBuilderRates): number {
  if (board === "room_only") return rates.roomOnlyPercent;
  if (board === "half_board") return rates.halfBoardPercent;
  if (board === "full_board") return rates.fullBoardPercent;
  return 0;
}

/** Vehicles of the requested mode that seat the whole party, smallest first. */
export function vehiclesForParty(
  vehicles: VehicleRate[],
  mode: VehicleMode,
  partySize: number,
): VehicleRate[] {
  return vehicles
    .filter((vehicle) => vehicle.mode === mode && vehicle.maxPax >= partySize)
    .sort((a, b) => a.maxPax - b.maxPax);
}

export function computeQuote(input: {
  package: { id: string; title: string; slug: string } | null;
  rates: TourBuilderRates;
  budget: BudgetTier;
  board: BoardType;
  days: number;
  nights: number;
  adults: number;
  children: number;
  mode: VehicleMode;
  distanceKm: number;
  vehicle: VehicleRate | null;
}): QuoteBreakdown {
  const notes: string[] = [];
  const partySize = input.adults + input.children;

  // Stay: rate per person per night (B&B), children at the child rate, then the board adjustment.
  const ratePerPersonNightLkr = input.rates.tierRatesLkr[input.budget];
  const travellerUnits = input.adults + (input.children * input.rates.childRatePercent) / 100;
  const boardPercent = boardPercentFor(input.board, input.rates);
  const baseLkr = roundMoney(ratePerPersonNightLkr * input.nights * travellerUnits);
  const staySubtotal = Math.max(0, roundMoney(baseLkr * (1 + boardPercent / 100)));

  // Ride.
  const vehicle = input.vehicle;
  const days = input.days;
  const dailyRateLkr = vehicle?.dailyRateLkr ?? 0;
  const dailyLkr = roundMoney(dailyRateLkr * days);
  const includedKm = input.mode === "self_drive" ? (vehicle?.includedKmPerDay ?? 0) * days : 0;
  const chargedKm = Math.max(0, roundMoney(input.distanceKm - includedKm));
  const perKmRateLkr = vehicle?.perKmRateLkr ?? 0;
  const distanceLkr = roundMoney(perKmRateLkr * chargedKm);
  const rideSubtotal = roundMoney(dailyLkr + distanceLkr);

  if (!vehicle) {
    notes.push(
      `No vehicle was selected for ${partySize} travellers. The team will confirm transport.`,
    );
  } else if (vehicle.maxPax < partySize) {
    notes.push(
      `${vehicle.name} seats ${vehicle.maxPax}; the team will confirm transport for ${partySize} travellers.`,
    );
  }
  if (input.mode === "self_drive") {
    notes.push("Self-drive: vehicle supplied without a driver.");
    if (vehicle && chargedKm > 0 && perKmRateLkr === 0) {
      notes.push(
        `${Math.round(chargedKm)} km above the daily allowance. The team will confirm the extra-km charge.`,
      );
    }
  }
  if (input.children > 0) {
    notes.push(`Children are charged at ${input.rates.childRatePercent}% of the adult hotel rate.`);
  }
  if (input.nights === 0) {
    notes.push("No hotel nights were requested.");
  }

  return {
    package: input.package,
    stay: {
      tier: input.budget,
      ratePerPersonNightLkr: roundMoney(ratePerPersonNightLkr),
      nights: input.nights,
      travellerUnits: roundMoney(travellerUnits),
      board: input.board,
      boardPercent,
      baseLkr,
      subtotalLkr: staySubtotal,
    },
    ride: {
      vehicleId: vehicle?.id ?? null,
      vehicleName: vehicle?.name ?? null,
      mode: input.mode,
      distanceKm: roundMoney(input.distanceKm),
      days,
      dailyRateLkr: roundMoney(dailyRateLkr),
      dailyLkr,
      includedKm,
      chargedKm,
      perKmRateLkr: roundMoney(perKmRateLkr),
      distanceLkr,
      subtotalLkr: rideSubtotal,
    },
    totalLkr: roundTotal(staySubtotal + rideSubtotal),
    notes,
  };
}

/** One-line hotel summary for the PDF and quote email. */
export function describeStay(breakdown: QuoteBreakdown): string {
  const { stay } = breakdown;
  const sign = stay.boardPercent > 0 ? "+" : "";
  const board =
    stay.boardPercent === 0
      ? BOARD_LABELS[stay.board]
      : `${BOARD_LABELS[stay.board]} ${sign}${stay.boardPercent}%`;
  return (
    `${BUDGET_LABELS[stay.tier]} hotels — ${formatLkr(stay.ratePerPersonNightLkr)} per person per night ` +
    `× ${stay.nights} nights × ${stay.travellerUnits} traveller units, ${board}`
  );
}

/** One-line transport summary for the PDF and quote email. */
export function describeRide(breakdown: QuoteBreakdown): string {
  const { ride } = breakdown;
  if (!ride.vehicleName) return "To be confirmed by the team";
  const parts: string[] = [];
  if (ride.dailyLkr > 0) {
    parts.push(`${ride.days} days × ${formatLkr(ride.dailyRateLkr)}`);
  }
  if (ride.mode === "self_drive") {
    parts.push(`${ride.includedKm} km included`);
    if (ride.distanceLkr > 0) {
      parts.push(`${ride.chargedKm} extra km × ${formatLkr(ride.perKmRateLkr)}`);
    }
  } else {
    parts.push(`${ride.chargedKm} km × ${formatLkr(ride.perKmRateLkr)}`);
  }
  return `${ride.vehicleName} (${VEHICLE_MODE_LABELS[ride.mode].toLowerCase()}) — ${parts.join(" + ")}`;
}
