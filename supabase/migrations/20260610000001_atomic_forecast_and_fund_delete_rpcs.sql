-- Migration: transactional RPCs for forecast replace and fund deletion
-- 2026-06-10
--
-- saveProspectiveCashForecasts did DELETE then INSERT as two PostgREST calls:
-- an interruption between them loses forecast data with no recovery path.
-- deleteFund did two sequential deletes (capital_calls, fund_meta) that could
-- leave an orphaned fund_meta row. Both now run in a single transaction.

-- ── replace_prospective_cash_forecasts ─────────────────────────────────────

create or replace function public.replace_prospective_cash_forecasts(
  p_vehicle_ids jsonb,
  p_rows jsonb
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

  if coalesce(jsonb_array_length(p_vehicle_ids), 0) > 0 then
    delete from prospective_cash_forecasts
    where vehicle_id in (select jsonb_array_elements_text(p_vehicle_ids));
  end if;

  if coalesce(jsonb_array_length(p_rows), 0) > 0 then
    insert into prospective_cash_forecasts (vehicle_id, fons, flow_type, year, amount, updated_at)
    select vehicle_id, fons, flow_type, year, amount, now()
    from jsonb_to_recordset(p_rows)
    as x(vehicle_id text, fons text, flow_type text, year integer, amount numeric);
  end if;
end;
$$;

-- ── delete_fund ────────────────────────────────────────────────────────────

create or replace function public.delete_fund(p_vehicle_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superuser() then
    raise exception 'Forbidden';
  end if;
  if p_vehicle_id is null or length(trim(p_vehicle_id)) = 0 then
    raise exception 'vehicle_id required';
  end if;

  delete from capital_calls where vehicle_id = p_vehicle_id;
  delete from fund_meta where vehicle_id = p_vehicle_id;
end;
$$;
