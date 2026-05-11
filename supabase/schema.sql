-- Turtle Capital Dashboard — Supabase schema
-- Run this in the Supabase SQL editor
-- Then apply the migrations in supabase/migrations/.

-- ── Canonical private entities ────────────────────────────
CREATE TABLE IF NOT EXISTS private_entities (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('company', 'vehicle')),
  canonical_name  TEXT NOT NULL,
  source_name     TEXT,
  workbook_name   TEXT,
  match_type      TEXT,
  nif             TEXT,
  fiscal_name     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Capital Calls ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capital_calls (
  id      BIGSERIAL PRIMARY KEY,
  vehicle_id TEXT REFERENCES private_entities(id) ON UPDATE CASCADE ON DELETE SET NULL,
  fons    TEXT,
  tipus   TEXT,
  cat     TEXT,
  data    TEXT,
  mes     INTEGER,
  year    INTEGER,
  fy      TEXT,
  vcpe    TEXT,
  est     TEXT,
  eur     NUMERIC,
  divisa  TEXT,
  comentaris TEXT,
  amount_native NUMERIC,
  fx_rate NUMERIC,
  fx_source TEXT,
  recallable      NUMERIC,
  non_recallable  NUMERIC,
  from_recallable NUMERIC
);

-- ── Fund metadata (TVPI etc.) ─────────────────────────────
CREATE TABLE IF NOT EXISTS fund_meta (
  vehicle_id    TEXT PRIMARY KEY REFERENCES private_entities(id) ON UPDATE CASCADE ON DELETE SET NULL,
  fons          TEXT,
  tvpi          NUMERIC,
  irr           NUMERIC,
  vehicle_tipus TEXT,
  fi_end        TEXT
);

-- ── Pipeline ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline (
  id          INTEGER PRIMARY KEY,
  name        TEXT,
  amount      NUMERIC,
  currency    TEXT,
  geography   TEXT,
  strategy    TEXT,
  sector      TEXT,
  status      TEXT,
  canal       TEXT,
  active      BOOLEAN DEFAULT true,
  manager     TEXT,
  estimated_closing TEXT
);

-- ── Portfolio companies ───────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_companies (
  id             BIGSERIAL PRIMARY KEY,
  entity_id      TEXT UNIQUE REFERENCES private_entities(id) ON UPDATE CASCADE ON DELETE SET NULL,
  nom            TEXT UNIQUE NOT NULL,
  tipus          TEXT,
  segment        TEXT,
  entrepreneurs  TEXT,
  origen         TEXT,
  geo            TEXT,
  ticket         NUMERIC,
  tvpi           NUMERIC,
  rvpi_eur       NUMERIC,
  dpi_eur        NUMERIC,
  rev            NUMERIC,
  ebitda         NUMERIC,
  dfn            NUMERIC,
  gross_ev       NUMERIC,
  mult_entry     NUMERIC,
  data_compr     DATE,
  mesos_operant  INTEGER,
  is_mock        BOOLEAN DEFAULT false,
  quarters       JSONB DEFAULT '[]'
);

-- ── Searchers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS searchers (
  id                BIGSERIAL PRIMARY KEY,
  nom               TEXT NOT NULL,
  tipus             TEXT,
  modalitat         TEXT,
  geo               TEXT,
  status_screening_code INTEGER,
  status_screening  TEXT,
  status_cerca_code INTEGER,
  status_cerca      TEXT,
  status_adquisicio_code INTEGER,
  status_adquisicio TEXT,
  form_entrada      TEXT,
  intro_per         TEXT,
  companyia_adquirida TEXT,
  searcher1         TEXT,
  searcher2         TEXT,
  escola1           TEXT,
  escola2           TEXT,
  web               TEXT,
  comentaris        TEXT,
  ticket            NUMERIC,
  tvpi              NUMERIC,
  data_inici        DATE,
  database_intro_date DATE,
  data_compr        DATE,
  mesos_cercant     INTEGER,
  irr               NUMERIC,
  dpi               NUMERIC,
  equity_stake      NUMERIC,
  nif               TEXT,
  is_mock           BOOLEAN DEFAULT false,
  is_legacy         BOOLEAN DEFAULT false
);

-- ── Public Markets — manual transactions ──────────────────
CREATE TABLE IF NOT EXISTS pm_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT NOT NULL CHECK (action IN ('buy','sell')),
  date        DATE NOT NULL,
  isin        TEXT NOT NULL,
  nom         TEXT,
  tipus       TEXT,
  custodian   TEXT,
  units       NUMERIC,
  nav         NUMERIC,
  value_eur   NUMERIC,
  source      TEXT DEFAULT 'manual',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Public Markets — TER overrides ────────────────────────
