-- Turtle Capital Dashboard — Supabase schema
-- Run this in the Supabase SQL editor

-- ── Capital Calls ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capital_calls (
  id      BIGSERIAL PRIMARY KEY,
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
  divisa  TEXT
);

-- ── Fund metadata (TVPI etc.) ─────────────────────────────
CREATE TABLE IF NOT EXISTS fund_meta (
  fons  TEXT PRIMARY KEY,
  tvpi  NUMERIC
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
  active      BOOLEAN DEFAULT true
);

-- ── Portfolio companies ───────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_companies (
  id             BIGSERIAL PRIMARY KEY,
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
  data_compr     TEXT,
  mesos_operant  INTEGER,
  is_mock        BOOLEAN DEFAULT false,
  quarters       JSONB DEFAULT '[]'
);

-- ── Searchers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS searchers (
  id                BIGSERIAL PRIMARY KEY,
  nom               TEXT,
  tipus             TEXT,
  modalitat         TEXT,
  geo               TEXT,
  status_screening  TEXT,
  form_entrada      TEXT,
  intro_per         TEXT,
  searcher1         TEXT,
  searcher2         TEXT,
  escola1           TEXT,
  escola2           TEXT,
  ticket            NUMERIC,
  data_inici        TEXT,
  data_compr        TEXT,
  mesos_cercant     INTEGER,
  equity_stake      NUMERIC,
  is_mock           BOOLEAN DEFAULT false
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

-- ── Disable RLS (single-user personal dashboard) ──────────
ALTER TABLE capital_calls       DISABLE ROW LEVEL SECURITY;
ALTER TABLE fund_meta           DISABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline            DISABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE searchers           DISABLE ROW LEVEL SECURITY;
ALTER TABLE pm_transactions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE pm_ter_overrides    DISABLE ROW LEVEL SECURITY;
ALTER TABLE pm_position_meta    DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings        DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            DISABLE ROW LEVEL SECURITY;

-- ── Bulk replace helper ───────────────────────────────────
CREATE OR REPLACE FUNCTION replace_dashboard_bundle(
  p_cc_rows JSONB,
  p_pl_rows JSONB,
  p_companies_rows JSONB,
  p_searchers_rows JSONB,
  p_fund_meta_rows JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_cc_rows IS NOT NULL THEN
    DELETE FROM capital_calls;
  END IF;
  IF p_cc_rows IS NOT NULL AND COALESCE(jsonb_array_length(p_cc_rows), 0) > 0 THEN
    INSERT INTO capital_calls (fons, tipus, cat, data, mes, year, fy, vcpe, est, eur, divisa)
    SELECT fons, tipus, cat, data, mes, year, fy, vcpe, est, eur, divisa
    FROM jsonb_to_recordset(COALESCE(p_cc_rows, '[]'::jsonb))
    AS x(fons TEXT, tipus TEXT, cat TEXT, data TEXT, mes INTEGER, year INTEGER, fy TEXT, vcpe TEXT, est TEXT, eur NUMERIC, divisa TEXT);
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
      nom, tipus, segment, entrepreneurs, origen, geo, ticket, tvpi, rvpi_eur, dpi_eur,
      rev, ebitda, dfn, gross_ev, mult_entry, data_compr, mesos_operant, is_mock, quarters
    )
    SELECT
      nom, tipus, segment, entrepreneurs, origen, geo, ticket, tvpi, rvpi_eur, dpi_eur,
      rev, ebitda, dfn, gross_ev, mult_entry, data_compr, mesos_operant, is_mock, COALESCE(quarters, '[]'::jsonb)
    FROM jsonb_to_recordset(COALESCE(p_companies_rows, '[]'::jsonb))
    AS x(
      nom TEXT, tipus TEXT, segment TEXT, entrepreneurs TEXT, origen TEXT, geo TEXT,
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
      nom, tipus, modalitat, geo, status_screening, form_entrada, intro_per, searcher1, searcher2,
      escola1, escola2, ticket, data_inici, data_compr, mesos_cercant, equity_stake, is_mock
    )
    SELECT
      nom, tipus, modalitat, geo, status_screening, form_entrada, intro_per, searcher1, searcher2,
      escola1, escola2, ticket, data_inici, data_compr, mesos_cercant, equity_stake, is_mock
    FROM jsonb_to_recordset(COALESCE(p_searchers_rows, '[]'::jsonb))
    AS x(
      nom TEXT, tipus TEXT, modalitat TEXT, geo TEXT, status_screening TEXT, form_entrada TEXT, intro_per TEXT,
      searcher1 TEXT, searcher2 TEXT, escola1 TEXT, escola2 TEXT, ticket NUMERIC, data_inici TEXT, data_compr TEXT,
      mesos_cercant INTEGER, equity_stake NUMERIC, is_mock BOOLEAN
    );
  END IF;

  IF p_fund_meta_rows IS NOT NULL THEN
    DELETE FROM fund_meta;
  END IF;
  IF p_fund_meta_rows IS NOT NULL AND COALESCE(jsonb_array_length(p_fund_meta_rows), 0) > 0 THEN
    INSERT INTO fund_meta (fons, tvpi)
    SELECT fons, tvpi
    FROM jsonb_to_recordset(COALESCE(p_fund_meta_rows, '[]'::jsonb))
    AS x(fons TEXT, tvpi NUMERIC);
  END IF;
END;
$$;
