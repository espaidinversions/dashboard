-- ============================================================================
-- Classification audit for fund vehicles
-- ----------------------------------------------------------------------------
-- Read-only. Run in the Supabase SQL editor, or per-section via MCP execute_sql.
-- Scope is always kind = 'vehicle' (the source of truth for "is this a fund"),
-- NOT capital_calls.est, so portfolio companies (Greenfarm, March Solenergy,
-- search funds, participades) are excluded by construction.
--
-- Sections:
--   1. Vehicles missing classification (geography / sector / strategy maps)
--   2. Class mismatches: entity vehicle_est vs the est stamped on transactions
--   3. Suspected miscategorised vehicles (look like companies / direct holdings)
-- ============================================================================


-- 1. VEHICLES MISSING CLASSIFICATION ----------------------------------------
-- Any vehicle whose fund_meta lacks one or more of the three weight maps.
-- has_tx = false means the fund exists but has no capital-call flows yet.
SELECT
  pe.canonical_name                              AS vehicle,
  pe.vehicle_est                                 AS entity_class,
  EXISTS(SELECT 1 FROM capital_calls cc
         WHERE cc.vehicle_id = pe.id)            AS has_tx,
  (fm.geography IS NOT NULL)                     AS has_geography,
  (fm.sector    IS NOT NULL)                     AS has_vertical,
  (fm.strategy  IS NOT NULL)                     AS has_fundtype
FROM private_entities pe
LEFT JOIN fund_meta fm ON fm.vehicle_id = pe.id
WHERE pe.kind = 'vehicle'
  AND NOT (fm.geography IS NOT NULL
       AND fm.sector    IS NOT NULL
       AND fm.strategy  IS NOT NULL)
ORDER BY has_tx, vehicle;


-- 2. CLASS MISMATCHES (entity vehicle_est vs transaction est) ----------------
-- Surfaces funds whose capital-call rows carry an est different from the
-- entity's stated class. mismatch_years shows which fiscal years hold the
-- offending rows (e.g. the 2026 data-entry batch).
SELECT
  pe.canonical_name                                    AS vehicle,
  pe.vehicle_est                                       AS entity_class,
  array_agg(DISTINCT cc.est)                           AS est_on_transactions,
  array_agg(DISTINCT cc.year)
    FILTER (WHERE cc.est IS DISTINCT FROM pe.vehicle_est) AS mismatch_years
FROM private_entities pe
JOIN capital_calls cc ON cc.vehicle_id = pe.id
WHERE pe.kind = 'vehicle'
GROUP BY pe.canonical_name, pe.vehicle_est
HAVING bool_or(cc.est IS DISTINCT FROM pe.vehicle_est)
ORDER BY vehicle;


-- 3. SUSPECTED MISCATEGORISED VEHICLES --------------------------------------
-- Rows flagged kind = 'vehicle' that behave like companies / direct holdings:
--   * vehicle_est is NULL (never assigned a fund class), OR
--   * a transaction est is a company-type (Search Fund / Participada).
-- These are candidates to reclassify to kind = 'company' rather than tag with
-- fund geography/vertical/fund-type maps.
SELECT
  pe.canonical_name              AS vehicle,
  pe.vehicle_est                 AS entity_class,
  array_agg(DISTINCT cc.est)     AS est_on_transactions
FROM private_entities pe
LEFT JOIN capital_calls cc ON cc.vehicle_id = pe.id
WHERE pe.kind = 'vehicle'
  AND (
    pe.vehicle_est IS NULL
    OR EXISTS (
      SELECT 1 FROM capital_calls c2
      WHERE c2.vehicle_id = pe.id
        AND (c2.est ILIKE 'Search Fund%' OR c2.est ILIKE 'Participada%')
    )
  )
GROUP BY pe.canonical_name, pe.vehicle_est
ORDER BY vehicle;
