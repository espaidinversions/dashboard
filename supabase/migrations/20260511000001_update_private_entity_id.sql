CREATE OR REPLACE FUNCTION public.update_private_entity_id(
  p_old_id TEXT,
  p_new_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superuser() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF COALESCE(length(trim(p_old_id)), 0) = 0 THEN
    RAISE EXCEPTION 'Old id required';
  END IF;

  IF COALESCE(length(trim(p_new_id)), 0) = 0 THEN
    RAISE EXCEPTION 'New id required';
  END IF;

  UPDATE public.private_entities
  SET id         = trim(p_new_id),
      updated_at = now()
  WHERE id = p_old_id;
END;
$$;
