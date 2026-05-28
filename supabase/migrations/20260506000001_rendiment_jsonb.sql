-- Migrate per-year rendiment columns to a single JSONB map.
-- New years are added as keys without schema changes.
ALTER TABLE pm_position_overrides ADD COLUMN IF NOT EXISTS rendiment JSONB NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pm_position_overrides' AND column_name = 'rend2023'
  ) THEN
    UPDATE pm_position_overrides
    SET rendiment = jsonb_strip_nulls(jsonb_build_object(
      '2023', rend2023,
      '2024', rend2024,
      '2025', rend2025,
      '2026', rend2026
    ))
    WHERE rend2023 IS NOT NULL
       OR rend2024 IS NOT NULL
       OR rend2025 IS NOT NULL
       OR rend2026 IS NOT NULL;
  END IF;
END $$;

ALTER TABLE pm_position_overrides DROP COLUMN IF EXISTS rend2023;
ALTER TABLE pm_position_overrides DROP COLUMN IF EXISTS rend2024;
ALTER TABLE pm_position_overrides DROP COLUMN IF EXISTS rend2025;
ALTER TABLE pm_position_overrides DROP COLUMN IF EXISTS rend2026;
