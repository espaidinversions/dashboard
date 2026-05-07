-- Add vehicle_tipus column to fund_meta
-- Values: 'Primari' | 'FoF' | 'Secundari' | 'Co-inversió'
-- Populated by scripts/backfill_vehicle_tipus.mjs from 260120_Allocation_Fons.xlsx

ALTER TABLE fund_meta ADD COLUMN IF NOT EXISTS vehicle_tipus TEXT;

-- Update replace_dashboard_bundle to preserve vehicle_tipus
CREATE OR REPLACE FUNCTION replace_dashboard_bundle(
  p_private_entities_rows JSONB,
  p_cc_rows JSONB,
  p_pl_rows JSONB,
  p_companies_rows JSONB,
  p_searchers_rows JSONB,
  p_fund_meta_rows JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superuser() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_cc_rows IS NOT NULL THEN
    DELETE FROM capital_calls;
  END IF;
  IF p_cc_rows IS NOT NULL AND COALESCE(jsonb_array_length(p_cc_rows), 0) > 0 THEN
    INSERT INTO capital_calls (vehicle_id, fons, tipus, cat, data, mes, year, fy, vcpe, est, eur, divisa, comentaris, amount_native, fx_rate, fx_source, recallable, non_recallable, from_recallable)
    SELECT vehicle_id, fons, tipus, cat, data, mes, year, fy, vcpe, est, eur, divisa, comentaris, amount_native, fx_rate, fx_source, recallable, non_recallable, from_recallable
    FROM jsonb_to_recordset(COALESCE(p_cc_rows, '[]'::jsonb))
    AS x(vehicle_id TEXT, fons TEXT, tipus TEXT, cat TEXT, data TEXT, mes INTEGER, year INTEGER, fy TEXT, vcpe TEXT, est TEXT, eur NUMERIC, divisa TEXT, comentaris TEXT, amount_native NUMERIC, fx_rate NUMERIC, fx_source TEXT, recallable NUMERIC, non_recallable NUMERIC, from_recallable NUMERIC);
  END IF;

  IF p_pl_rows IS NOT NULL THEN
    DELETE FROM pipeline;
  END IF;
  IF p_pl_rows IS NOT NULL AND COALESCE(jsonb_array_length(p_pl_rows), 0) > 0 THEN
    INSERT INTO pipeline (id, name, amount, currency, geography, strategy, sector, status, canal, active, estimated_closing)
    SELECT id, name, amount, currency, geography, strategy, sector, status, canal, active, estimated_closing
    FROM jsonb_to_recordset(COALESCE(p_pl_rows, '[]'::jsonb))
    AS x(id INTEGER, name TEXT, amount NUMERIC, currency TEXT, geography TEXT, strategy TEXT, sector TEXT, status TEXT, canal TEXT, active BOOLEAN, estimated_closing TEXT);
  END IF;

  IF p_companies_rows IS NOT NULL THEN
    DELETE FROM portfolio_companies;
  END IF;
  IF p_companies_rows IS NOT NULL AND COALESCE(jsonb_array_length(p_companies_rows), 0) > 0 THEN
    INSERT INTO portfolio_companies (
      entity_id, nom, tipus, segment, entrepreneurs, origen, geo, ticket, tvpi, rvpi_eur, dpi_eur,
      rev, ebitda, dfn, gross_ev, mult_entry, data_compr, mesos_operant, is_mock, quarters
    )
    SELECT
      entity_id, nom, tipus, segment, entrepreneurs, origen, geo, ticket, tvpi, rvpi_eur, dpi_eur,
      rev, ebitda, dfn, gross_ev, mult_entry, data_compr, mesos_operant, is_mock, COALESCE(quarters, '[]'::jsonb)
    FROM jsonb_to_recordset(COALESCE(p_companies_rows, '[]'::jsonb))
    AS x(
      entity_id TEXT, nom TEXT, tipus TEXT, segment TEXT, entrepreneurs TEXT, origen TEXT, geo TEXT,
      ticket NUMERIC, tvpi NUMERIC, rvpi_eur NUMERIC, dpi_eur NUMERIC,
      rev NUMERIC, ebitda NUMERIC, dfn NUMERIC, gross_ev NUMERIC, mult_entry NUMERIC,
      data_compr TEXT, mesos_operant INTEGER, is_mock BOOLEAN, quarters JSONB
    );
  END IF;

  IF p_fund_meta_rows IS NOT NULL THEN
    DELETE FROM fund_meta;
  END IF;
  IF p_private_entities_rows IS NOT NULL THEN
    DELETE FROM private_entities
    WHERE kind IN ('company', 'vehicle');
  END IF;
  IF p_private_entities_rows IS NOT NULL AND COALESCE(jsonb_array_length(p_private_entities_rows), 0) > 0 THEN
    INSERT INTO private_entities (id, kind, canonical_name, source_name, workbook_name, match_type)
    SELECT id, kind, canonical_name, source_name, workbook_name, match_type
    FROM jsonb_to_recordset(COALESCE(p_private_entities_rows, '[]'::jsonb))
    AS x(id TEXT, kind TEXT, canonical_name TEXT, source_name TEXT, workbook_name TEXT, match_type TEXT);
  END IF;
  IF p_fund_meta_rows IS NOT NULL AND COALESCE(jsonb_array_length(p_fund_meta_rows), 0) > 0 THEN
    INSERT INTO fund_meta (vehicle_id, fons, tvpi, irr, vehicle_tipus)
    SELECT vehicle_id, fons, tvpi, irr, vehicle_tipus
    FROM jsonb_to_recordset(COALESCE(p_fund_meta_rows, '[]'::jsonb))
    AS x(vehicle_id TEXT, fons TEXT, tvpi NUMERIC, irr NUMERIC, vehicle_tipus TEXT);
  END IF;
END;
$$;
