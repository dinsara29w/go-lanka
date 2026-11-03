-- Tour builder quotation flow:
--   * per-package daily rate card and budget tier
--   * vehicle rates (per km + driver day) and board adjustments
--   * quotation drafts reviewed and released by an admin

-- ---------------------------------------------------------------------------
-- Package rate card
-- ---------------------------------------------------------------------------

ALTER TABLE packages
  ADD COLUMN daily_rate_lkr numeric(12, 2),
  ADD COLUMN tier text NOT NULL DEFAULT 'star';

UPDATE packages
SET daily_rate_lkr = round(base_price_lkr / GREATEST(duration_days, 1), 2)
WHERE daily_rate_lkr IS NULL;

ALTER TABLE packages
  ALTER COLUMN daily_rate_lkr SET NOT NULL,
  ADD CONSTRAINT packages_daily_rate_nonnegative CHECK (daily_rate_lkr >= 0),
  ADD CONSTRAINT packages_tier_valid CHECK (tier IN ('economy', 'star', 'luxury'));

-- ---------------------------------------------------------------------------
-- Vehicles and tour-builder settings
-- ---------------------------------------------------------------------------

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_pax integer NOT NULL DEFAULT 1,
  max_pax integer NOT NULL,
  per_km_rate_lkr numeric(12, 2) NOT NULL,
  driver_daily_rate_lkr numeric(12, 2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicles_name_unique UNIQUE (name),
  CONSTRAINT vehicles_capacity_valid CHECK (min_pax >= 1 AND max_pax >= min_pax AND max_pax <= 60),
  CONSTRAINT vehicles_per_km_nonnegative CHECK (per_km_rate_lkr >= 0),
  CONSTRAINT vehicles_driver_nonnegative CHECK (driver_daily_rate_lkr >= 0)
);

CREATE TABLE tour_builder_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true,
  admin_whatsapp_number text,
  room_only_percent numeric(6, 2) NOT NULL DEFAULT -10,
  half_board_percent numeric(6, 2) NOT NULL DEFAULT 5,
  full_board_percent numeric(6, 2) NOT NULL DEFAULT 10,
  child_rate_percent numeric(6, 2) NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tour_builder_settings_singleton CHECK (singleton),
  CONSTRAINT tour_builder_settings_singleton_unique UNIQUE (singleton),
  CONSTRAINT tour_builder_settings_child_rate CHECK (
    child_rate_percent >= 0 AND child_rate_percent <= 100
  )
);

INSERT INTO tour_builder_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------------

CREATE TABLE tour_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  ai_session_id uuid REFERENCES ai_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  budget text NOT NULL,
  board text NOT NULL,
  self_drive boolean NOT NULL DEFAULT false,
  days integer NOT NULL,
  nights integer NOT NULL DEFAULT 0,
  adults integer NOT NULL,
  children integer NOT NULL DEFAULT 0,
  travel_month integer NOT NULL,
  locations text[] NOT NULL DEFAULT '{}',
  notes text,
  package_id uuid REFERENCES packages(id) ON DELETE SET NULL,
  package_title text,
  package_slug text,
  package_daily_rate_lkr numeric(12, 2),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_name text,
  distance_km numeric(10, 2) NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_lkr numeric(12, 2) NOT NULL DEFAULT 0,
  itinerary jsonb NOT NULL DEFAULT '{}'::jsonb,
  name text,
  email text,
  phone text,
  country text,
  travel_date date,
  message text,
  contact_idempotency_key text,
  admin_notes text,
  final_total_lkr numeric(12, 2),
  reviewed_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  sent_email_at timestamptz,
  sent_whatsapp_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tour_quotes_reference_unique UNIQUE (reference),
  CONSTRAINT tour_quotes_contact_idempotency_unique UNIQUE (contact_idempotency_key),
  CONSTRAINT tour_quotes_status_valid CHECK (
    status IN ('draft', 'pending_review', 'approved', 'rejected')
  ),
  CONSTRAINT tour_quotes_budget_valid CHECK (budget IN ('economy', 'star', 'luxury')),
  CONSTRAINT tour_quotes_board_valid CHECK (board IN ('room_only', 'half_board', 'full_board')),
  CONSTRAINT tour_quotes_breakdown_object CHECK (jsonb_typeof(breakdown) = 'object'),
  CONSTRAINT tour_quotes_itinerary_object CHECK (jsonb_typeof(itinerary) = 'object'),
  CONSTRAINT tour_quotes_total_nonnegative CHECK (total_lkr >= 0),
  CONSTRAINT tour_quotes_final_total_nonnegative CHECK (
    final_total_lkr IS NULL OR final_total_lkr >= 0
  ),
  CONSTRAINT tour_quotes_days_valid CHECK (days >= 1 AND days <= 21),
  CONSTRAINT tour_quotes_nights_valid CHECK (nights >= 0 AND nights <= 21),
  CONSTRAINT tour_quotes_party_valid CHECK (
    adults >= 1 AND adults <= 30 AND children >= 0 AND children <= 20
  )
);

CREATE INDEX tour_quotes_status_created_idx ON tour_quotes (status, created_at DESC);
CREATE INDEX tour_quotes_session_idx ON tour_quotes (ai_session_id);
CREATE UNIQUE INDEX tour_quotes_session_unique_idx ON tour_quotes (ai_session_id)
  WHERE ai_session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_builder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_vehicles_read ON vehicles
  FOR SELECT TO golanka_public USING (is_active = true);
CREATE POLICY public_tour_builder_settings_read ON tour_builder_settings
  FOR SELECT TO golanka_public USING (true);

CREATE POLICY admin_vehicles_all ON vehicles
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_tour_builder_settings_all ON tour_builder_settings
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_tour_quotes_all ON tour_quotes
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);

