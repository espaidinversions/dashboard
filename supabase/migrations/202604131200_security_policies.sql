-- Migration: security hardening, RLS, and role-based write access
-- 2026-04-13

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    'user'
  )
$$;

create or replace function public.is_superuser()
returns boolean
language sql
stable
as $$
  select public.current_app_role() in ('superuser', 'admin')
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_app_role() = 'admin'
$$;

alter table capital_calls enable row level security;
alter table fund_meta enable row level security;
alter table pipeline enable row level security;
alter table portfolio_companies enable row level security;
alter table searchers enable row level security;
alter table pm_transactions enable row level security;
alter table pm_ter_overrides enable row level security;
alter table pm_position_meta enable row level security;
alter table app_settings enable row level security;
alter table audit_log enable row level security;

drop policy if exists capital_calls_read_authenticated on capital_calls;
create policy capital_calls_read_authenticated
  on capital_calls for select
  to authenticated
  using (true);

drop policy if exists capital_calls_write_superuser on capital_calls;
create policy capital_calls_write_superuser
  on capital_calls for all
  to authenticated
  using (public.is_superuser())
  with check (public.is_superuser());

drop policy if exists fund_meta_read_authenticated on fund_meta;
create policy fund_meta_read_authenticated
  on fund_meta for select
  to authenticated
  using (true);

drop policy if exists fund_meta_write_superuser on fund_meta;
create policy fund_meta_write_superuser
  on fund_meta for all
  to authenticated
  using (public.is_superuser())
  with check (public.is_superuser());

drop policy if exists pipeline_read_authenticated on pipeline;
create policy pipeline_read_authenticated
  on pipeline for select
  to authenticated
  using (true);

drop policy if exists pipeline_write_superuser on pipeline;
create policy pipeline_write_superuser
  on pipeline for all
  to authenticated
  using (public.is_superuser())
  with check (public.is_superuser());

drop policy if exists portfolio_companies_read_authenticated on portfolio_companies;
create policy portfolio_companies_read_authenticated
  on portfolio_companies for select
  to authenticated
  using (true);

drop policy if exists portfolio_companies_write_superuser on portfolio_companies;
create policy portfolio_companies_write_superuser
  on portfolio_companies for all
  to authenticated
  using (public.is_superuser())
  with check (public.is_superuser());

drop policy if exists searchers_read_authenticated on searchers;
create policy searchers_read_authenticated
  on searchers for select
  to authenticated
  using (true);

drop policy if exists searchers_write_superuser on searchers;
create policy searchers_write_superuser
  on searchers for all
  to authenticated
  using (public.is_superuser())
  with check (public.is_superuser());

drop policy if exists pm_transactions_read_authenticated on pm_transactions;
create policy pm_transactions_read_authenticated
  on pm_transactions for select
  to authenticated
  using (true);

drop policy if exists pm_transactions_write_superuser on pm_transactions;
create policy pm_transactions_write_superuser
  on pm_transactions for all
  to authenticated
  using (public.is_superuser())
  with check (public.is_superuser());

drop policy if exists pm_ter_overrides_read_authenticated on pm_ter_overrides;
create policy pm_ter_overrides_read_authenticated
  on pm_ter_overrides for select
  to authenticated
  using (true);

drop policy if exists pm_ter_overrides_write_superuser on pm_ter_overrides;
create policy pm_ter_overrides_write_superuser
  on pm_ter_overrides for all
  to authenticated
  using (public.is_superuser())
  with check (public.is_superuser());

drop policy if exists pm_position_meta_read_authenticated on pm_position_meta;
create policy pm_position_meta_read_authenticated
  on pm_position_meta for select
  to authenticated
  using (true);

drop policy if exists pm_position_meta_write_superuser on pm_position_meta;
create policy pm_position_meta_write_superuser
  on pm_position_meta for all
  to authenticated
  using (public.is_superuser())
  with check (public.is_superuser());

drop policy if exists app_settings_admin_read on app_settings;
create policy app_settings_admin_read
  on app_settings for select
  to authenticated
  using (public.is_admin());

drop policy if exists app_settings_admin_write on app_settings;
create policy app_settings_admin_write
  on app_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists audit_log_admin_read on audit_log;
create policy audit_log_admin_read
  on audit_log for select
  to authenticated
  using (public.is_admin());

drop policy if exists audit_log_authenticated_insert on audit_log;
create policy audit_log_authenticated_insert
  on audit_log for insert
  to authenticated
  with check (auth.uid() is not null);

