-- 20260709000000_reclassify_olta_search_fund.sql
-- Olta Nachfolge is a search-fund company, not an Alternatives fund vehicle. Its
-- private_entities.vehicle_est is already "Search Fund - Cerca" (kind='company'),
-- but its capital_calls row was mis-tagged est='Fons Primari'. Because
-- normalizeCapitalCallStrategy trusts an already-canonical est verbatim, that stale
-- tag kept Olta inside the ALT set. Align the transaction est with the entity so it
-- classifies as a search fund everywhere (matrix, section filters, searchers view).
UPDATE public.capital_calls cc
SET est = pe.vehicle_est
FROM public.private_entities pe
WHERE pe.id = cc.vehicle_id
  AND cc.vehicle_id = 'MOCKNIF:VEHICLE:OLTA-NACHFOLGE'
  AND pe.vehicle_est = 'Search Fund - Cerca'
  AND cc.est = 'Fons Primari';
