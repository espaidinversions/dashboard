-- Tighten prospective_cash_forecasts visibility: only superusers can read/write.
-- The "Model Caixa" tab is restricted to superusers in the app; RLS must match.

ALTER TABLE prospective_cash_forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospective_cash_forecasts_read_authenticated ON prospective_cash_forecasts;
DROP POLICY IF EXISTS prospective_cash_forecasts_read_superuser ON prospective_cash_forecasts;
CREATE POLICY prospective_cash_forecasts_read_superuser
  ON prospective_cash_forecasts FOR SELECT
  TO authenticated
  USING (public.is_superuser());

-- Keep write policy superuser-only (idempotent).
DROP POLICY IF EXISTS prospective_cash_forecasts_write_superuser ON prospective_cash_forecasts;
CREATE POLICY prospective_cash_forecasts_write_superuser
  ON prospective_cash_forecasts FOR ALL
  TO authenticated
  USING (public.is_superuser())
  WITH CHECK (public.is_superuser());

