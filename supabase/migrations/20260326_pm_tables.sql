-- Migration: Public Markets web-imputable tables
-- 2026-03-26

-- ── Manual transactions ──────────────────────────────────────
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

-- ── TER overrides ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_ter_overrides (
  isin        TEXT PRIMARY KEY,
  ter         NUMERIC NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Position metadata overrides ──────────────────────────────
CREATE TABLE IF NOT EXISTS pm_position_meta (
  isin        TEXT PRIMARY KEY,
  nom         TEXT,
  gestor      TEXT,
  custodian   TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS (single-user personal dashboard)
ALTER TABLE pm_transactions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE pm_ter_overrides DISABLE ROW LEVEL SECURITY;
ALTER TABLE pm_position_meta DISABLE ROW LEVEL SECURITY;
