-- 20260716140000_reclassify_acquired_sf_participada.sql
-- Five acquired search funds were still classified 'Search Fund - Cerca' in
-- private_entities.vehicle_est (which overrides capital_calls.est in the client
-- mapper), so they were excluded from the Alternatius Resum companies matrix as
-- searcher/participada double counts. Road, Anval and Lexana already said
-- 'Search Fund - Participada' in capital_calls; Pleamar and Terra Firma said
-- Cerca in both places. Classification confirmed by Roberto 2026-07-16:
--   SF adquisició -> Road Capital, Anval Capital, Lexana Capital,
--                    Pleamar Partners, Terra Firma Capital
--   Hargrave Succession stays 'Search Fund - Cerca' (still searching; its
--   €100,519 ticket is over the shell heuristic threshold — handled in code by
--   classifying shells by vehicle_est instead of ticket size).

UPDATE public.private_entities
SET vehicle_est = 'Search Fund - Participada'
WHERE id IN (
  'B02852614',    -- Road Capital
  'B44736775',    -- Anval Capital
  'GBR14674050',  -- Lexana Capital
  'B72571920',    -- Pleamar Partners
  'B56436280'     -- Terra Firma Capital
)
  AND vehicle_est = 'Search Fund - Cerca';

UPDATE public.capital_calls
SET est = 'Search Fund - Participada'
WHERE vehicle_id IN (
  'B02852614', 'B44736775', 'GBR14674050', 'B72571920', 'B56436280'
)
  AND est = 'Search Fund - Cerca';