create or replace function replace_dashboard_bundle(
  p_cc_rows jsonb,
  p_pl_rows jsonb,
  p_companies_rows jsonb,
  p_searchers_rows jsonb,
  p_fund_meta_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superuser() then
    raise exception 'Forbidden';
  end if;

  if p_cc_rows is not null then
    delete from capital_calls;
  end if;
  if p_cc_rows is not null and coalesce(jsonb_array_length(p_cc_rows), 0) > 0 then
    insert into capital_calls (fons, tipus, cat, data, mes, year, fy, vcpe, est, eur, divisa)
    select fons, tipus, cat, data, mes, year, fy, vcpe, est, eur, divisa
    from jsonb_to_recordset(coalesce(p_cc_rows, '[]'::jsonb))
    as x(fons text, tipus text, cat text, data text, mes integer, year integer, fy text, vcpe text, est text, eur numeric, divisa text);
  end if;

  if p_pl_rows is not null then
    delete from pipeline;
  end if;
  if p_pl_rows is not null and coalesce(jsonb_array_length(p_pl_rows), 0) > 0 then
    insert into pipeline (id, name, amount, currency, geography, strategy, sector, status, canal, active, estimated_closing)
    select id, name, amount, currency, geography, strategy, sector, status, canal, active, estimated_closing
    from jsonb_to_recordset(coalesce(p_pl_rows, '[]'::jsonb))
    as x(id integer, name text, amount numeric, currency text, geography text, strategy text, sector text, status text, canal text, active boolean, estimated_closing text);
  end if;

  if p_companies_rows is not null then
    delete from portfolio_companies;
  end if;
  if p_companies_rows is not null and coalesce(jsonb_array_length(p_companies_rows), 0) > 0 then
    insert into portfolio_companies (
      nom, tipus, segment, entrepreneurs, origen, geo, ticket, tvpi, rvpi_eur, dpi_eur,
      rev, ebitda, dfn, gross_ev, mult_entry, data_compr, mesos_operant, is_mock, quarters
    )
    select
      nom, tipus, segment, entrepreneurs, origen, geo, ticket, tvpi, rvpi_eur, dpi_eur,
      rev, ebitda, dfn, gross_ev, mult_entry, data_compr, mesos_operant, is_mock, coalesce(quarters, '[]'::jsonb)
    from jsonb_to_recordset(coalesce(p_companies_rows, '[]'::jsonb))
    as x(
      nom text, tipus text, segment text, entrepreneurs text, origen text, geo text,
      ticket numeric, tvpi numeric, rvpi_eur numeric, dpi_eur numeric,
      rev numeric, ebitda numeric, dfn numeric, gross_ev numeric, mult_entry numeric,
      data_compr text, mesos_operant integer, is_mock boolean, quarters jsonb
    );
  end if;

  if p_searchers_rows is not null then
    delete from searchers;
  end if;
  if p_searchers_rows is not null and coalesce(jsonb_array_length(p_searchers_rows), 0) > 0 then
    insert into searchers (
      nom, tipus, modalitat, geo, status_screening, form_entrada, intro_per, searcher1, searcher2,
      escola1, escola2, ticket, data_inici, data_compr, mesos_cercant, equity_stake, is_mock
    )
    select
      nom, tipus, modalitat, geo, status_screening, form_entrada, intro_per, searcher1, searcher2,
      escola1, escola2, ticket, data_inici, data_compr, mesos_cercant, equity_stake, is_mock
    from jsonb_to_recordset(coalesce(p_searchers_rows, '[]'::jsonb))
    as x(
      nom text, tipus text, modalitat text, geo text, status_screening text, form_entrada text, intro_per text,
      searcher1 text, searcher2 text, escola1 text, escola2 text, ticket numeric, data_inici text, data_compr text,
      mesos_cercant integer, equity_stake numeric, is_mock boolean
    );
  end if;

  if p_fund_meta_rows is not null then
    delete from fund_meta;
  end if;
  if p_fund_meta_rows is not null and coalesce(jsonb_array_length(p_fund_meta_rows), 0) > 0 then
    insert into fund_meta (fons, tvpi)
    select fons, tvpi
    from jsonb_to_recordset(coalesce(p_fund_meta_rows, '[]'::jsonb))
    as x(fons text, tvpi numeric);
  end if;
end;
$$;
