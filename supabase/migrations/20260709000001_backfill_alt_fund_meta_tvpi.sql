-- 20260709000001_backfill_alt_fund_meta_tvpi.sql
-- A committed Alternatives vehicle's value equals its cost until real marks arrive,
-- so its baseline TVPI is 1.0. Historically new vehicles were created with tvpi=NULL,
-- which excludes them from the MOIC/IRR cohort matrix entirely. Backfill NULL TVPI to
-- 1.0 for ALT vehicles only — classified the same way the matrix now does, by the
-- earliest-dated Compromís row's est (see altCohortModel.summarizeAltFunds). New
-- vehicles get tvpi=1 on creation (db/funds.insertFund); this cleans up the existing
-- nulls. RE / Search Fund / Participada vehicles are intentionally left untouched.
WITH compromis AS (
  SELECT DISTINCT ON (vehicle_id) vehicle_id, TRIM(est) AS est
  FROM public.capital_calls
  WHERE cat = 'Compromís' AND NULLIF(TRIM(est), '') IS NOT NULL
  ORDER BY vehicle_id, data ASC NULLS LAST
),
alt AS (
  SELECT vehicle_id FROM compromis
  WHERE est = 'Fons Primari'
     OR est = 'Fons de Fons'
     OR est ILIKE 'Fons%Coinversi%'   -- Fons de Coinversió
     OR est ILIKE 'Coinversi%'
     OR est ILIKE 'Fons%Sec_ndari%'   -- Secundari / Secondari / (de) Secundaris variants
)
UPDATE public.fund_meta fm
SET tvpi = 1
FROM alt
WHERE fm.vehicle_id = alt.vehicle_id
  AND fm.tvpi IS NULL;
