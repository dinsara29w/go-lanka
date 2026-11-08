import "server-only";

import type { PublicVehicleOption, VehicleMode } from "@/lib/tour-builder";
import type { TourBuilderRates, VehicleRate } from "@/server/ai/pricing";
import { getPublicPool } from "@/server/db/pools";

type SettingsRow = {
  admin_whatsapp_number: string | null;
  economy_rate_lkr: string;
  star_rate_lkr: string;
  luxury_rate_lkr: string;
  room_only_percent: string;
  half_board_percent: string;
  full_board_percent: string;
  child_rate_percent: string;
};

type VehicleRow = {
  id: string;
  name: string;
  mode: VehicleMode;
  min_pax: number;
  max_pax: number;
  per_km_rate_lkr: string;
  daily_rate_lkr: string;
  included_km_per_day: number;
};

// Mirrors the column defaults in db/migrations/20261108090000_client_rate_card.sql.
const DEFAULT_RATES: Omit<TourBuilderRates, "vehicles"> = {
  adminWhatsAppNumber: null,
  tierRatesLkr: { economy: 15000, star: 60000, luxury: 125000 },
  roomOnlyPercent: -10,
  halfBoardPercent: 5,
  fullBoardPercent: 10,
  childRatePercent: 50,
};

export async function getTourBuilderRates(): Promise<TourBuilderRates> {
  const pool = getPublicPool();
  const [settingsResult, vehicleResult] = await Promise.all([
    pool.query<SettingsRow>(
      `SELECT admin_whatsapp_number, economy_rate_lkr, star_rate_lkr, luxury_rate_lkr,
              room_only_percent, half_board_percent, full_board_percent, child_rate_percent
       FROM tour_builder_settings
       WHERE singleton = true
       LIMIT 1`,
    ),
    pool.query<VehicleRow>(
      `SELECT id, name, mode, min_pax, max_pax, per_km_rate_lkr, daily_rate_lkr,
              included_km_per_day
       FROM vehicles
       WHERE is_active = true
       ORDER BY sort_order ASC, max_pax ASC, name ASC`,
    ),
  ]);

  const settings = settingsResult.rows[0];
  const vehicles: VehicleRate[] = vehicleResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    mode: row.mode,
    minPax: row.min_pax,
    maxPax: row.max_pax,
    perKmRateLkr: Number(row.per_km_rate_lkr),
    dailyRateLkr: Number(row.daily_rate_lkr),
    includedKmPerDay: row.included_km_per_day,
  }));

  if (!settings) {
    return { ...DEFAULT_RATES, vehicles };
  }

  return {
    adminWhatsAppNumber: settings.admin_whatsapp_number,
    tierRatesLkr: {
      economy: Number(settings.economy_rate_lkr),
      star: Number(settings.star_rate_lkr),
      luxury: Number(settings.luxury_rate_lkr),
    },
    roomOnlyPercent: Number(settings.room_only_percent),
    halfBoardPercent: Number(settings.half_board_percent),
    fullBoardPercent: Number(settings.full_board_percent),
    childRatePercent: Number(settings.child_rate_percent),
    vehicles,
  };
}

/** Active vehicles for the tour builder's vehicle picker. */
export async function listPublicVehicleOptions(): Promise<PublicVehicleOption[]> {
  const { vehicles } = await getTourBuilderRates();
  return vehicles.map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.name,
    mode: vehicle.mode,
    maxPax: vehicle.maxPax,
    perKmRateLkr: vehicle.perKmRateLkr,
    dailyRateLkr: vehicle.dailyRateLkr,
    includedKmPerDay: vehicle.includedKmPerDay,
  }));
}
