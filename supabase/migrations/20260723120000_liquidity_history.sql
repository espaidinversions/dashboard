-- Dynamic liquidity: normalized registry + balance history, superseding the
-- flat full-replace liquidity_accounts table with a time series.

-- 1. Registry: one row per account.
CREATE TABLE IF NOT EXISTS liquidity_registry (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom        TEXT NOT NULL,
  banc       TEXT,
  section    TEXT NOT NULL CHECK (section IN ('alternatives', 'real-estate', 'mercats-publics')),
  divisa     TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NULL banc treated as '' so (nom, banc, section, divisa) is a real identity key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_liquidity_registry_identity
  ON liquidity_registry (nom, coalesce(banc, ''), section, divisa);
CREATE INDEX IF NOT EXISTS idx_liquidity_registry_section ON liquidity_registry(section);

-- 2. Balances: time series, one row per account per date.
CREATE TABLE IF NOT EXISTS liquidity_balances (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id   BIGINT NOT NULL REFERENCES liquidity_registry(id) ON DELETE CASCADE,
  data         DATE NOT NULL,
  saldo        NUMERIC NOT NULL DEFAULT 0,
  saldo_native NUMERIC,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, data)
);
CREATE INDEX IF NOT EXISTS idx_liquidity_balances_account_data
  ON liquidity_balances (account_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_balances_data ON liquidity_balances (data);

-- 3. RLS: read authenticated, write superuser (mirrors liquidity_accounts).
ALTER TABLE liquidity_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS liquidity_registry_read_authenticated ON liquidity_registry;
CREATE POLICY liquidity_registry_read_authenticated
  ON liquidity_registry FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS liquidity_registry_write_superuser ON liquidity_registry;
CREATE POLICY liquidity_registry_write_superuser
  ON liquidity_registry FOR ALL TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());

DROP POLICY IF EXISTS liquidity_balances_read_authenticated ON liquidity_balances;
CREATE POLICY liquidity_balances_read_authenticated
  ON liquidity_balances FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS liquidity_balances_write_superuser ON liquidity_balances;
CREATE POLICY liquidity_balances_write_superuser
  ON liquidity_balances FOR ALL TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());

-- 4. Superuser-only CRUD RPCs (mirror replace_liquidity_accounts guard).
CREATE OR REPLACE FUNCTION public.upsert_liquidity_account(
  p_id bigint, p_nom text, p_banc text, p_section text, p_divisa text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
  IF NOT public.is_superuser() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO liquidity_registry (nom, banc, section, divisa)
    VALUES (p_nom, p_banc, p_section, coalesce(p_divisa, 'EUR'))
    RETURNING id INTO v_id;
  ELSE
    UPDATE liquidity_registry
      SET nom = p_nom, banc = p_banc, section = p_section,
          divisa = coalesce(p_divisa, 'EUR'), updated_at = now()
      WHERE id = p_id
      RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_liquidity_account(p_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superuser() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  DELETE FROM liquidity_registry WHERE id = p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_liquidity_balance(
  p_id bigint, p_account_id bigint, p_data date, p_saldo numeric, p_saldo_native numeric
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
  IF NOT public.is_superuser() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO liquidity_balances (account_id, data, saldo, saldo_native)
    VALUES (p_account_id, p_data, coalesce(p_saldo, 0), p_saldo_native)
    ON CONFLICT (account_id, data)
      DO UPDATE SET saldo = excluded.saldo, saldo_native = excluded.saldo_native, updated_at = now()
    RETURNING id INTO v_id;
  ELSE
    UPDATE liquidity_balances
      SET account_id = p_account_id, data = p_data, saldo = coalesce(p_saldo, 0),
          saldo_native = p_saldo_native, updated_at = now()
      WHERE id = p_id
      RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_liquidity_balance(p_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superuser() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  DELETE FROM liquidity_balances WHERE id = p_id;
END; $$;

-- 5. One-time data copy from the flat table (each row → 1 account; + 1 balance
--    only when data IS NOT NULL — data-less rows start with zero history).
--    Assumes the flat table is one-row-per-account (it was full-replace).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'liquidity_accounts') THEN
    WITH ins AS (
      INSERT INTO liquidity_registry (nom, banc, section, divisa)
      SELECT nom, banc, section, coalesce(divisa, 'EUR')
      FROM liquidity_accounts
      RETURNING id, nom, coalesce(banc, '') AS banc_k, section, divisa
    )
    INSERT INTO liquidity_balances (account_id, data, saldo, saldo_native)
    SELECT ins.id, la.data, la.saldo, la.saldo_native
    FROM liquidity_accounts la
    JOIN ins ON ins.nom = la.nom
            AND ins.banc_k = coalesce(la.banc, '')
            AND ins.section = la.section
            AND ins.divisa = coalesce(la.divisa, 'EUR')
    WHERE la.data IS NOT NULL;
  END IF;
END $$;

-- 6. Drop the old flat table + RPC (now superseded).
DROP FUNCTION IF EXISTS public.replace_liquidity_accounts(jsonb);
DROP TABLE IF EXISTS liquidity_accounts;
