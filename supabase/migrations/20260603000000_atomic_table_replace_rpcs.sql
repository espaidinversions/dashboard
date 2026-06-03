-- Migration: per-table atomic replace RPCs
-- Replaces the snapshot-based recovery workaround in saveCapitalCalls,
-- saveCompanies, savePipeline, saveSearchers with true transactional atomicity.
-- Each function runs DELETE + INSERT inside a single plpgsql transaction block;
-- any INSERT failure rolls back the DELETE automatically.

-- ── replace_capital_calls ──────────────────────────────────────────────────

create or replace function public.replace_capital_calls(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superuser() then
    raise exception 'Forbidden';
  end if;

  delete from capital_calls;

  if coalesce(jsonb_array_length(p_rows), 0) > 0 then
    insert into capital_calls (
      vehicle_id, fons, tipus, cat, data, mes, year, fy, est, eur, divisa,
      comentaris, amount_native, fx_rate, fx_source,
      recallable, non_recallable, from_recallable
    )
    select
      vehicle_id, fons, tipus, cat, data, mes, year, fy, est, eur, divisa,
      comentaris, amount_native, fx_rate, fx_source,
      recallable, non_recallable, from_recallable
    from jsonb_to_recordset(p_rows)
    as x(
      vehicle_id text, fons text, tipus text, cat text, data text,
      mes integer, year integer, fy text, est text, eur numeric, divisa text,
      comentaris text, amount_native numeric, fx_rate numeric, fx_source text,
      recallable numeric, non_recallable numeric, from_recallable numeric
    );
  end if;
end;
$$;

-- ── replace_portfolio_companies ───────────────────────────────────────────

create or replace function public.replace_portfolio_companies(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superuser() then
    raise exception 'Forbidden';
  end if;

  delete from portfolio_companies;

  if coalesce(jsonb_array_length(p_rows), 0) > 0 then
    insert into portfolio_companies (
      entity_id, nom, tipus, segment, entrepreneurs, origen, geo,
      ticket, tvpi, rvpi_eur, dpi_eur,
      rev, ebitda, dfn, gross_ev, mult_entry,
      data_compr, mesos_operant, is_mock, quarters
    )
    select
      entity_id, nom, tipus, segment, entrepreneurs, origen, geo,
      ticket, tvpi, rvpi_eur, dpi_eur,
      rev, ebitda, dfn, gross_ev, mult_entry,
      data_compr, mesos_operant, is_mock, coalesce(quarters, '[]'::jsonb)
    from jsonb_to_recordset(p_rows)
    as x(
      entity_id text, nom text, tipus text, segment text,
      entrepreneurs text, origen text, geo text,
      ticket numeric, tvpi numeric, rvpi_eur numeric, dpi_eur numeric,
      rev numeric, ebitda numeric, dfn numeric, gross_ev numeric, mult_entry numeric,
      data_compr text, mesos_operant integer, is_mock boolean, quarters jsonb
    );
  end if;
end;
$$;

-- ── replace_pipeline ──────────────────────────────────────────────────────

create or replace function public.replace_pipeline(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superuser() then
    raise exception 'Forbidden';
  end if;

  delete from pipeline;

  if coalesce(jsonb_array_length(p_rows), 0) > 0 then
    insert into pipeline (
      id, name, amount, currency, geography, strategy, sector,
      status, canal, active, estimated_closing, manager
    )
    select
      id, name, amount, currency, geography, strategy, sector,
      status, canal, active, estimated_closing, manager
    from jsonb_to_recordset(p_rows)
    as x(
      id integer, name text, amount numeric, currency text,
      geography text, strategy text, sector text,
      status text, canal text, active boolean, estimated_closing text, manager text
    );
  end if;
end;
$$;

-- ── replace_searchers ─────────────────────────────────────────────────────

create or replace function public.replace_searchers(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superuser() then
    raise exception 'Forbidden';
  end if;

  delete from searchers;

  if coalesce(jsonb_array_length(p_rows), 0) > 0 then
    insert into searchers (
      nom, tipus, modalitat, geo,
      status_screening_code, status_screening,
      status_cerca_code, status_cerca,
      status_adquisicio_code, status_adquisicio,
      form_entrada, intro_per, companyia_adquirida,
      searcher1, searcher2, escola1, escola2,
      web, comentaris, ticket, tvpi,
      data_inici, database_intro_date, data_compr,
      mesos_cercant, irr, dpi, equity_stake, nif, label, is_mock
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
      mesos_cercant, irr, dpi, equity_stake, nif, label, is_mock
    from jsonb_to_recordset(p_rows)
    as x(
      nom text, tipus text, modalitat text, geo text,
      status_screening_code integer, status_screening text,
      status_cerca_code integer, status_cerca text,
      status_adquisicio_code integer, status_adquisicio text,
      form_entrada text, intro_per text, companyia_adquirida text,
      searcher1 text, searcher2 text, escola1 text, escola2 text,
      web text, comentaris text, ticket numeric, tvpi numeric,
      data_inici text, database_intro_date text, data_compr text,
      mesos_cercant integer, irr numeric, dpi numeric,
      equity_stake numeric, nif text, label text, is_mock boolean
    );
  end if;
end;
$$;
