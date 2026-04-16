-- Migration: enrich private_entities with metadata + add pipeline.vehicle_id

alter table public.private_entities
  add column if not exists isin text,
  add column if not exists country text,
  add column if not exists first_investment_date date,
  add column if not exists active boolean not null default true,
  add column if not exists notes text;

alter table public.pipeline
  add column if not exists vehicle_id text;

-- Update replace_dashboard_bundle to persist new metadata columns on private_entities
create or replace function public.replace_dashboard_bundle(
  p_private_entities_rows jsonb,
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
    delete from public.capital_calls;
  end if;
  if p_cc_rows is not null and coalesce(jsonb_array_length(p_cc_rows), 0) > 0 then
    insert into public.capital_calls (vehicle_id, fons, tipus, cat, data, mes, year, fy, vcpe, est, eur, divisa)
    select vehicle_id, fons, tipus, cat, data, mes, year, fy, vcpe, est, eur, divisa
    from jsonb_to_recordset(coalesce(p_cc_rows, '[]'::jsonb))
      as x(vehicle_id text, fons text, tipus text, cat text, data text, mes integer, year integer, fy text, vcpe text, est text, eur numeric, divisa text);
  end if;

  if p_pl_rows is not null then
    delete from public.pipeline;
  end if;
  if p_pl_rows is not null and coalesce(jsonb_array_length(p_pl_rows), 0) > 0 then
    insert into public.pipeline (id, name, amount, currency, geography, strategy, sector, status, canal, active, estimated_closing)
    select id, name, amount, currency, geography, strategy, sector, status, canal, active, estimated_closing
    from jsonb_to_recordset(coalesce(p_pl_rows, '[]'::jsonb))
      as x(id integer, name text, amount numeric, currency text, geography text, strategy text, sector text, status text, canal text, active boolean, estimated_closing text);
  end if;

  if p_companies_rows is not null then
    delete from public.portfolio_companies;
  end if;
  if p_companies_rows is not null and coalesce(jsonb_array_length(p_companies_rows), 0) > 0 then
    insert into public.portfolio_companies (
      entity_id, nom, tipus, segment, entrepreneurs, origen, geo, ticket, tvpi, rvpi_eur, dpi_eur,
      rev, ebitda, dfn, gross_ev, mult_entry, data_compr, mesos_operant, is_mock, quarters
    )
    select
      entity_id, nom, tipus, segment, entrepreneurs, origen, geo, ticket, tvpi, rvpi_eur, dpi_eur,
      rev, ebitda, dfn, gross_ev, mult_entry, data_compr, mesos_operant, is_mock, coalesce(quarters, '[]'::jsonb)
    from jsonb_to_recordset(coalesce(p_companies_rows, '[]'::jsonb))
      as x(
        entity_id text, nom text, tipus text, segment text, entrepreneurs text, origen text, geo text,
        ticket numeric, tvpi numeric, rvpi_eur numeric, dpi_eur numeric,
        rev numeric, ebitda numeric, dfn numeric, gross_ev numeric, mult_entry numeric,
        data_compr text, mesos_operant integer, is_mock boolean, quarters jsonb
      );
  end if;

  if p_searchers_rows is not null then
    delete from public.searchers;
  end if;
  if p_searchers_rows is not null and coalesce(jsonb_array_length(p_searchers_rows), 0) > 0 then
    insert into public.searchers (
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
    delete from public.fund_meta;
  end if;

  if p_private_entities_rows is not null then
    delete from public.private_entities
    where kind in ('company', 'vehicle');
  end if;
  if p_private_entities_rows is not null and coalesce(jsonb_array_length(p_private_entities_rows), 0) > 0 then
    insert into public.private_entities (
      id, kind, canonical_name, source_name, workbook_name, match_type,
      isin, country, first_investment_date, active, notes
    )
    select
      id, kind, canonical_name, source_name, workbook_name, match_type,
      isin, country, first_investment_date, coalesce(active, true), notes
    from jsonb_to_recordset(coalesce(p_private_entities_rows, '[]'::jsonb))
      as x(
        id text, kind text, canonical_name text, source_name text, workbook_name text, match_type text,
        isin text, country text, first_investment_date date, active boolean, notes text
      );
  end if;

  if p_fund_meta_rows is not null and coalesce(jsonb_array_length(p_fund_meta_rows), 0) > 0 then
    insert into public.fund_meta (vehicle_id, fons, tvpi)
    select vehicle_id, fons, tvpi
    from jsonb_to_recordset(coalesce(p_fund_meta_rows, '[]'::jsonb))
      as x(vehicle_id text, fons text, tvpi numeric);
  end if;
end;
$$;
