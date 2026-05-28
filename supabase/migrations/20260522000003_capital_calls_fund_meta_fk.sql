-- Allow PostgREST to infer the capital_calls → fund_meta join
-- (needed for .select("*, fund_meta(vehicle_tipus)") embedded resource syntax)
ALTER TABLE public.capital_calls
  DROP CONSTRAINT IF EXISTS capital_calls_fund_meta_fk;

ALTER TABLE public.capital_calls
  ADD CONSTRAINT capital_calls_fund_meta_fk
  FOREIGN KEY (vehicle_id) REFERENCES public.fund_meta(vehicle_id)
  ON DELETE RESTRICT;
