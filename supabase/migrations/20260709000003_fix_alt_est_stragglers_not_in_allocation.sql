-- 20260709000003_fix_alt_est_stragglers_not_in_allocation.sql
-- Three ALT vehicles absent from the Allocation Matrius sheet, classified manually
-- by the user: Ítaca → Primari, Qualitas Secondary Opps I → Secundari, RCP XXI → FoF.
UPDATE public.capital_calls SET est = 'Fons Primari'   WHERE fons = 'Ítaca Capital Partners'        AND est IS DISTINCT FROM 'Fons Primari';
UPDATE public.capital_calls SET est = 'Fons Secundari' WHERE fons = 'Qualitas Secondary Opps I SCR' AND est IS DISTINCT FROM 'Fons Secundari';
UPDATE public.capital_calls SET est = 'Fons de Fons'   WHERE fons = 'RCP Fund XXI (EU) SCSp'         AND est IS DISTINCT FROM 'Fons de Fons';
