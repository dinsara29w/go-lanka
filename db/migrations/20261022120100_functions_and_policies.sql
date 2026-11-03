-- Public write functions, RLS policies, and least-privilege grants.
-- RLS is enabled but not forced, so the migration owner can run
-- SECURITY DEFINER functions and seed data. Runtime roles are subject to RLS.

-- ---------------------------------------------------------------------------
-- Public functions
-- ---------------------------------------------------------------------------

CREATE FUNCTION check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_key IS NULL OR length(p_key) < 16 OR length(p_key) > 128 THEN
    RAISE EXCEPTION 'invalid_rate_limit_key' USING ERRCODE = 'P0001';
  END IF;
  IF p_limit < 1 OR p_limit > 100000 THEN
    RAISE EXCEPTION 'invalid_rate_limit' USING ERRCODE = 'P0001';
  END IF;
  IF p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid_rate_limit_window' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO rate_limits (key, window_start, count, expires_at)
  VALUES (p_key, now(), 1, now() + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN rate_limits.window_start <= now() - make_interval(secs => p_window_seconds) THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start <= now() - make_interval(secs => p_window_seconds) THEN now()
      ELSE rate_limits.window_start
    END,
    expires_at = CASE
      WHEN rate_limits.window_start <= now() - make_interval(secs => p_window_seconds)
        THEN now() + make_interval(secs => p_window_seconds)
      ELSE rate_limits.expires_at
    END
  RETURNING count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

CREATE FUNCTION get_public_availability(p_package_id uuid)
RETURNS TABLE (
  date date,
  capacity integer,
  booked integer,
  pending integer,
  remaining integer,
  status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    a.date,
    a.capacity,
    a.booked,
    COALESCE(SUM(b.adults + b.children) FILTER (WHERE b.status = 'new'), 0)::integer AS pending,
    GREATEST(
      a.capacity - a.booked - COALESCE(SUM(b.adults + b.children) FILTER (WHERE b.status = 'new'), 0),
      0
    )::integer AS remaining,
    CASE
      WHEN a.status = 'closed'
        OR a.capacity - a.booked - COALESCE(SUM(b.adults + b.children) FILTER (WHERE b.status = 'new'), 0) <= 0
        THEN 'closed'
      ELSE a.status::text
    END AS status
  FROM availability a
  LEFT JOIN bookings b
    ON b.package_id = a.package_id
   AND b.travel_date = a.date
   AND b.status = 'new'
  WHERE a.package_id = p_package_id
    AND a.date >= current_date
    AND EXISTS (
      SELECT 1 FROM packages p
      WHERE p.id = p_package_id AND p.is_published = true
    )
  GROUP BY a.id
  ORDER BY a.date;
$$;

CREATE FUNCTION get_approved_photo(p_photo_id uuid)
RETURNS TABLE (
  image_path text,
  alt_text text,
  caption text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT ps.image_path, ps.alt_text, ps.caption
  FROM photo_submissions ps
  WHERE ps.id = p_photo_id
    AND ps.status = 'approved';
$$;

CREATE FUNCTION create_booking(
  p_reference text,
  p_package_id uuid,
  p_type text,
  p_name text,
  p_email text,
  p_phone text,
  p_country text,
  p_travel_date date,
  p_adults integer,
  p_children integer,
  p_message text,
  p_custom_itinerary jsonb,
  p_currency text,
  p_idempotency_key text
)
RETURNS TABLE (
  booking_id uuid,
  booking_reference text,
  booking_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_existing bookings%ROWTYPE;
  v_availability availability%ROWTYPE;
  v_pending integer;
  v_party integer;
  v_id uuid;
BEGIN
  IF p_reference IS NULL OR p_reference !~ '^GL-[A-Z0-9]{6,20}$' THEN
    RAISE EXCEPTION 'invalid_reference' USING ERRCODE = 'P0001';
  END IF;
  IF p_type NOT IN ('package', 'custom') THEN
    RAISE EXCEPTION 'invalid_booking_type' USING ERRCODE = 'P0001';
  END IF;
  IF p_currency NOT IN ('LKR', 'USD', 'EUR', 'GBP') THEN
    RAISE EXCEPTION 'invalid_currency' USING ERRCODE = 'P0001';
  END IF;
  IF p_travel_date IS NULL OR p_travel_date < current_date THEN
    RAISE EXCEPTION 'invalid_travel_date' USING ERRCODE = 'P0001';
  END IF;
  IF p_adults IS NULL OR p_adults < 1 OR p_adults > 30
     OR p_children IS NULL OR p_children < 0 OR p_children > 20 THEN
    RAISE EXCEPTION 'invalid_party_size' USING ERRCODE = 'P0001';
  END IF;
  IF p_name IS NULL OR length(p_name) < 1 OR length(p_name) > 200 THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE = 'P0001';
  END IF;
  IF p_email IS NULL OR position('@' in p_email) < 2 OR length(p_email) > 320 THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = 'P0001';
  END IF;
  IF p_phone IS NULL OR length(p_phone) < 1 OR length(p_phone) > 50 THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = 'P0001';
  END IF;
  IF p_country IS NULL OR length(p_country) < 1 OR length(p_country) > 100 THEN
    RAISE EXCEPTION 'invalid_country' USING ERRCODE = 'P0001';
  END IF;
  IF p_message IS NOT NULL AND length(p_message) > 5000 THEN
    RAISE EXCEPTION 'invalid_message' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NOT NULL AND (length(p_idempotency_key) < 16 OR length(p_idempotency_key) > 128) THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = 'P0001';
  END IF;
  IF p_custom_itinerary IS NOT NULL AND jsonb_typeof(p_custom_itinerary) <> 'object' THEN
    RAISE EXCEPTION 'invalid_itinerary' USING ERRCODE = 'P0001';
  END IF;

  v_party := p_adults + p_children;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
    SELECT * INTO v_existing FROM bookings WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN QUERY SELECT v_existing.id, v_existing.reference, v_existing.status::text;
      RETURN;
    END IF;
  END IF;

  IF p_type = 'package' THEN
    IF p_package_id IS NULL THEN
      RAISE EXCEPTION 'package_required' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM packages WHERE id = p_package_id AND is_published = true) THEN
      RAISE EXCEPTION 'package_unavailable' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_availability
    FROM availability
    WHERE package_id = p_package_id AND date = p_travel_date
    FOR UPDATE;

    IF NOT FOUND OR v_availability.status = 'closed' THEN
      RAISE EXCEPTION 'date_unavailable' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(SUM(adults + children), 0)::integer
    INTO v_pending
    FROM bookings
    WHERE package_id = p_package_id
      AND travel_date = p_travel_date
      AND status = 'new';

    IF v_availability.capacity - v_availability.booked - v_pending < v_party THEN
      RAISE EXCEPTION 'date_unavailable' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO bookings (
    reference,
    package_id,
    type,
    name,
    email,
    phone,
    country,
    travel_date,
    adults,
    children,
    message,
    custom_itinerary,
    currency_shown,
    idempotency_key
  )
  VALUES (
    p_reference,
    CASE WHEN p_type = 'custom' THEN NULL ELSE p_package_id END,
    p_type::booking_type,
    p_name,
    p_email,
    p_phone,
    p_country,
    p_travel_date,
    p_adults,
    p_children,
    NULLIF(p_message, ''),
    CASE WHEN p_type = 'custom' THEN p_custom_itinerary ELSE NULL END,
    p_currency,
    p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL AND p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM bookings WHERE idempotency_key = p_idempotency_key;
    RETURN QUERY SELECT v_existing.id, v_existing.reference, v_existing.status::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT b.id, b.reference, b.status::text
  FROM bookings b
  WHERE b.id = v_id;
END;
$$;

CREATE FUNCTION submit_photo(
  p_image_path text,
  p_caption text,
  p_alt_text text,
  p_submitter_name text,
  p_consent_confirmed boolean,
  p_package_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_consent_confirmed IS NOT TRUE THEN
    RAISE EXCEPTION 'consent_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_image_path IS NULL OR length(p_image_path) < 1 OR length(p_image_path) > 500 THEN
    RAISE EXCEPTION 'invalid_image_path' USING ERRCODE = 'P0001';
  END IF;
  IF p_caption IS NOT NULL AND length(p_caption) > 1000 THEN
    RAISE EXCEPTION 'invalid_caption' USING ERRCODE = 'P0001';
  END IF;
  IF p_alt_text IS NOT NULL AND length(p_alt_text) > 500 THEN
    RAISE EXCEPTION 'invalid_alt_text' USING ERRCODE = 'P0001';
  END IF;
  IF p_submitter_name IS NOT NULL AND length(p_submitter_name) > 200 THEN
    RAISE EXCEPTION 'invalid_submitter_name' USING ERRCODE = 'P0001';
  END IF;
  IF p_package_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM packages WHERE id = p_package_id AND is_published = true
  ) THEN
    RAISE EXCEPTION 'package_unavailable' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO photo_submissions (
    image_path,
    caption,
    alt_text,
    submitter_name,
    consent_confirmed,
    package_id
  )
  VALUES (
    p_image_path,
    NULLIF(p_caption, ''),
    NULLIF(p_alt_text, ''),
    NULLIF(p_submitter_name, ''),
    true,
    p_package_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin functions
-- ---------------------------------------------------------------------------

CREATE FUNCTION confirm_booking(
  p_booking_id uuid,
  p_actor_id uuid,
  p_ip_hash text,
  p_user_agent_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_availability availability%ROWTYPE;
  v_party integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = p_actor_id AND is_active = true AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_booking.status = 'confirmed' THEN
    RETURN;
  END IF;
  IF v_booking.status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'invalid_status_transition' USING ERRCODE = 'P0001';
  END IF;

  v_party := v_booking.adults + v_booking.children;

  IF v_booking.type = 'package' AND v_booking.package_id IS NOT NULL THEN
    SELECT * INTO v_availability
    FROM availability
    WHERE package_id = v_booking.package_id AND date = v_booking.travel_date
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'availability_missing' USING ERRCODE = 'P0001';
    END IF;
    IF v_availability.booked + v_party > v_availability.capacity THEN
      RAISE EXCEPTION 'capacity_exceeded' USING ERRCODE = 'P0001';
    END IF;

    UPDATE availability
    SET booked = booked + v_party
    WHERE id = v_availability.id;
  END IF;

  UPDATE bookings
  SET status = 'confirmed'
  WHERE id = p_booking_id;

  INSERT INTO admin_audit_log (
    actor_id, action, entity_type, entity_id, ip_hash, user_agent_hash, metadata
  )
  VALUES (
    p_actor_id,
    'booking.confirm',
    'booking',
    p_booking_id::text,
    p_ip_hash,
    p_user_agent_hash,
    jsonb_build_object('reference', v_booking.reference)
  );
END;
$$;

CREATE FUNCTION cancel_booking(
  p_booking_id uuid,
  p_actor_id uuid,
  p_ip_hash text,
  p_user_agent_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_availability availability%ROWTYPE;
  v_party integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = p_actor_id AND is_active = true AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_booking.status = 'cancelled' THEN
    RETURN;
  END IF;
  IF v_booking.status = 'completed' THEN
    RAISE EXCEPTION 'invalid_status_transition' USING ERRCODE = 'P0001';
  END IF;

  v_party := v_booking.adults + v_booking.children;

  IF v_booking.status = 'confirmed'
     AND v_booking.type = 'package'
     AND v_booking.package_id IS NOT NULL THEN
    SELECT * INTO v_availability
    FROM availability
    WHERE package_id = v_booking.package_id AND date = v_booking.travel_date
    FOR UPDATE;

    IF FOUND THEN
      UPDATE availability
      SET booked = GREATEST(booked - v_party, 0)
      WHERE id = v_availability.id;
    END IF;
  END IF;

  UPDATE bookings
  SET status = 'cancelled'
  WHERE id = p_booking_id;

  INSERT INTO admin_audit_log (
    actor_id, action, entity_type, entity_id, ip_hash, user_agent_hash, metadata
  )
  VALUES (
    p_actor_id,
    'booking.cancel',
    'booking',
    p_booking_id::text,
    p_ip_hash,
    p_user_agent_hash,
    jsonb_build_object('reference', v_booking.reference)
  );
END;
$$;

CREATE FUNCTION cleanup_expired()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rate_limits integer;
  v_sessions integer;
  v_tokens integer;
  v_recovery_codes integer;
  v_ai_sessions integer;
  v_audit_rows integer;
BEGIN
  DELETE FROM rate_limits WHERE expires_at < now();
  GET DIAGNOSTICS v_rate_limits = ROW_COUNT;

  DELETE FROM admin_sessions
  WHERE absolute_expires_at < now() - interval '7 days'
     OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days');
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  DELETE FROM admin_password_tokens
  WHERE (expires_at < now() - interval '7 days')
     OR (used_at IS NOT NULL AND used_at < now() - interval '7 days');
  GET DIAGNOSTICS v_tokens = ROW_COUNT;

  DELETE FROM admin_mfa_recovery_codes
  WHERE used_at IS NOT NULL AND used_at < now() - interval '30 days';
  GET DIAGNOSTICS v_recovery_codes = ROW_COUNT;

  DELETE FROM ai_sessions WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_ai_sessions = ROW_COUNT;

  DELETE FROM admin_audit_log WHERE created_at < now() - interval '365 days';
  GET DIAGNOSTICS v_audit_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'rate_limits', v_rate_limits,
    'sessions', v_sessions,
    'password_tokens', v_tokens,
    'recovery_codes', v_recovery_codes,
    'ai_sessions', v_ai_sessions,
    'audit_rows', v_audit_rows
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_password_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_info_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Public read policies.
CREATE POLICY public_packages_read ON packages
  FOR SELECT TO golanka_public USING (is_published = true);
CREATE POLICY public_destinations_read ON destinations
  FOR SELECT TO golanka_public USING (true);
CREATE POLICY public_package_destinations_read ON package_destinations
  FOR SELECT TO golanka_public USING (
    EXISTS (SELECT 1 FROM packages p WHERE p.id = package_id AND p.is_published = true)
  );
CREATE POLICY public_itinerary_read ON itinerary_days
  FOR SELECT TO golanka_public USING (
    EXISTS (SELECT 1 FROM packages p WHERE p.id = package_id AND p.is_published = true)
  );
CREATE POLICY public_reviews_read ON reviews
  FOR SELECT TO golanka_public USING (is_published = true);
CREATE POLICY public_travel_info_read ON travel_info_sections
  FOR SELECT TO golanka_public USING (is_published = true);
CREATE POLICY public_site_settings_read ON site_settings
  FOR SELECT TO golanka_public USING (true);
CREATE POLICY public_exchange_rates_read ON exchange_rates
  FOR SELECT TO golanka_public USING (true);

-- Auth role policies.
CREATE POLICY auth_admin_users_read ON admin_users
  FOR SELECT TO golanka_auth USING (true);
CREATE POLICY auth_admin_users_update ON admin_users
  FOR UPDATE TO golanka_auth USING (true) WITH CHECK (true);
CREATE POLICY auth_sessions_all ON admin_sessions
  FOR ALL TO golanka_auth USING (true) WITH CHECK (true);
CREATE POLICY auth_password_tokens_all ON admin_password_tokens
  FOR ALL TO golanka_auth USING (true) WITH CHECK (true);
CREATE POLICY auth_recovery_codes_all ON admin_mfa_recovery_codes
  FOR ALL TO golanka_auth USING (true) WITH CHECK (true);
CREATE POLICY auth_audit_read ON admin_audit_log
  FOR SELECT TO golanka_auth USING (true);
CREATE POLICY auth_audit_insert ON admin_audit_log
  FOR INSERT TO golanka_auth WITH CHECK (true);

-- Admin role policies.
CREATE POLICY admin_packages_all ON packages
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_destinations_all ON destinations
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_package_destinations_all ON package_destinations
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_itinerary_all ON itinerary_days
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_availability_all ON availability
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_bookings_all ON bookings
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_reviews_all ON reviews
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_photos_all ON photo_submissions
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_exchange_rates_all ON exchange_rates
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_site_settings_all ON site_settings
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_travel_info_all ON travel_info_sections
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_users_read ON admin_users
  FOR SELECT TO golanka_admin USING (true);
CREATE POLICY admin_users_insert ON admin_users
  FOR INSERT TO golanka_admin WITH CHECK (true);
CREATE POLICY admin_users_update ON admin_users
  FOR UPDATE TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_sessions_read ON admin_sessions
  FOR SELECT TO golanka_admin USING (true);
CREATE POLICY admin_sessions_update ON admin_sessions
  FOR UPDATE TO golanka_admin USING (true) WITH CHECK (true);
CREATE POLICY admin_audit_read ON admin_audit_log
  FOR SELECT TO golanka_admin USING (true);
CREATE POLICY admin_audit_insert ON admin_audit_log
  FOR INSERT TO golanka_admin WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

GRANT USAGE ON TYPE admin_role, admin_token_purpose, booking_type, booking_status, availability_status, photo_status
  TO golanka_public, golanka_auth, golanka_admin;

GRANT SELECT ON destinations, packages, package_destinations, itinerary_days, reviews,
  travel_info_sections, site_settings, exchange_rates
  TO golanka_public;

GRANT SELECT (
  id, email, password_hash, role, is_active, mfa_secret_encrypted, mfa_enabled,
  mfa_last_used_step, failed_login_count, locked_until, last_login_at,
  password_changed_at, created_at, updated_at
) ON admin_users TO golanka_auth;
GRANT UPDATE (
  password_hash, mfa_secret_encrypted, mfa_enabled, mfa_last_used_step,
  failed_login_count, locked_until, last_login_at, password_changed_at, updated_at
) ON admin_users TO golanka_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_sessions TO golanka_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_password_tokens TO golanka_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_mfa_recovery_codes TO golanka_auth;
GRANT SELECT, INSERT ON admin_audit_log TO golanka_auth;

GRANT SELECT, INSERT, UPDATE, DELETE ON destinations, packages, package_destinations,
  itinerary_days, availability, reviews, photo_submissions, travel_info_sections
  TO golanka_admin;
GRANT SELECT, INSERT, UPDATE ON bookings TO golanka_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON site_settings, exchange_rates TO golanka_admin;
GRANT SELECT, INSERT, UPDATE ON admin_users TO golanka_admin;
GRANT SELECT, UPDATE ON admin_sessions TO golanka_admin;
GRANT SELECT, INSERT ON admin_audit_log TO golanka_admin;

-- Function execution.
REVOKE ALL ON FUNCTION check_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_public_availability(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_approved_photo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_booking(text, uuid, text, text, text, text, text, date, integer, integer, text, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_photo(text, text, text, text, boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION confirm_booking(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_booking(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_expired() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION check_rate_limit(text, integer, integer) TO golanka_public, golanka_auth;
GRANT EXECUTE ON FUNCTION get_public_availability(uuid) TO golanka_public;
GRANT EXECUTE ON FUNCTION get_approved_photo(uuid) TO golanka_public;
GRANT EXECUTE ON FUNCTION create_booking(text, uuid, text, text, text, text, text, date, integer, integer, text, jsonb, text, text) TO golanka_public;
GRANT EXECUTE ON FUNCTION submit_photo(text, text, text, text, boolean, uuid) TO golanka_public;
GRANT EXECUTE ON FUNCTION confirm_booking(uuid, uuid, text, text) TO golanka_admin;
GRANT EXECUTE ON FUNCTION cancel_booking(uuid, uuid, text, text) TO golanka_admin;
GRANT EXECUTE ON FUNCTION cleanup_expired() TO golanka_admin;
