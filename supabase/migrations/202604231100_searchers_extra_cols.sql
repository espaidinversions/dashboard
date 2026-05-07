ALTER TABLE public.searchers
  ADD COLUMN IF NOT EXISTS status_screening_code integer,
  ADD COLUMN IF NOT EXISTS status_cerca_code integer,
  ADD COLUMN IF NOT EXISTS status_cerca text,
  ADD COLUMN IF NOT EXISTS status_adquisicio_code integer,
  ADD COLUMN IF NOT EXISTS status_adquisicio text,
  ADD COLUMN IF NOT EXISTS web text,
  ADD COLUMN IF NOT EXISTS comentaris text,
  ADD COLUMN IF NOT EXISTS database_intro_date date,
  ADD COLUMN IF NOT EXISTS companyia_adquirida text,
  ADD COLUMN IF NOT EXISTS irr numeric,
  ADD COLUMN IF NOT EXISTS dpi numeric,
  ADD COLUMN IF NOT EXISTS nif text;

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
    delete from capital_calls;
  end if;
  if p_cc_rows is not null and coalesce(jsonb_array_length(p_cc_rows), 0) > 0 then
    insert into capital_calls (vehicle_id, fons, tipus, cat, data, mes, year, fy, vcpe, est, eur, divisa)
    select vehicle_id, fons, tipus, cat, data, mes, year, fy, vcpe, est, eur, divisa
    from jsonb_to_recordset(coalesce(p_cc_rows, '[]'::jsonb))
      as x(vehicle_id text, fons text, tipus text, cat text, data text, mes integer, year integer, fy text, vcpe text, est text, eur numeric, divisa text);
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
    delete from searchers;
  end if;
  if p_searchers_rows is not null and coalesce(jsonb_array_length(p_searchers_rows), 0) > 0 then
    insert into searchers (
      nom, tipus, modalitat, geo,
      status_screening_code, status_screening,
      status_cerca_code, status_cerca,
      status_adquisicio_code, status_adquisicio,
      form_entrada, intro_per, companyia_adquirida,
      searcher1, searcher2, escola1, escola2,
      web, comentaris, ticket, tvpi,
      data_inici, database_intro_date, data_compr,
      mesos_cercant, irr, dpi, equity_stake, nif, is_mock
    )
    select
      nom, tipus, modalitat, geo,
      status_screening_code, status_screening,
      status_cerca_code, status_cerca,
      status_adquisicio_code, status_adquisicio,
      form_entrada, intro_per, companyia_adquirida,
      searcher1, searcher2, escola1, escola2,
      web, comentaris, ticket, tvpi,
      data_inici, database_intro_date, data_compr,
      mesos_cercant, irr, dpi, equity_stake, nif, is_mock
    from jsonb_to_recordset(coalesce(p_searchers_rows, '[]'::jsonb))
      as x(
        nom text, tipus text, modalitat text, geo text,
        status_screening_code integer, status_screening text,
        status_cerca_code integer, status_cerca text,
        status_adquisicio_code integer, status_adquisicio text,
        form_entrada text, intro_per text, companyia_adquirida text,
        searcher1 text, searcher2 text, escola1 text, escola2 text,
        web text, comentaris text, ticket numeric, tvpi numeric,
        data_inici text, database_intro_date text, data_compr text,
        mesos_cercant integer, irr numeric, dpi numeric, equity_stake numeric, nif text, is_mock boolean
      );
  end if;

  if p_fund_meta_rows is not null then
    delete from fund_meta;
  end if;
  if p_private_entities_rows is not null then
    delete from private_entities
    where kind in ('company', 'vehicle');
  end if;
  if p_private_entities_rows is not null and coalesce(jsonb_array_length(p_private_entities_rows), 0) > 0 then
    insert into private_entities (id, kind, canonical_name, source_name, workbook_name, match_type)
    select id, kind, canonical_name, source_name, workbook_name, match_type
    from jsonb_to_recordset(coalesce(p_private_entities_rows, '[]'::jsonb))
      as x(id text, kind text, canonical_name text, source_name text, workbook_name text, match_type text);
  end if;
  if p_fund_meta_rows is not null and coalesce(jsonb_array_length(p_fund_meta_rows), 0) > 0 then
    insert into fund_meta (vehicle_id, fons, tvpi)
    select vehicle_id, fons, tvpi
    from jsonb_to_recordset(coalesce(p_fund_meta_rows, '[]'::jsonb))
      as x(vehicle_id text, fons text, tvpi numeric);
  end if;
end;
$$;
