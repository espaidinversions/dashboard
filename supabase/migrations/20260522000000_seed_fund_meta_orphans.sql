-- 20260522_seed_fund_meta_orphans.sql
-- Inserts a fund_meta row (with vehicle_tipus from capital_calls.vcpe) for every
-- vehicle that exists in capital_calls but has no fund_meta entry.
-- Uses MIN(vcpe) per vehicle so each vehicle gets exactly one canonical type.
-- Montefiore (FRA8294864204) is explicitly set to PE (has both PE and VC rows).

INSERT INTO fund_meta (vehicle_id, fons, vehicle_tipus)
SELECT
  cc.vehicle_id,
  MIN(cc.fons) AS fons,
  CASE cc.vehicle_id
    WHEN 'FRA8294864204' THEN 'PE'
    ELSE MIN(cc.vcpe)
  END AS vehicle_tipus
FROM capital_calls cc
LEFT JOIN fund_meta fm ON fm.vehicle_id = cc.vehicle_id
WHERE fm.vehicle_id IS NULL
  AND cc.vcpe IS NOT NULL
GROUP BY cc.vehicle_id
ON CONFLICT (vehicle_id) DO NOTHING;
