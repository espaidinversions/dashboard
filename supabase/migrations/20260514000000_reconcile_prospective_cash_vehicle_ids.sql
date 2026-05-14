-- Reconcile prospective_cash_forecasts: replace MOCKNIF vehicle_ids with real ones
-- where a real private_entity with the same canonical_name already exists in the DB.

UPDATE prospective_cash_forecasts pcf
SET vehicle_id = pe_real.id,
    updated_at = now()
FROM private_entities pe_mock
JOIN private_entities pe_real
  ON pe_real.canonical_name = pe_mock.canonical_name
  AND pe_real.id NOT LIKE 'MOCKNIF:%'
WHERE pcf.vehicle_id = pe_mock.id
  AND pe_mock.id LIKE 'MOCKNIF:%';

-- Remove orphaned MOCKNIF private_entities entries that now have a real duplicate
-- and are no longer referenced by any prospective_cash_forecasts row.
DELETE FROM private_entities
WHERE id LIKE 'MOCKNIF:%'
  AND canonical_name IN (
    SELECT canonical_name FROM private_entities WHERE id NOT LIKE 'MOCKNIF:%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM prospective_cash_forecasts WHERE vehicle_id = private_entities.id
  );
