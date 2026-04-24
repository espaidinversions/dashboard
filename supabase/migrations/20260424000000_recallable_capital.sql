ALTER TABLE capital_calls ADD COLUMN IF NOT EXISTS recallable NUMERIC;
ALTER TABLE capital_calls ADD COLUMN IF NOT EXISTS non_recallable NUMERIC;
ALTER TABLE capital_calls ADD COLUMN IF NOT EXISTS from_recallable NUMERIC;
