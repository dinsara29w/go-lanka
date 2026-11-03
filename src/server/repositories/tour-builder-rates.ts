import "server-only";

import type { TourBuilderRates, VehicleRate } from "@/server/ai/pricing";
import { getPublicPool } from "@/server/db/pools";

type SettingsRow = {
  admin_whatsapp_number: string | null;
  room_only_percent: string;
  half_board_percent: string;
  full_board_percent: string;
  child_rate_percent: string;
};

type VehicleRow = {
  id: string;
  name: string;
  min_pax: number;
  max_pax: number;
  per_km_rate_lkr: string;
  driver_daily_rate_lkr: string;
};

const DEFAULT_RATES: TourBuilderRates = {
  adminWhatsAppNumber: null,
  roomOnlyPercent: -10,
  halfBoardPercent: 5,
  fullBoardPercent: 10,
  childRatePercent: 50,
  vehicles: [],
};

export async function getTourBuilderRates(): Promise<TourBuilderRates> {
  const pool = getPublicPool();
  const [settingsResult, vehicleResult] = await Promise.all([
    pool.query<SettingsRow>(
      `SELECT admin_whatsapp_number, room_only_percent, half_board_percent,
              full_board_percent, child_rate_percent
       FROM tour_builder_settings
       WHERE singleton = true
       LIMIT 1`,
    ),
    pool.query<VehicleRow>(
      `SELECT id, name, min_pax, max_pax, per_km_rate_lkr, driver_daily_rate_lkr
       FROM vehicles
       WHERE is_active = true
       ORDER BY sort_order ASC, max_pax ASC, name ASC`,
    ),
  ]);

  const settings = settingsResult.rows[0];
  const vehicles: VehicleRate[] = vehicleResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    minPax: row.min_pax,
    maxPax: row.max_pax,
    perKmRateLkr: Number(row.per_km_rate_lkr),
    driverDailyRateLkr: Number(row.driver_daily_rate_lkr),
  }));

  if (!settings) {
    return { ...DEFAULT_RATES, vehicles };
  }

  return {
    adminWhatsAppNumber: settings.admin_whatsapp_number,
    roomOnlyPercent: Number(settings.room_only_percent),
    halfBoardPercent: Number(settings.half_board_percent),
    fullBoardPercent: Number(settings.full_board_percent),
    childRatePercent: Number(settings.child_rate_percent),
    vehicles,
  };
}
