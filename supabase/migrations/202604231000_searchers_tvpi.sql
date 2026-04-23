-- Add tvpi column to searchers table
ALTER TABLE public.searchers ADD COLUMN IF NOT EXISTS tvpi numeric;
