-- Merge MOCKNIF fallback vehicles into their real NIF-based counterparts.
-- For each MOCKNIF entity that has a same-canonical_name counterpart without a MOCKNIF prefix:
--   1. Reassign capital_calls to the real entity
--   2. Reassign portfolio_companies to the real entity
--   3. Merge fund_meta (fill nulls on keeper, drop source row)
--   4. Delete the MOCKNIF private_entities row

do $$
declare
  r record;
  v_patch jsonb;
begin
  for r in
    select
      mock.id      as mock_id,
      real.id      as real_id,
      real.canonical_name as real_name
    from private_entities mock
    join private_entities real
      on real.canonical_name = mock.canonical_name
     and real.id not like 'MOCKNIF:%'
    where mock.id like 'MOCKNIF:%'
  loop
    raise notice 'Merging % → %  (%)', r.mock_id, r.real_id, r.real_name;

    -- 1. Reassign capital_calls
    update capital_calls
       set vehicle_id = r.real_id,
           fons       = r.real_name
     where vehicle_id = r.mock_id;

    -- 2. Reassign portfolio_companies
    update portfolio_companies
       set entity_id = r.real_id
     where entity_id = r.mock_id;

    -- 3. Merge fund_meta
    if exists (select 1 from fund_meta where vehicle_id = r.mock_id) then
      if not exists (select 1 from fund_meta where vehicle_id = r.real_id) then
        -- No keeper meta yet — just reassign
        update fund_meta
           set vehicle_id = r.real_id,
               fons       = r.real_name
         where vehicle_id = r.mock_id;
      else
        -- Fill keeper's nulls from the source row
        update fund_meta keeper
           set tvpi   = coalesce(keeper.tvpi,   src.tvpi),
               irr    = coalesce(keeper.irr,    src.irr),
               fi_end = coalesce(keeper.fi_end, src.fi_end)
          from fund_meta src
         where keeper.vehicle_id = r.real_id
           and src.vehicle_id    = r.mock_id;

        delete from fund_meta where vehicle_id = r.mock_id;
      end if;
    end if;

    -- 4. Delete the MOCKNIF entity
    delete from private_entities where id = r.mock_id;

  end loop;
end;
$$;
