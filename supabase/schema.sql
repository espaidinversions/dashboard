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

-- ── Disable RLS (single-user personal dashboard) ──────────
ALTER TABLE capital_calls       DISABLE ROW LEVEL SECURITY;
ALTER TABLE fund_meta           DISABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline            DISABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE searchers           DISABLE ROW LEVEL SECURITY;
ALTER TABLE pm_transactions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE pm_ter_overrides    DISABLE ROW LEVEL SECURITY;
ALTER TABLE pm_position_meta    DISABLE ROW LEVEL SECURITY;
