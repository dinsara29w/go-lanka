-- Expiring PDF documents and quote-session lookup.
CREATE TABLE tour_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_session_id uuid REFERENCES ai_sessions(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  token_hash text NOT NULL,
  file_path text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tour_documents_token_unique UNIQUE (token_hash),
  CONSTRAINT tour_documents_token_shape CHECK (length(token_hash) = 64)
);

CREATE INDEX tour_documents_expiry_idx ON tour_documents (expires_at);

ALTER TABLE tour_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_tour_documents_all ON tour_documents
  FOR ALL TO golanka_admin USING (true) WITH CHECK (true);

CREATE FUNCTION get_tour_document(p_token_hash text)
RETURNS TABLE (file_path text, expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT d.file_path, d.expires_at
  FROM tour_documents d
  WHERE d.token_hash = p_token_hash
    AND d.expires_at > now()
  LIMIT 1;
$$;

CREATE FUNCTION get_ai_session_itinerary(p_session_id uuid)
RETURNS TABLE (itinerary jsonb, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT s.itinerary, s.created_at
  FROM ai_sessions s
  WHERE s.id = p_session_id
    AND s.itinerary IS NOT NULL
    AND s.created_at > now() - interval '7 days'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_tour_document(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_ai_session_itinerary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_tour_document(text) TO golanka_public;
GRANT EXECUTE ON FUNCTION get_ai_session_itinerary(uuid) TO golanka_public;
