-- Client rate card for tour-builder quotations:
--   * hotel rate per person per night for each budget tier (bed and breakfast)
--   * bed and breakfast becomes the base board; room only / half / full board adjust it
--   * vehicles are either chauffeur-driven (per km) or self-drive (per day with km included)
-- Starting values come from the client and stay editable in /admin/rates.

-- ---------------------------------------------------------------------------
-- Hotel rates per budget tier
-- ---------------------------------------------------------------------------

ALTER TABLE tour_builder_settings
  ADD COLUMN economy_rate_lkr numeric(12, 2) NOT NULL DEFAULT 15000,
  ADD COLUMN star_rate_lkr numeric(12, 2) NOT NULL DEFAULT 60000,
  ADD COLUMN luxury_rate_lkr numeric(12, 2) NOT NULL DEFAULT 125000,
  ADD CONSTRAINT tour_builder_settings_tier_rates_nonnegative CHECK (
    economy_rate_lkr >= 0 AND star_rate_lkr >= 0 AND luxury_rate_lkr >= 0
  );

-- ---------------------------------------------------------------------------
-- Bed and breakfast board
-- ---------------------------------------------------------------------------

ALTER TABLE tour_quotes DROP CONSTRAINT tour_quotes_board_valid;
ALTER TABLE tour_quotes
  ADD CONSTRAINT tour_quotes_board_valid CHECK (
    board IN ('room_only', 'bed_breakfast', 'half_board', 'full_board')
  );

-- ---------------------------------------------------------------------------
-- Vehicles: driver or self-drive
-- ---------------------------------------------------------------------------

ALTER TABLE vehicles RENAME COLUMN driver_daily_rate_lkr TO daily_rate_lkr;
ALTER TABLE vehicles RENAME CONSTRAINT vehicles_driver_nonnegative TO vehicles_daily_nonnegative;

ALTER TABLE vehicles
  ADD COLUMN mode text NOT NULL DEFAULT 'driver',
  ADD COLUMN included_km_per_day integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT vehicles_mode_valid CHECK (mode IN ('driver', 'self_drive')),
  ADD CONSTRAINT vehicles_included_km_valid CHECK (
    included_km_per_day >= 0 AND included_km_per_day <= 2000
  );

-- The same vehicle type (e.g. tuk tuk) can be offered with a driver and as self-drive.
ALTER TABLE vehicles DROP CONSTRAINT vehicles_name_unique;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_name_mode_unique UNIQUE (name, mode);

-- With driver: per_km_rate_lkr is charged for every km.
-- Self-drive: daily_rate_lkr per day includes included_km_per_day; extra km use per_km_rate_lkr.
-- Seats are suggested values; the client confirms them in /admin/rates.
INSERT INTO vehicles
  (name, mode, min_pax, max_pax, per_km_rate_lkr, daily_rate_lkr, included_km_per_day, sort_order)
VALUES
  ('Tuk tuk', 'driver', 1, 2, 100, 0, 0, 10),
  ('Car', 'driver', 1, 3, 180, 0, 0, 20),
  ('Van', 'driver', 1, 9, 250, 0, 0, 30),
  ('Bus', 'driver', 1, 30, 300, 0, 0, 40),
  ('Bike', 'self_drive', 1, 2, 0, 1500, 200, 50),
  ('Tuk tuk', 'self_drive', 1, 2, 100, 2000, 200, 60),
  ('Car', 'self_drive', 1, 3, 180, 6000, 200, 70)
ON CONFLICT (name, mode) DO NOTHING;
