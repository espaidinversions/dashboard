-- Migration: align dashboard schema with DB-backed editing as source of truth
-- 2026-04-16 10:30

do $$
begin
  if exists (
    select 1
    from public.searchers
    where nom is null or btrim(nom) = ''
  ) then
    raise exception 'searchers.nom contains null/blank values; clean data before applying this migration';
  end if;
end
$$;

update public.searchers
set data_inici = null
where btrim(coalesce(data_inici::text, '')) = '';

update public.searchers
set data_compr = null
where btrim(coalesce(data_compr::text, '')) = '';

update public.portfolio_companies
set data_compr = null
where btrim(coalesce(data_compr::text, '')) = '';

alter table public.searchers
  alter column nom set not null,
  alter column data_inici type date using data_inici::date,
  alter column data_compr type date using data_compr::date;

alter table public.portfolio_companies
  alter column data_compr type date using data_compr::date;
