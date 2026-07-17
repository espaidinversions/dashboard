-- 20260717090000_harmonize_ibv_legacy_carpathia.sql
-- Three rulings confirmed by Roberto 2026-07-17 after the Q2'26 snapshot
-- reconciliation (02. Snapshot SFs/260629_Seguiment_SearchFunds.xlsx):
--
-- 1. IBV (workbook project name) IS Grupo FIRE / Ítaca Fire Coinvest. Link the
--    searchers row and record the workbook name on the entity so future
--    workbook imports map it instead of recreating the gap.
-- 2. Quo Inversión and Renovatio Capital have the same profile as the other
--    legacy searchers (cerca exitosa, Turtle did not follow into the
--    acquisition: KG, Konkordia, Oportuna, Phoenix Rise, Preludio) but were
--    not flagged legacy. Harmonize.
-- 3. Carpathia Capital is an independent sponsor (not a search fund searcher,
--    hence absent from the workbook Master): €65k paid for access to its
--    deals (Baluard — tracked as its own Participada — APC, and one more to
--    come). Its vehicle_est is 'Search Fund - Cerca' which overrides est in
--    the client, but two raw capital_calls rows still said 'Participada
--    (Altres)'. Align raw rows with vehicle_est.
--    NOTE: the APC deal has no capital_calls/portfolio_companies record yet.

UPDATE public.searchers
SET companyia_adquirida = 'Grupo FIRE'
WHERE nom = 'IBV' AND companyia_adquirida IS NULL;

UPDATE public.private_entities
SET workbook_name = 'IBV'
WHERE id = 'MOCKNIF:COMPANY:ÍTACA_FIRE_COINVEST' AND workbook_name IS NULL;

UPDATE public.searchers
SET is_legacy = true
WHERE nom IN ('Quo Inversión', 'Renovatio Capital') AND is_legacy = false;

UPDATE public.capital_calls
SET est = 'Search Fund - Cerca'
WHERE vehicle_id = 'B88595277'  -- Carpathia Capital
  AND est = 'Participada (Altres)';
