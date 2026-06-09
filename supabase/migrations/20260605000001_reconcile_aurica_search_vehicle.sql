-- Reconcile MOCKNIF:VEHICLE:AURICA-SEARCH-FUNDS-I → real NIF A44662351.
-- The reconciliation migration (20260514000000) missed this pair because
-- the MOCKNIF canonical_name "Aurica Search Funds I" did not match the real
-- entity canonical_name "Aurica Search Fund" (singular, no ordinal).

do $$
declare
  mock_id  constant text := 'MOCKNIF:VEHICLE:AURICA-SEARCH-FUNDS-I';
  real_id  constant text := 'A44662351';
  real_name text;
begin
  -- Guard: skip if mock is already gone (idempotent)
  if not exists (select 1 from private_entities where id = mock_id) then
    raise notice 'SKIP: % not found — already merged or never existed', mock_id;
    return;
  end if;

  select canonical_name into real_name from private_entities where id = real_id;
  if real_name is null then
    raise exception 'Real entity % not found — cannot proceed', real_id;
  end if;

  raise notice 'Merging % → % (%)', mock_id, real_id, real_name;

  -- 1. Reassign capital_calls
  update capital_calls
     set vehicle_id = real_id, fons = real_name
   where vehicle_id = mock_id;

  -- 2. Reassign portfolio_companies
  update portfolio_companies
     set entity_id = real_id
   where entity_id = mock_id;

  -- 3. Merge fund_meta
  if exists (select 1 from fund_meta where vehicle_id = mock_id) then
    if not exists (select 1 from fund_meta where vehicle_id = real_id) then
      update fund_meta set vehicle_id = real_id, fons = real_name where vehicle_id = mock_id;
    else
      update fund_meta keeper
         set tvpi   = coalesce(keeper.tvpi,   src.tvpi),
             irr    = coalesce(keeper.irr,    src.irr),
             fi_end = coalesce(keeper.fi_end, src.fi_end)
        from fund_meta src
       where keeper.vehicle_id = real_id and src.vehicle_id = mock_id;
      delete from fund_meta where vehicle_id = mock_id;
    end if;
  end if;

  -- 4. Reassign prospective_cash_forecasts
  --    PRIMARY KEY is (vehicle_id, flow_type, year) so delete any pre-existing
  --    real_id rows that would conflict before updating.
  delete from prospective_cash_forecasts
   where vehicle_id = real_id
     and (flow_type, year) in (
       select flow_type, year from prospective_cash_forecasts where vehicle_id = mock_id
     );

  update prospective_cash_forecasts
     set vehicle_id = real_id
   where vehicle_id = mock_id;

  -- 5. Delete the orphaned MOCKNIF private_entity
  delete from private_entities where id = mock_id;

  raise notice 'Done: % merged into %', mock_id, real_id;
end;
$$;
