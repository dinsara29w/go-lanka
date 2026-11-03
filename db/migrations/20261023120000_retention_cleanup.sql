-- Retention cleanup for generated itinerary documents.
--
-- tour_documents rows are only reachable through SECURITY DEFINER functions, so
-- expired rows are deleted here and the file paths are returned to the caller so
-- the application can unlink the private PDFs from disk.

CREATE FUNCTION cleanup_expired_documents(p_limit integer DEFAULT 500)
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  DELETE FROM tour_documents
  WHERE id IN (
    SELECT id
    FROM tour_documents
    WHERE expires_at < now() - interval '1 day'
    ORDER BY expires_at
    LIMIT LEAST(GREATEST(p_limit, 1), 5000)
  )
  RETURNING file_path;
$$;

REVOKE ALL ON FUNCTION cleanup_expired_documents(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_documents(integer) TO golanka_admin;