CREATE TABLE IF NOT EXISTS pm_ter_overrides (
  isin        TEXT PRIMARY KEY,
  ter         NUMERIC NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Public Markets — position metadata overrides ──────────
CREATE TABLE IF NOT EXISTS pm_position_meta (
  isin        TEXT PRIMARY KEY,
  nom         TEXT,
  gestor      TEXT,
  custodian   TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Public Markets — financial data overrides ─────────────
CREATE TABLE IF NOT EXISTS pm_position_overrides (
  isin          TEXT PRIMARY KEY,
  valor_mercat  NUMERIC,
  rend_inici    NUMERIC,
  rendiment     JSONB NOT NULL DEFAULT '{}',  -- keyed by year string: {"2023": 0.04, "2026": 0.07}
  cost_anual    NUMERIC,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ── App settings ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Audit log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT,
  user_email  TEXT,
  action      TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  record_id   TEXT NOT NULL,
  changes     JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Shared API rate limiting ──────────────────────────────
CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket    TEXT NOT NULL,
  subject   TEXT NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  reset_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (bucket, subject)
);

-- ── Security helpers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    'user'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_superuser()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_app_role() IN ('superuser', 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_app_role() = 'admin'
$$;

-- ── Enable RLS by default ─────────────────────────────────
ALTER TABLE private_entities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_calls       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_meta           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline            ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE searchers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_ter_overrides    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_position_meta         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_position_overrides    ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits     ENABLE ROW LEVEL SECURITY;

-- ── Bulk replace helper ───────────────────────────────────
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
      mesos_cercant, irr, dpi, equity_stake, nif, is_mock
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
      mesos_cercant, irr, dpi, equity_stake, nif, is_mock
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
      mesos_cercant INTEGER, irr NUMERIC, dpi NUMERIC, equity_stake NUMERIC, nif TEXT, is_mock BOOLEAN
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

CREATE OR REPLACE FUNCTION public.rename_private_entity(
  p_id TEXT,
  p_name TEXT
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

  IF COALESCE(length(trim(p_id)), 0) = 0 THEN
    RAISE EXCEPTION 'Entity id required';
  END IF;

  IF COALESCE(length(trim(p_name)), 0) = 0 THEN
    RAISE EXCEPTION 'Entity name required';
  END IF;

  UPDATE public.private_entities
  SET canonical_name = trim(p_name),
      updated_at = now()
  WHERE id = p_id;

  UPDATE public.capital_calls
  SET fons = trim(p_name)
  WHERE vehicle_id = p_id;

  UPDATE public.fund_meta
  SET fons = trim(p_name)
  WHERE vehicle_id = p_id;

  UPDATE public.portfolio_companies
  SET nom = trim(p_name)
  WHERE entity_id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_private_entity_nif(
  p_id  TEXT,
  p_nif TEXT
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

  IF COALESCE(length(trim(p_id)), 0) = 0 THEN
    RAISE EXCEPTION 'Entity id required';
  END IF;

  UPDATE public.private_entities
  SET nif        = NULLIF(trim(p_nif), ''),
      updated_at = now()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.take_rate_limit(
  p_bucket TEXT,
  p_subject TEXT,
  p_window_ms INTEGER,
  p_max_requests INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_reset_at TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF COALESCE(length(trim(p_bucket)), 0) = 0 THEN
    RAISE EXCEPTION 'Bucket required';
  END IF;
  IF COALESCE(length(trim(p_subject)), 0) = 0 THEN
    RAISE EXCEPTION 'Subject required';
  END IF;
  IF p_window_ms < 1000 THEN
    RAISE EXCEPTION 'Invalid window';
  END IF;
  IF p_max_requests < 1 THEN
    RAISE EXCEPTION 'Invalid max requests';
  END IF;

  DELETE FROM public.api_rate_limits
  WHERE reset_at <= v_now
    AND bucket = p_bucket
    AND subject = p_subject;

  INSERT INTO public.api_rate_limits (bucket, subject, count, reset_at)
  VALUES (
    p_bucket,
    p_subject,
    1,
    v_now + make_interval(secs => p_window_ms / 1000.0)
  )
  ON CONFLICT (bucket, subject) DO UPDATE
  SET count = CASE
        WHEN public.api_rate_limits.reset_at <= v_now THEN 1
        ELSE public.api_rate_limits.count + 1
      END,
      reset_at = CASE
        WHEN public.api_rate_limits.reset_at <= v_now THEN v_now + make_interval(secs => p_window_ms / 1000.0)
        ELSE public.api_rate_limits.reset_at
      END
  RETURNING count, reset_at INTO v_count, v_reset_at;

  RETURN jsonb_build_object(
    'limited', v_count > p_max_requests,
    'limit', p_max_requests,
    'remaining', greatest(p_max_requests - least(v_count, p_max_requests), 0),
    'retry_after_sec', greatest(ceil(extract(epoch FROM (v_reset_at - v_now)))::INTEGER, 1),
    'reset_at', v_reset_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.take_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.take_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;
