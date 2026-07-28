-- Add per-fund allocation matrix columns to fund_meta.
--
-- geography / sector store normalized weight maps (fractions summing to ~1.0)
-- derived from the Matrius sheet of 260120_Allocation_Fons.xlsx, e.g.
--   geography = {"Nord America": 0.56, "Nord d'Europa": 0.25, "Sud d'Europa": 0.10, "Asia": 0.07, "LatAm": 0.02}
--   sector    = {"Tecnologia": 0.26, "Consum": 0.39, "Salut": 0.15, ...}
--
-- Populated by scripts/backfill_fund_allocation_from_excel.mjs. These are
-- import-managed columns (like fi_end): they are carried on the dashboard read
-- path but not re-emitted by the replace_dashboard_bundle snapshot, so re-run
-- the backfill after publishing a fresh snapshot.

ALTER TABLE fund_meta ADD COLUMN IF NOT EXISTS geography JSONB;
ALTER TABLE fund_meta ADD COLUMN IF NOT EXISTS sector JSONB;
