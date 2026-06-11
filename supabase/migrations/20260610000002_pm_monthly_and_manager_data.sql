-- Migration: live-editable Public Markets monthly series + manager overrides
-- 2026-06-10
--
-- pm_monthly_series: one row per month, one numeric column per custodian
-- series (mirrors PM_MONTHLY fields in src/data/publicMarkets.js). Static
-- array remains the base; DB rows replace same-month rows and extend the tail.
--
-- pm_manager_overrides: per-manager numeric overrides applied on top of
-- PM_MANAGER_TEMPLATE entries. No seed data in either table.

create table if not exists pm_monthly_series (
  month       text primary key check (month ~ '^\d{4}-\d{2}$'),
  caixa_rv    numeric,
  caixa_rf    numeric,
  ubs_rv      numeric,
  ubs_rf      numeric,
  abel_bk     numeric,
  andbank     numeric,
  updated_at  timestamptz default now()
);

alter table pm_monthly_series enable row level security;

create policy pm_monthly_series_read_authenticated
  on pm_monthly_series for select
  to authenticated
  using (true);

create policy pm_monthly_series_write_superuser
  on pm_monthly_series for all
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));

create table if not exists pm_manager_overrides (
  manager_id    text primary key,
  valor_actual  numeric,
  rend_pct      numeric,
  ytd           numeric,
  r2025         numeric,
  r2024         numeric,
  notes         text,
  updated_at    timestamptz default now()
);

alter table pm_manager_overrides enable row level security;

create policy pm_manager_overrides_read_authenticated
  on pm_manager_overrides for select
  to authenticated
  using (true);

create policy pm_manager_overrides_write_superuser
  on pm_manager_overrides for all
  to authenticated
  using ((select public.is_superuser()))
  with check ((select public.is_superuser()));
