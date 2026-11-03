-- Initial schema for the custom Go Lanka backend.
-- Roles are provisioned outside migrations by db/bootstrap.local.sql (local)
-- or the equivalent production bootstrap procedure.

CREATE TYPE admin_role AS ENUM ('owner', 'admin');
CREATE TYPE admin_token_purpose AS ENUM ('reset', 'invite');
CREATE TYPE booking_type AS ENUM ('package', 'custom');
CREATE TYPE booking_status AS ENUM ('new', 'confirmed', 'cancelled', 'completed');
CREATE TYPE availability_status AS ENUM ('open', 'limited', 'closed');
CREATE TYPE photo_status AS ENUM ('pending', 'approved', 'rejected');

CREATE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin identity and security
-- ---------------------------------------------------------------------------

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  role admin_role NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true,
  mfa_secret_encrypted text,
  mfa_enabled boolean NOT NULL DEFAULT false,
  mfa_last_used_step bigint,
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_email_shape CHECK (position('@' in email) > 1)
);

CREATE UNIQUE INDEX admin_users_email_lower_unique ON admin_users (lower(email));
CREATE INDEX admin_users_role_active_idx ON admin_users (role, is_active);

CREATE TABLE admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  csrf_token_hash text NOT NULL,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT admin_sessions_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT admin_sessions_token_hash_shape CHECK (length(token_hash) = 64),
  CONSTRAINT admin_sessions_csrf_hash_shape CHECK (length(csrf_token_hash) = 64)
);

CREATE INDEX admin_sessions_admin_idx ON admin_sessions (admin_user_id);
CREATE INDEX admin_sessions_expiry_idx ON admin_sessions (expires_at, absolute_expires_at);

CREATE TABLE admin_password_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  purpose admin_token_purpose NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  requested_ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_password_tokens_hash_unique UNIQUE (token_hash),
  CONSTRAINT admin_password_tokens_hash_shape CHECK (length(token_hash) = 64)
);

CREATE INDEX admin_password_tokens_expiry_idx ON admin_password_tokens (expires_at);

CREATE TABLE admin_mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_mfa_recovery_codes_hash_shape CHECK (length(code_hash) = 64)
);

CREATE INDEX admin_mfa_recovery_codes_admin_idx ON admin_mfa_recovery_codes (admin_user_id);

CREATE TABLE admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_log_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX admin_audit_log_actor_time_idx ON admin_audit_log (actor_id, created_at DESC);
CREATE INDEX admin_audit_log_action_time_idx ON admin_audit_log (action, created_at DESC);

-- ---------------------------------------------------------------------------
-- Public catalogue
-- ---------------------------------------------------------------------------

CREATE TABLE destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  region text NOT NULL,
  description text NOT NULL,
  hero_image text,
  hero_image_alt text,
  map_region_id text NOT NULL,
  lat numeric(9, 6),
  lng numeric(9, 6),
  best_season text,
  highlights text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT destinations_slug_unique UNIQUE (slug),
  CONSTRAINT destinations_slug_shape CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug) <= 120),
  CONSTRAINT destinations_lat_range CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  CONSTRAINT destinations_lng_range CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180))
);

CREATE INDEX destinations_map_region_idx ON destinations (map_region_id);

CREATE TABLE packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  summary text NOT NULL,
  duration_days integer NOT NULL,
  base_price_lkr numeric(12, 2) NOT NULL,
  activities text[] NOT NULL DEFAULT '{}',
  hero_image text,
  hero_image_alt text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  inclusions text[] NOT NULL DEFAULT '{}',
  exclusions text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT packages_slug_unique UNIQUE (slug),
  CONSTRAINT packages_slug_shape CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug) <= 120),
  CONSTRAINT packages_duration_positive CHECK (duration_days > 0 AND duration_days <= 60),
  CONSTRAINT packages_price_nonnegative CHECK (base_price_lkr >= 0),
  CONSTRAINT packages_gallery_array CHECK (jsonb_typeof(gallery) = 'array')
);

CREATE INDEX packages_published_featured_idx ON packages (is_published, featured);
CREATE INDEX packages_published_idx ON packages (is_published);

CREATE TABLE package_destinations (
  package_id uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  PRIMARY KEY (package_id, destination_id)
);

CREATE INDEX package_destinations_destination_idx ON package_destinations (destination_id);

CREATE TABLE itinerary_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  day_number integer NOT NULL CHECK (day_number > 0 AND day_number <= 60),
  title text NOT NULL,
  description text NOT NULL,
  destination_id uuid REFERENCES destinations(id) ON DELETE SET NULL,
  accommodation text,
  meals text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itinerary_days_package_day_unique UNIQUE (package_id, day_number)
);

CREATE INDEX itinerary_days_destination_idx ON itinerary_days (destination_id);

