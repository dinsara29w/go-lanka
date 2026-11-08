export const BUDGET_TIERS = ["economy", "star", "luxury"] as const;
export const BOARD_TYPES = ["room_only", "bed_breakfast", "half_board", "full_board"] as const;
export const VEHICLE_MODES = ["driver", "self_drive"] as const;

export type BudgetTier = (typeof BUDGET_TIERS)[number];
export type BoardType = (typeof BOARD_TYPES)[number];
export type VehicleMode = (typeof VEHICLE_MODES)[number];

export const BOARD_LABELS: Record<BoardType, string> = {
  room_only: "Room only",
  bed_breakfast: "Bed & breakfast",
  half_board: "Half board",
  full_board: "Full board",
};

// The stored key stays "star" for existing quotes; the client calls this tier mid-range.
export const BUDGET_LABELS: Record<BudgetTier, string> = {
  economy: "Economy",
  star: "Mid-range",
  luxury: "Luxury",
};

export const VEHICLE_MODE_LABELS: Record<VehicleMode, string> = {
  driver: "With a driver",
  self_drive: "Self-drive",
};

/** A vehicle option as shown to travellers in the tour builder (no internal fields). */
export type PublicVehicleOption = {
  id: string;
  name: string;
  mode: VehicleMode;
  maxPax: number;
  perKmRateLkr: number;
  dailyRateLkr: number;
  includedKmPerDay: number;
};
