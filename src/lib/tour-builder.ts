export const BUDGET_TIERS = ["economy", "star", "luxury"] as const;
export const BOARD_TYPES = ["room_only", "half_board", "full_board"] as const;

export type BudgetTier = (typeof BUDGET_TIERS)[number];
export type BoardType = (typeof BOARD_TYPES)[number];

export const BOARD_LABELS: Record<BoardType, string> = {
  room_only: "Room only (nights only)",
  half_board: "Half board",
  full_board: "Full board",
};

export const BUDGET_LABELS: Record<BudgetTier, string> = {
  economy: "Economy",
  star: "Star",
  luxury: "Luxury",
};
