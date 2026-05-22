-- Drop capital_calls.vcpe — vehicle_tipus in fund_meta is now the source of truth.
-- All app code reads vehicle_tipus via fund_meta join; nothing writes to vcpe anymore.
ALTER TABLE public.capital_calls DROP COLUMN IF EXISTS vcpe;
