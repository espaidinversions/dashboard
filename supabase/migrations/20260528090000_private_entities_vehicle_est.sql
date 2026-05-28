-- Store a per-vehicle (NIF) default "Tipus de Vehicle" for the transaction register.
-- Used to keep all capital_calls rows consistent by vehicle_id.

ALTER TABLE public.private_entities
  ADD COLUMN IF NOT EXISTS vehicle_est text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'private_entities_vehicle_est_check'
  ) THEN
    ALTER TABLE public.private_entities
      ADD CONSTRAINT private_entities_vehicle_est_check
      CHECK (vehicle_est IS NULL OR vehicle_est IN (
        'Fons Primari',
        'Fons Secundari',
        'Fons de Fons',
        'Fons de Coinversió',
        'Search Fund - Cerca',
        'Search Fund - Participada',
        'Participada (Altres)',
        'Fons Real Estate'
      ));
  END IF;
END $$;

