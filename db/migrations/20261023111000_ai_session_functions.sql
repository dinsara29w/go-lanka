-- Public AI route writes are constrained to these functions.
CREATE FUNCTION create_ai_session(
  p_quiz_answers jsonb,
  p_itinerary jsonb,
  p_ip_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_quiz_answers IS NULL OR jsonb_typeof(p_quiz_answers) <> 'object' THEN
    RAISE EXCEPTION 'invalid_quiz' USING ERRCODE = 'P0001';
  END IF;
  IF p_itinerary IS NULL OR jsonb_typeof(p_itinerary) <> 'object' THEN
    RAISE EXCEPTION 'invalid_itinerary' USING ERRCODE = 'P0001';
  END IF;
  IF p_ip_hash IS NULL OR length(p_ip_hash) < 32 THEN
    RAISE EXCEPTION 'invalid_ip_hash' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO ai_sessions (quiz_answers, itinerary, ip_hash)
  VALUES (p_quiz_answers, p_itinerary, p_ip_hash)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE FUNCTION create_tour_document(
  p_ai_session_id uuid,
  p_token_hash text,
  p_file_path text,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RAISE EXCEPTION 'invalid_token_hash' USING ERRCODE = 'P0001';
  END IF;
  IF p_file_path IS NULL OR length(p_file_path) < 1 THEN
    RAISE EXCEPTION 'invalid_file_path' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO tour_documents (ai_session_id, token_hash, file_path, expires_at)
  VALUES (p_ai_session_id, p_token_hash, p_file_path, p_expires_at)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION create_ai_session(jsonb, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_tour_document(uuid, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_ai_session(jsonb, jsonb, text) TO golanka_public;
GRANT EXECUTE ON FUNCTION create_tour_document(uuid, text, text, timestamptz) TO golanka_public;
