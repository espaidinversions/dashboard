-- Add NIF field to private_entities
ALTER TABLE private_entities ADD COLUMN IF NOT EXISTS nif TEXT;

-- Update NIF on a private entity (superuser only)
CREATE OR REPLACE FUNCTION public.update_private_entity_nif(
  p_id  TEXT,
  p_nif TEXT
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

  IF COALESCE(length(trim(p_id)), 0) = 0 THEN
    RAISE EXCEPTION 'Entity id required';
  END IF;

  UPDATE public.private_entities
  SET nif       = NULLIF(trim(p_nif), ''),
      updated_at = now()
  WHERE id = p_id;
END;
$$;
