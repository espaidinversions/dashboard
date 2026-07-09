-- 20260708000001_drop_fund_meta_vehicle_tipus.sql
-- vehicle_est (Tipus de Vehicle) is the sole classification source. PE/VC retired.
ALTER TABLE public.fund_meta DROP CONSTRAINT IF EXISTS fund_meta_vehicle_tipus_check;
ALTER TABLE public.fund_meta DROP COLUMN IF EXISTS vehicle_tipus;
