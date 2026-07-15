-- 20260715120000_reclassify_company_held_sf_capital_calls.sql
-- Search fund deals held via company entities were imported by the company
-- path (cc_import / startups_import), which defaults est to 'Participada
-- (Altres)', so they never appear in the Search Funds section (the dashboard
-- buckets rows by est — capitalCallStrategyModel.js). sf_import.mjs skips
-- company-resolved rows, so its SF_FONS_ALLOCATION never reclassified them.
-- Classification confirmed row by row by Roberto 2026-07-15:
--   CW Group (6 rows), Grupo FIRE / Ítaca Fire Coinvest (3), Alfavet / ASF
--   Pharma (2) -> 'Search Fund - Participada'
--   Alpha Nova Capital (1, searcher ticket 2026-03-30) -> 'Search Fund - Cerca'
--   Greenfarm stays 'Participada (Altres)' (reviewed, not a search fund).
-- Entity classification (private_entities.vehicle_est) is aligned in the same
-- pass so section filters, matrix, and searchers views agree (same pattern as
-- 20260709000000_reclassify_olta_search_fund.sql). Alpha Nova's entity is
-- already 'Search Fund - Cerca'; only its capital_calls row was stale.
UPDATE public.capital_calls
SET est = 'Search Fund - Participada'
WHERE fons IN ('CW Group', 'Grupo FIRE', 'Alfavet')
  AND est = 'Participada (Altres)';

UPDATE public.capital_calls
SET est = 'Search Fund - Cerca'
WHERE fons = 'Alpha Nova Capital'
  AND est = 'Participada (Altres)';

UPDATE public.private_entities
SET vehicle_est = 'Search Fund - Participada'
WHERE id IN ('FRA948147871', 'MOCKNIF:COMPANY:ÍTACA_FIRE_COINVEST', 'B75554824')
  AND vehicle_est = 'Participada (Altres)';
