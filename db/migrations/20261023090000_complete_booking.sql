-- Completing a confirmed booking is a distinct admin transition and is audited.
CREATE FUNCTION complete_booking(
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
  IF v_booking.status = 'completed' THEN
    RETURN;
  END IF;
  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'invalid_status_transition' USING ERRCODE = 'P0001';
  END IF;

  UPDATE bookings SET status = 'completed' WHERE id = p_booking_id;

  INSERT INTO admin_audit_log (
    actor_id, action, entity_type, entity_id, ip_hash, user_agent_hash, metadata
  )
  VALUES (
    p_actor_id,
    'booking.complete',
    'booking',
    p_booking_id::text,
    p_ip_hash,
    p_user_agent_hash,
    jsonb_build_object('reference', v_booking.reference)
  );
END;
$$;

REVOKE ALL ON FUNCTION complete_booking(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_booking(uuid, uuid, text, text) TO golanka_admin;
