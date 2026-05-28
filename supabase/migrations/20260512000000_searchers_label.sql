-- Add label column to searchers for custom status annotations
ALTER TABLE searchers ADD COLUMN IF NOT EXISTS label TEXT;

-- Mark as legacy all invested searchers that returned capital without acquisition.
-- Primary match: via vehicle_id (= searchers.nif).
UPDATE searchers
SET is_legacy = true, label = 'Capital retornat'
WHERE id IN (
  SELECT DISTINCT s.id
  FROM searchers s
  JOIN capital_calls cc ON cc.vehicle_id = s.nif
  WHERE cc.cat    = 'Retorn Capital'
    AND s.nif     IS NOT NULL
    AND s.nif     <> ''
    AND s.is_legacy = false
);

-- Fallback: name-based match for invested searchers without a stored NIF.
UPDATE searchers
SET is_legacy = true, label = 'Capital retornat'
WHERE id IN (
  SELECT DISTINCT s.id
  FROM searchers s
  JOIN capital_calls cc ON lower(trim(cc.fons)) = lower(trim(s.nom))
  WHERE cc.cat    = 'Retorn Capital'
    AND (s.nif IS NULL OR s.nif = '')
    AND s.is_legacy = false
);
