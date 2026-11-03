-- Public metadata for approved UGC photos. Image bytes are served only through
-- an application route that rechecks approval status.
CREATE FUNCTION list_approved_photos(p_package_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  caption text,
  alt_text text,
  package_id uuid,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT ps.id, ps.caption, ps.alt_text, ps.package_id, ps.created_at
  FROM photo_submissions ps
  WHERE ps.status = 'approved'
    AND (p_package_id IS NULL OR ps.package_id = p_package_id)
  ORDER BY ps.created_at DESC;
$$;

REVOKE ALL ON FUNCTION list_approved_photos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_approved_photos(uuid) TO golanka_public;
