-- 20260729090000_reclassify_vehicle_est_fund_types.sql
-- Corrects private_entities.vehicle_est (the entity-level fund class that
-- OVERRIDES capital_calls.est in the client mapper, src/data/mappers.js:146,
-- and therefore drives the dashboard's classification) for vehicles whose
-- class was wrong or missing. Surfaced by scripts/classification_audit.sql;
-- classifications confirmed by Roberto 2026-07-29.
--
-- Rulings:
--   * Co-invest funds mislabelled 'Fons Primari' -> 'Fons de Coinversió':
--       Pantheon Co-inv, Pictet Co-Inv IV, Pictet Monte Rosa Co-invest. V,
--       Arcano PE Co-Investments 2024 SCR
--   * FASO VI              -> 'Fons Secundari' (was 'Fons Primari')
--   * RCP Fund XXI         -> 'Fons de Fons'   (was 'Fons Primari')
--   * Arcano PE Investments 2022 SCR SA -> 'Fons de Fons' (was 'Fons Secundari')
--   * Leon Ventures        -> 'Search Fund - Cerca' (was NULL; it is a cerca
--                             search fund, so vehicle_est drives its class)
--
-- Deliberately NOT touched: transaction-level capital_calls.est. Per Roberto,
-- "a FoF can have coinvestments" — the transaction est is meaningful underlying
-- deal metadata, not noise, and vehicle_est already governs the dashboard class.
-- Also unchanged (already correct at entity level): JP Morgan Vintage 2018/2020/
-- 2022, Altamar X Midmarket, MPEP V Europe (all Fons de Fons); Qualitas Direct
-- III, Capital Dynamics Mid-Market Direct VI (Fons de Coinversió); T2 Energy
-- (Fons Primari).

-- Co-invest funds -> Fons de Coinversió
UPDATE public.private_entities
SET vehicle_est = 'Fons de Coinversió'
WHERE id IN (
  'V88472410',   -- Pantheon Co-inv
  'LUX0000003',  -- Pictet Co-Inv IV
  'LUX0000002',  -- Pictet Monte Rosa Co-invest. V
  'A19792852'    -- Arcano PE Co-Investments 2024 SCR
)
  AND kind = 'vehicle'
  AND vehicle_est = 'Fons Primari';

-- FASO VI -> Fons Secundari
UPDATE public.private_entities
SET vehicle_est = 'Fons Secundari'
WHERE id = 'LUXB143757'  -- FASO VI SCSp
  AND kind = 'vehicle'
  AND vehicle_est = 'Fons Primari';

-- RCP Fund XXI -> Fons de Fons
UPDATE public.private_entities
SET vehicle_est = 'Fons de Fons'
WHERE id = 'MOCKNIF:VEHICLE:RCP-FUND-XXI-EU-SCSP'  -- RCP Fund XXI (EU) SCSp
  AND kind = 'vehicle'
  AND vehicle_est = 'Fons Primari';

-- Arcano PE Investments 2022 -> Fons de Fons
UPDATE public.private_entities
SET vehicle_est = 'Fons de Fons'
WHERE id = 'A10813137'  -- Arcano PE Investments 2022 SCR SA
  AND kind = 'vehicle'
  AND vehicle_est = 'Fons Secundari';

-- Leon Ventures -> Search Fund - Cerca (backfill from NULL)
UPDATE public.private_entities
SET vehicle_est = 'Search Fund - Cerca'
WHERE id = 'MOCKNIF:VEHICLE:LEON-VENTURES'  -- Leon Ventures
  AND kind = 'vehicle'
  AND vehicle_est IS NULL;
