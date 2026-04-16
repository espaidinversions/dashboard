-- Migration: add pm_position_overrides for editable financial data on holdings
-- 2026-04-16 16:00

create table if not exists pm_position_overrides (
  isin          text primary key,
  valor_mercat  numeric,
  rend_inici    numeric,
  rend2026      numeric,
  rend2025      numeric,
  rend2024      numeric,
  rend2023      numeric,
  cost_anual    numeric,
  updated_at    timestamptz default now()
);

alter table pm_position_overrides enable row level security;

create policy pm_position_overrides_read_authenticated
  on pm_position_overrides for select
  to authenticated
  using (true);

create policy pm_position_overrides_write_superuser
  on pm_position_overrides for all
  to authenticated
  using (public.is_superuser())
  with check (public.is_superuser());
