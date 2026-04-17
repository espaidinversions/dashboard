-- Migration: convert unresolved private-entity fallback IDs into explicit mock IDs
-- 2026-04-16 19:30

do $$
begin
  update public.private_entities
  set id = 'MOCKNIF:' || id,
      updated_at = now()
  where id like 'COMPANY:%'
     or id like 'VEHICLE:%';
end
$$;
