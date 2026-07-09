-- 20260708000002_fix_replace_dashboard_bundle_est.sql
-- Recreate the bulk-import RPC to match the schema after PE/VC retirement:
--   * capital_calls no longer has `vcpe` (dropped in 20260522000001)
--   * fund_meta no longer has `vehicle_tipus` (dropped in 20260708000001)
-- Both references made this SECURITY DEFINER function fail at runtime.
-- Also persist vehicle_est / nif / fiscal_name on private_entities so a bulk
-- import does NOT blank the classification — vehicle_est is now the sole source
-- of truth for "Tipus de Vehicle".
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
    INSERT INTO capital_calls (vehicle_id, fons, tipus, cat, data, mes, year, fy, est, eur, divisa, comentaris, amount_native, fx_rate, fx_source, recallable, non_recallable, from_recallable)
    SELECT vehicle_id, fons, tipus, cat, data, mes, year, fy, est, eur, divisa, comentaris, amount_native, fx_rate, fx_source, recallable, non_recallable, from_recallable
    FROM jsonb_to_recordset(COALESCE(p_cc_rows, '[]'::jsonb))
    AS x(vehicle_id TEXT, fons TEXT, tipus TEXT, cat TEXT, data TEXT, mes INTEGER, year INTEGER, fy TEXT, est TEXT, eur NUMERIC, divisa TEXT, comentaris TEXT, amount_native NUMERIC, fx_rate NUMERIC, fx_source TEXT, recallable NUMERIC, non_recallable NUMERIC, from_recallable NUMERIC);
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

  IF p_searchers_rows IS NOT NULL THEN
    DELETE FROM searchers;
  END IF;
  IF p_searchers_rows IS NOT NULL AND COALESCE(jsonb_array_length(p_searchers_rows), 0) > 0 THEN
    INSERT INTO searchers (
      nom, tipus, modalitat, geo,
      status_screening_code, status_screening,
      status_cerca_code, status_cerca,
      status_adquisicio_code, status_adquisicio,
      form_entrada, intro_per, companyia_adquirida,
      searcher1, searcher2, escola1, escola2,
      web, comentaris, ticket, tvpi,
      data_inici, database_intro_date, data_compr,
      mesos_cercant, irr, dpi, equity_stake, nif, label, is_mock, is_legacy
    )
    SELECT
      nom, tipus, modalitat, geo,
      status_screening_code, status_screening,
      status_cerca_code, status_cerca,
      status_adquisicio_code, status_adquisicio,
      form_entrada, intro_per, companyia_adquirida,
      searcher1, searcher2, escola1, escola2,
      web, comentaris, ticket, tvpi,
      data_inici, database_intro_date, data_compr,
      mesos_cercant, irr, dpi, equity_stake, nif,
      label, COALESCE(is_mock, false), COALESCE(is_legacy, false)
    FROM jsonb_to_recordset(COALESCE(p_searchers_rows, '[]'::jsonb))
    AS x(
      nom TEXT, tipus TEXT, modalitat TEXT, geo TEXT,
      status_screening_code INTEGER, status_screening TEXT,
      status_cerca_code INTEGER, status_cerca TEXT,
      status_adquisicio_code INTEGER, status_adquisicio TEXT,
      form_entrada TEXT, intro_per TEXT, companyia_adquirida TEXT,
      searcher1 TEXT, searcher2 TEXT, escola1 TEXT, escola2 TEXT,
      web TEXT, comentaris TEXT, ticket NUMERIC, tvpi NUMERIC,
      data_inici TEXT, database_intro_date TEXT, data_compr TEXT,
      mesos_cercant INTEGER, irr NUMERIC, dpi NUMERIC, equity_stake NUMERIC,
      nif TEXT, label TEXT, is_mock BOOLEAN, is_legacy BOOLEAN
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
    INSERT INTO private_entities (id, kind, canonical_name, source_name, workbook_name, match_type, vehicle_est, nif, fiscal_name)
    SELECT id, kind, canonical_name, source_name, workbook_name, match_type, vehicle_est, nif, fiscal_name
    FROM jsonb_to_recordset(COALESCE(p_private_entities_rows, '[]'::jsonb))
    AS x(id TEXT, kind TEXT, canonical_name TEXT, source_name TEXT, workbook_name TEXT, match_type TEXT, vehicle_est TEXT, nif TEXT, fiscal_name TEXT);
  END IF;
  IF p_fund_meta_rows IS NOT NULL AND COALESCE(jsonb_array_length(p_fund_meta_rows), 0) > 0 THEN
    INSERT INTO fund_meta (vehicle_id, fons, tvpi, irr)
    SELECT vehicle_id, fons, tvpi, irr
    FROM jsonb_to_recordset(COALESCE(p_fund_meta_rows, '[]'::jsonb))
    AS x(vehicle_id TEXT, fons TEXT, tvpi NUMERIC, irr NUMERIC);
  END IF;
END;
$$;
