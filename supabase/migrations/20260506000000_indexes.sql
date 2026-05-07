-- Performance indexes for frequently-queried columns
CREATE INDEX IF NOT EXISTS idx_capital_calls_vehicle_id ON capital_calls(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_capital_calls_data       ON capital_calls(data);
CREATE INDEX IF NOT EXISTS idx_pm_transactions_isin     ON pm_transactions(isin);
CREATE INDEX IF NOT EXISTS idx_pm_transactions_date     ON pm_transactions(date);