GRANT SELECT ON vehicles, tour_builder_settings TO golanka_public;
GRANT SELECT, INSERT, UPDATE, DELETE ON vehicles, tour_builder_settings TO golanka_admin;
GRANT SELECT, UPDATE ON tour_quotes TO golanka_admin;

-- ---------------------------------------------------------------------------
-- Public quote writes (constrained security-definer functions)
-- ---------------------------------------------------------------------------

CREATE FUNCTION create_tour_quote(
  p_reference text,
  p_ai_session_id uuid,
  p_quiz jsonb,
  p_itinerary jsonb,
  p_breakdown jsonb,
  p_total_lkr numeric,
  p_package_id uuid,
  p_package_title text,
  p_package_slug text,
  p_package_daily_rate_lkr numeric,
  p_vehicle_id uuid,
  p_vehicle_name text,
  p_distance_km numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_reference IS NULL OR length(p_reference) < 6 OR length(p_reference) > 40 THEN
    RAISE EXCEPTION 'invalid_reference' USING ERRCODE = 'P0001';
  END IF;
  IF p_quiz IS NULL OR jsonb_typeof(p_quiz) <> 'object' THEN
    RAISE EXCEPTION 'invalid_quiz' USING ERRCODE = 'P0001';
  END IF;
  IF p_itinerary IS NULL OR jsonb_typeof(p_itinerary) <> 'object' THEN
    RAISE EXCEPTION 'invalid_itinerary' USING ERRCODE = 'P0001';
  END IF;
  IF p_breakdown IS NULL OR jsonb_typeof(p_breakdown) <> 'object' THEN
    RAISE EXCEPTION 'invalid_breakdown' USING ERRCODE = 'P0001';
  END IF;
  IF p_total_lkr IS NULL OR p_total_lkr < 0 THEN
    RAISE EXCEPTION 'invalid_total' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO tour_quotes (
    reference, ai_session_id, status, budget, board, self_drive, days, nights,
    adults, children, travel_month, locations, notes, package_id, package_title,
    package_slug, package_daily_rate_lkr, vehicle_id, vehicle_name, distance_km,
    breakdown, total_lkr, itinerary
  )
  VALUES (
    p_reference,
    p_ai_session_id,
    'draft',
    COALESCE(NULLIF(p_quiz ->> 'budget', ''), 'star'),
    COALESCE(NULLIF(p_quiz ->> 'board', ''), 'half_board'),
    COALESCE((p_quiz ->> 'selfDrive')::boolean, false),
    COALESCE((p_quiz ->> 'days')::integer, 1),
    COALESCE((p_quiz ->> 'nights')::integer, 0),
    COALESCE((p_quiz ->> 'adults')::integer, 1),
    COALESCE((p_quiz ->> 'children')::integer, 0),
    COALESCE((p_quiz ->> 'travelMonth')::integer, 1),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_quiz -> 'locations', '[]'::jsonb))),
      '{}'::text[]
    ),
    NULLIF(p_quiz ->> 'notes', ''),
    p_package_id,
    p_package_title,
    p_package_slug,
    p_package_daily_rate_lkr,
    p_vehicle_id,
    p_vehicle_name,
    COALESCE(p_distance_km, 0),
    p_breakdown,
    p_total_lkr,
    p_itinerary
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE FUNCTION submit_tour_quote_contact(
  p_ai_session_id uuid,
  p_reference text,
  p_name text,
  p_email text,
  p_phone text,
  p_country text,
  p_travel_date date,
  p_message text,
  p_idempotency_key text
)
RETURNS TABLE (quote_id uuid, quote_reference text, newly_submitted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_quote tour_quotes%ROWTYPE;
BEGIN
  SELECT * INTO v_quote
  FROM tour_quotes
  WHERE ai_session_id = p_ai_session_id
    AND reference = p_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quote_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_quote.status = 'rejected' THEN
    RAISE EXCEPTION 'quote_rejected' USING ERRCODE = 'P0001';
  END IF;

  IF v_quote.status <> 'draft' THEN
    -- Retried submission: acknowledge without sending a second notification.
    RETURN QUERY SELECT v_quote.id, v_quote.reference, false;
    RETURN;
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE = 'P0001';
  END IF;
  IF p_email IS NULL OR position('@' in p_email) < 2 THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = 'P0001';
  END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) < 5 THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = 'P0001';
  END IF;

  UPDATE tour_quotes
  SET name = trim(p_name),
      email = lower(trim(p_email)),
      phone = trim(p_phone),
      country = NULLIF(trim(p_country), ''),
      travel_date = p_travel_date,
      message = NULLIF(trim(p_message), ''),
      contact_idempotency_key = p_idempotency_key,
      status = 'pending_review',
      updated_at = now()
  WHERE id = v_quote.id;

  RETURN QUERY SELECT v_quote.id, v_quote.reference, true;
END;
$$;

REVOKE ALL ON FUNCTION create_tour_quote(
  text, uuid, jsonb, jsonb, jsonb, numeric, uuid, text, text, numeric, uuid, text, numeric
) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_tour_quote_contact(uuid, text, text, text, text, text, date, text, text)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_tour_quote(
  text, uuid, jsonb, jsonb, jsonb, numeric, uuid, text, text, numeric, uuid, text, numeric
) TO golanka_public;
GRANT EXECUTE ON FUNCTION submit_tour_quote_contact(
  uuid, text, text, text, text, text, date, text, text
) TO golanka_public;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER vehicles_set_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tour_builder_settings_set_updated_at
  BEFORE UPDATE ON tour_builder_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tour_quotes_set_updated_at
  BEFORE UPDATE ON tour_quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
