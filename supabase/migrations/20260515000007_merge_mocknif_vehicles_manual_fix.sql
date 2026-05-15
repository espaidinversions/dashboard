-- Re-run the MOCKNIF merge with a fix for portfolio_companies unique constraint.
-- If the real entity already has a portfolio_companies row, delete the mock row instead.

do $$
declare
  pairs text[][] := array[
    -- [mock_id, real_id]
    array['MOCKNIF:VEHICLE:ADAMS-STREET-GSF7',                     'LUXB230846'],
    array['MOCKNIF:VEHICLE:ARCANO-PE-COINVEST-2024',               'A19792852'],
    array['MOCKNIF:VEHICLE:CAP-DYNAMICS-MM-V',                     'LUXB145913'],
    array['MOCKNIF:VEHICLE:CAP-DYNAMICS-MM-VI',                    'LUXN0287860A'],
    array['MOCKNIF:VEHICLE:CAP-DYNAMICS-SEC-VI',                   'LUXB262276'],
    array['MOCKNIF:VEHICLE:CASF-V',                                'FRA911224285'],
    array['MOCKNIF:VEHICLE:CS-SEASONS-GLOBAL-IV',                  'LUXB230623'],
    array['MOCKNIF:VEHICLE:EBN-PRE-IPO-II',                        'V88491808'],
    array['MOCKNIF:VEHICLE:EBN-PRE-IPO-III',                       'V05299128'],
    array['MOCKNIF:VEHICLE:FRONTENAC-XIII',                        'USA000187'],
    array['MOCKNIF:VEHICLE:GALDANA-ASIA-I',                        'LUX33463685'],
    array['MOCKNIF:VEHICLE:IK-SMALL-CAPS-IV',                      'LUXB288304'],
    array['MOCKNIF:VEHICLE:INVERACTIVA-PLUS-II',                   'B02904464'],
    array['MOCKNIF:VEHICLE:INVERACTIVA-PLUS-III',                  'B09621889'],
    array['MOCKNIF:VEHICLE:INVERACTIVA-PLUS-IV-D',                 'B70655634'],
    array['MOCKNIF:VEHICLE:INVERACTIVA-SIA-DEUDA-I',               'A67627356'],
    array['MOCKNIF:VEHICLE:INVEREADY-VF-III',                      'V75230359'],
    array['MOCKNIF:VEHICLE:INVIVO-III-FCRE',                       'V56509813'],
    array['MOCKNIF:VEHICLE:JPM-VINTAGE-2018',                      'V88140660'],
    array['MOCKNIF:VEHICLE:JPM-VINTAGE-2020',                      'V88545793'],
    array['MOCKNIF:VEHICLE:JPM-VINTAGE-2022',                      'V67917724'],
    array['MOCKNIF:VEHICLE:MAIN-CAPITAL-VIII',                     'NLD91475376'],
    array['MOCKNIF:VEHICLE:MAIN-FOUNDATION-II',                    'NLD91485991'],
    array['MOCKNIF:VEHICLE:NORVESTOR-NOVA',                        'LUXN0367634C'],
    array['MOCKNIF:VEHICLE:SALOMONTE',                             'NLD14901645B'],
    array['MOCKNIF:VEHICLE:QUALITUR_CONSULTING,_SL_(FEEL_AT_HOME)','B63907869'],
    array['MOCKNIF:VEHICLE:WORKTOGETHER_(COLLECTIVE)',             'B67054338']
  ];
  p text[];
  mock_id text;
  real_id text;
  real_name text;
begin
  foreach p slice 1 in array pairs loop
    mock_id := p[1];
    real_id  := p[2];

    -- Skip if mock doesn't exist (idempotent)
    if not exists (select 1 from private_entities where id = mock_id) then
      raise notice 'SKIP (not found): %', mock_id;
      continue;
    end if;

    select canonical_name into real_name from private_entities where id = real_id;
    if real_name is null then
      raise notice 'SKIP (real not found): % → %', mock_id, real_id;
      continue;
    end if;

    raise notice 'Merging % → %  (%)', mock_id, real_id, real_name;

    -- 1. Reassign capital_calls
    update capital_calls
       set vehicle_id = real_id, fons = real_name
     where vehicle_id = mock_id;

    -- 2. Reassign portfolio_companies (skip if real already has a row)
    if exists (select 1 from portfolio_companies where entity_id = real_id) then
      raise notice '  portfolio_companies: real already exists, deleting mock row';
      delete from portfolio_companies where entity_id = mock_id;
    else
      update portfolio_companies
         set entity_id = real_id
       where entity_id = mock_id;
    end if;

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

    -- 4. Delete mock entity
    delete from private_entities where id = mock_id;

  end loop;
end;
$$;
