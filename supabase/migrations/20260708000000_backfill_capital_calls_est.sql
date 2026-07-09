-- 20260708000000_backfill_capital_calls_est.sql
-- Materialize the resolved "Tipus de Vehicle" into capital_calls.est for rows that
-- have none, sourcing from private_entities.vehicle_est. After this the est column is
-- self-contained and no longer depends on fund_meta.vehicle_tipus for resolution.
UPDATE public.capital_calls cc
SET est = pe.vehicle_est
FROM public.private_entities pe
WHERE pe.id = cc.vehicle_id
  AND NULLIF(TRIM(cc.est), '') IS NULL
  AND NULLIF(TRIM(pe.vehicle_est), '') IS NOT NULL;
