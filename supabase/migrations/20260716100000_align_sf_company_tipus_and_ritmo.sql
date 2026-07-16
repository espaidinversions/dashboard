-- 20260716100000_align_sf_company_tipus_and_ritmo.sql
-- portfolio_companies.tipus disagreed with the confirmed est classification for
-- 12 search-fund entities (company-path imports defaulted tipus to 'PC'/'PE').
-- isSearchFundShell (privateCompanyModel.js) requires tipus = 'SF', so cerca
-- searchers were treated as actual companies and dropped from the Alternatius
-- Resum companies matrix and the Searchers views; acquired SFs showed under the
-- wrong Participades category.
-- Classification confirmed by Roberto 2026-07-16:
--   SF adquisició -> Ritmo Capital, Grupo FIRE, Alfavet
--   SF cerca      -> AB1, Alpha Nova, Carpathia, FS SAV, Origo, Palette, Quo,
--                    Scrum, Wildlynx
-- Ritmo Capital was stored as 'Search Fund - Cerca' in capital_calls and
-- private_entities; reclassified to 'Search Fund - Participada' in the same
-- pass (same pattern as 20260715120000_reclassify_company_held_sf_capital_calls.sql).

UPDATE public.capital_calls
SET est = 'Search Fund - Participada'
WHERE vehicle_id = 'B02851681'  -- Ritmo Capital SL
  AND est = 'Search Fund - Cerca';

UPDATE public.private_entities
SET vehicle_est = 'Search Fund - Participada'
WHERE id = 'B02851681'
  AND vehicle_est = 'Search Fund - Cerca';

UPDATE public.portfolio_companies
SET tipus = 'SF'
WHERE entity_id IN (
  'GBR15651788',                                -- AB1 Capital
  'B75554824',                                  -- Alfavet
  'MOCKNIF:COMPANY:ALPHA_NOVA_CAPTAL',          -- Alpha Nova Capital
  'B88595277',                                  -- Carpathia Capital
  'GBR16048930',                                -- FS SAV Ltd
  'MOCKNIF:COMPANY:ÍTACA_FIRE_COINVEST',        -- Grupo FIRE
  'MOCKNIF:COMPANY:ORIGO_CAPITAL_INVESTMENTS',  -- Origo Capital Investments
  'B24970980',                                  -- Palette Capital
  'B13672787',                                  -- Quo Investments
  'B02851681',                                  -- Ritmo Capital SL
  'B22939060',                                  -- Scrum Capital Partners
  'B70772108'                                   -- Wildlynx Capital, SL
)
  AND tipus IS DISTINCT FROM 'SF';
