-- Add fund manager to pipeline deals
ALTER TABLE pipeline ADD COLUMN IF NOT EXISTS manager TEXT;

-- Add investment period end date to fund_meta
ALTER TABLE fund_meta ADD COLUMN IF NOT EXISTS fi_end TEXT;