CREATE TABLE availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  date date NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0 AND capacity <= 1000),
  booked integer NOT NULL DEFAULT 0 CHECK (booked >= 0),
  status availability_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_package_date_unique UNIQUE (package_id, date),
  CONSTRAINT availability_booked_within_capacity CHECK (booked <= capacity)
);

CREATE INDEX availability_package_date_idx ON availability (package_id, date);
CREATE INDEX availability_future_idx ON availability (date) WHERE status <> 'closed';

-- ---------------------------------------------------------------------------
-- Bookings, reviews, photos, AI, content settings
-- ---------------------------------------------------------------------------

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  package_id uuid REFERENCES packages(id) ON DELETE SET NULL,
  type booking_type NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  country text NOT NULL,
  travel_date date NOT NULL,
  adults integer NOT NULL CHECK (adults >= 1 AND adults <= 30),
  children integer NOT NULL DEFAULT 0 CHECK (children >= 0 AND children <= 20),
  message text,
  custom_itinerary jsonb,
  status booking_status NOT NULL DEFAULT 'new',
  currency_shown text NOT NULL DEFAULT 'LKR',
  quoted_total numeric(12, 2),
  admin_notes text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_reference_unique UNIQUE (reference),
  CONSTRAINT bookings_idempotency_unique UNIQUE (idempotency_key),
  CONSTRAINT bookings_currency_valid CHECK (currency_shown IN ('LKR', 'USD', 'EUR', 'GBP')),
  CONSTRAINT bookings_quoted_total_nonnegative CHECK (quoted_total IS NULL OR quoted_total >= 0),
  CONSTRAINT bookings_custom_itinerary_object CHECK (custom_itinerary IS NULL OR jsonb_typeof(custom_itinerary) = 'object')
);

CREATE INDEX bookings_status_idx ON bookings (status);
CREATE INDEX bookings_travel_date_idx ON bookings (travel_date);
CREATE INDEX bookings_package_date_idx ON bookings (package_id, travel_date);
CREATE INDEX bookings_created_idx ON bookings (created_at DESC);

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  country text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  body text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reviews_package_published_idx ON reviews (package_id, is_published);
CREATE INDEX reviews_published_idx ON reviews (is_published, created_at DESC);

CREATE TABLE photo_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid REFERENCES packages(id) ON DELETE SET NULL,
  image_path text NOT NULL,
  caption text,
  alt_text text,
  submitter_name text,
  consent_confirmed boolean NOT NULL DEFAULT false,
  status photo_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX photo_submissions_status_idx ON photo_submissions (status, created_at DESC);
CREATE INDEX photo_submissions_package_idx ON photo_submissions (package_id);

CREATE TABLE exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base text NOT NULL DEFAULT 'LKR',
  usd numeric(18, 8) NOT NULL CHECK (usd > 0),
  eur numeric(18, 8) NOT NULL CHECK (eur > 0),
  gbp numeric(18, 8) NOT NULL CHECK (gbp > 0),
  fetched_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exchange_rates_base_lkr CHECK (base = 'LKR')
);

CREATE INDEX exchange_rates_fetched_idx ON exchange_rates (fetched_at DESC);

CREATE TABLE ai_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_answers jsonb NOT NULL,
  itinerary jsonb,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_sessions_quiz_object CHECK (jsonb_typeof(quiz_answers) = 'object'),
  CONSTRAINT ai_sessions_itinerary_object CHECK (itinerary IS NULL OR jsonb_typeof(itinerary) = 'object')
);

CREATE INDEX ai_sessions_created_idx ON ai_sessions (created_at DESC);

CREATE TABLE site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true,
  whatsapp_number text,
  contact_email text,
  phone text,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton_true CHECK (singleton),
  CONSTRAINT site_settings_singleton_unique UNIQUE (singleton),
  CONSTRAINT site_settings_socials_object CHECK (jsonb_typeof(socials) = 'object')
);

CREATE TABLE travel_info_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  summary text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT travel_info_sections_slug_unique UNIQUE (slug),
  CONSTRAINT travel_info_sections_slug_shape CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug) <= 120),
  CONSTRAINT travel_info_sections_content_object CHECK (jsonb_typeof(content) = 'object'),
  CONSTRAINT travel_info_sections_faqs_array CHECK (jsonb_typeof(faqs) = 'array')
);

CREATE INDEX travel_info_sections_published_sort_idx ON travel_info_sections (is_published, sort_order);

-- ---------------------------------------------------------------------------
-- Internal rate limiting
-- ---------------------------------------------------------------------------

CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0),
  expires_at timestamptz NOT NULL
);

CREATE INDEX rate_limits_expiry_idx ON rate_limits (expires_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'admin_users',
    'destinations',
    'packages',
    'itinerary_days',
    'availability',
    'bookings',
    'reviews',
    'photo_submissions',
    'ai_sessions',
    'site_settings',
    'travel_info_sections'
  ]
  LOOP
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', table_name, table_name);
  END LOOP;
END;
$$;
