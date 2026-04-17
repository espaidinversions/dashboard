-- Migration: enum CHECK constraints + capital_calls.data → DATE + notes columns

-- ── 1. capital_calls.data: TEXT → DATE ────────────────────────────────────────
-- Existing values are ISO strings (YYYY-MM-DD) so the cast is safe.
ALTER TABLE public.capital_calls
  ALTER COLUMN data TYPE date USING data::date;

-- ── 2. Enum CHECK constraints ─────────────────────────────────────────────────

-- pipeline.status
ALTER TABLE public.pipeline
  ADD CONSTRAINT pipeline_status_check
  CHECK (status IN ('En estudi', 'Aprovat', 'Descartat'));

-- pipeline.canal
ALTER TABLE public.pipeline
  ADD CONSTRAINT pipeline_canal_check
  CHECK (canal IN ('Arcano', 'Placement Agent', 'Propietari', 'Altres'));

-- searchers.modalitat
ALTER TABLE public.searchers
  ADD CONSTRAINT searchers_modalitat_check
  CHECK (modalitat IN ('Solo', 'Duo', 'Trio', 'Partnership'));

-- searchers.form_entrada
ALTER TABLE public.searchers
  ADD CONSTRAINT searchers_form_entrada_check
  CHECK (form_entrada IN ('Search Capital', 'Equity Gap'));

-- searchers.status_screening
ALTER TABLE public.searchers
  ADD CONSTRAINT searchers_status_screening_check
  CHECK (status_screening IN (
    'Invertit en fase de cerca',
    'Invertit en fase d''adquisició',
    'Descartat',
    'En anàlisi',
    'Sobresuscrit',
    'Pendent de formalitzar',
    'No tancat'
  ));

-- portfolio_companies.tipus
ALTER TABLE public.portfolio_companies
  ADD CONSTRAINT portfolio_companies_tipus_check
  CHECK (tipus IN ('SF', 'PE'));

-- portfolio_companies.origen
ALTER TABLE public.portfolio_companies
  ADD CONSTRAINT portfolio_companies_origen_check
  CHECK (origen IN ('Search Capital', 'Equity Gap', 'Direct PE'));

-- ── 3. Provenance notes columns ───────────────────────────────────────────────
ALTER TABLE public.pm_position_overrides
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.pm_ter_overrides
  ADD COLUMN IF NOT EXISTS notes text;
