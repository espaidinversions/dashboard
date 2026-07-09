-- 20260709000004_socimi_to_re_and_company_tvpi_baseline.sql
-- SOCIMIs are Real Estate: materialize est=Fons Real Estate (normalizer already maps
-- "socimi"→RE at runtime; this makes the stored value consistent).
UPDATE public.capital_calls  SET est = 'Fons Real Estate' WHERE est = 'SOCIMI';
UPDATE public.private_entities SET vehicle_est = 'Fons Real Estate' WHERE vehicle_est = 'SOCIMI';

-- Companies (Search Funds + Participades): provisional baseline TVPI = 1 until real
-- marks are entered. Scoped to vehicles whose est is purely SF/PC (no ALT/RE rows).
UPDATE public.fund_meta fm SET tvpi = 1
WHERE fm.tvpi IS NULL
  AND EXISTS (
    SELECT 1 FROM public.capital_calls cc WHERE cc.vehicle_id = fm.vehicle_id
      AND cc.est IN ('Search Fund - Cerca','Search Fund - Participada','Participada (Altres)'))
  AND NOT EXISTS (
    SELECT 1 FROM public.capital_calls cc WHERE cc.vehicle_id = fm.vehicle_id
      AND NULLIF(TRIM(cc.est),'') IS NOT NULL
      AND cc.est NOT IN ('Search Fund - Cerca','Search Fund - Participada','Participada (Altres)'));
