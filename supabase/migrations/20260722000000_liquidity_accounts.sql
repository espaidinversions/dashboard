-- Cross-section liquidity: bank/cash accounts, each tagged to a portfolio section.
-- Single source of truth for liquidity across Alternatius / Real Estate / Mercats Públics.
CREATE TABLE IF NOT EXISTS liquidity_accounts (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom          TEXT NOT NULL,
  banc         TEXT,
  section      TEXT NOT NULL CHECK (section IN ('alternatives', 'real-estate', 'mercats-publics')),
  saldo        NUMERIC NOT NULL DEFAULT 0,        -- balance in EUR
  saldo_native NUMERIC,                            -- balance in the account's own currency
  divisa       TEXT NOT NULL DEFAULT 'EUR',
  data         DATE,                               -- as-of date of the balance
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE liquidity_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS liquidity_accounts_read_authenticated ON liquidity_accounts;
CREATE POLICY liquidity_accounts_read_authenticated
  ON liquidity_accounts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS liquidity_accounts_write_superuser ON liquidity_accounts;
CREATE POLICY liquidity_accounts_write_superuser
  ON liquidity_accounts FOR ALL
  TO authenticated
  USING (public.is_superuser())
  WITH CHECK (public.is_superuser());

CREATE INDEX IF NOT EXISTS idx_liquidity_accounts_section ON liquidity_accounts(section);

-- Atomic full-replace, mirroring the other replace_* RPCs. Superuser-only.
-- id is identity-generated, so it is intentionally omitted from the insert.
CREATE OR REPLACE FUNCTION public.replace_liquidity_accounts(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superuser() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  DELETE FROM liquidity_accounts;

  IF coalesce(jsonb_array_length(p_rows), 0) > 0 THEN
    INSERT INTO liquidity_accounts (nom, banc, section, saldo, saldo_native, divisa, data)
    SELECT nom, banc, section, saldo, saldo_native, divisa, data
    FROM jsonb_to_recordset(p_rows)
    AS x(
      nom text, banc text, section text,
      saldo numeric, saldo_native numeric, divisa text, data date
    );
  END IF;
END;
$$;
