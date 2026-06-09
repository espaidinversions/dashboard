-- Restore prospective_cash_forecasts rows that were cascade-deleted when MOCKNIF
-- private_entities were merged into real NIFs by migrations 20260515000005/006/007.
-- All 7 funds below had seeded predictions wiped by the FK cascade.
-- Re-inserts using the real vehicle_id looked up by canonical_name.
--
-- Replaces the broken 20260605000002 (invalid nested PROCEDURE syntax).
-- Delete 20260605000002 before pushing — it was never applied.

do $$
declare
  funds jsonb := '[
    {
      "canonical": "Adams Street GSF7",
      "rows": [
        {"flow_type":"calls","year":2023,"amount":1511400},
        {"flow_type":"calls","year":2024,"amount":495000},
        {"flow_type":"dist","year":2026,"amount":264000},
        {"flow_type":"dist","year":2027,"amount":352000},
        {"flow_type":"dist","year":2028,"amount":616000},
        {"flow_type":"dist","year":2029,"amount":638000},
        {"flow_type":"dist","year":2030,"amount":418000},
        {"flow_type":"dist","year":2031,"amount":462000},
        {"flow_type":"dist","year":2032,"amount":440000},
        {"flow_type":"dist","year":2033,"amount":220000}
      ]
    },
    {
      "canonical": "Aldea Ventures I",
      "rows": [
        {"flow_type":"calls","year":2021,"amount":675000},
        {"flow_type":"calls","year":2022,"amount":318000},
        {"flow_type":"calls","year":2023,"amount":150000},
        {"flow_type":"calls","year":2024,"amount":214827},
        {"flow_type":"calls","year":2025,"amount":75000},
        {"flow_type":"dist","year":2026,"amount":225000},
        {"flow_type":"dist","year":2027,"amount":300000},
        {"flow_type":"dist","year":2028,"amount":300000},
        {"flow_type":"dist","year":2029,"amount":375000},
        {"flow_type":"dist","year":2030,"amount":375000},
        {"flow_type":"dist","year":2031,"amount":375000},
        {"flow_type":"dist","year":2032,"amount":75000}
      ]
    },
    {
      "canonical": "Alder III",
      "rows": [
        {"flow_type":"calls","year":2024,"amount":235860},
        {"flow_type":"calls","year":2025,"amount":198000},
        {"flow_type":"calls","year":2026,"amount":300000},
        {"flow_type":"calls","year":2027,"amount":240000},
        {"flow_type":"calls","year":2028,"amount":120000},
        {"flow_type":"dist","year":2028,"amount":60000},
        {"flow_type":"dist","year":2029,"amount":240000},
        {"flow_type":"dist","year":2030,"amount":240000},
        {"flow_type":"dist","year":2031,"amount":240000},
        {"flow_type":"dist","year":2032,"amount":240000},
        {"flow_type":"dist","year":2033,"amount":240000}
      ]
    },
    {
      "canonical": "Alpine IX",
      "rows": [
        {"flow_type":"calls","year":2023,"amount":117650},
        {"flow_type":"calls","year":2024,"amount":180352},
        {"flow_type":"calls","year":2025,"amount":106600},
        {"flow_type":"calls","year":2026,"amount":260000},
        {"flow_type":"calls","year":2027,"amount":260000},
        {"flow_type":"calls","year":2028,"amount":260000},
        {"flow_type":"dist","year":2027,"amount":97500},
        {"flow_type":"dist","year":2028,"amount":195000},
        {"flow_type":"dist","year":2029,"amount":260000},
        {"flow_type":"dist","year":2030,"amount":325000},
        {"flow_type":"dist","year":2031,"amount":494000},
        {"flow_type":"dist","year":2032,"amount":364000},
        {"flow_type":"dist","year":2033,"amount":334100}
      ]
    },
    {
      "canonical": "Altamar MidMarket",
      "rows": [
        {"flow_type":"calls","year":2020,"amount":700000},
        {"flow_type":"calls","year":2021,"amount":150000},
        {"flow_type":"calls","year":2023,"amount":400000},
        {"flow_type":"calls","year":2024,"amount":120000},
        {"flow_type":"dist","year":2024,"amount":162000},
        {"flow_type":"dist","year":2025,"amount":257000},
        {"flow_type":"dist","year":2026,"amount":340000},
        {"flow_type":"dist","year":2027,"amount":500000},
        {"flow_type":"dist","year":2028,"amount":500000},
        {"flow_type":"dist","year":2029,"amount":360000},
        {"flow_type":"dist","year":2030,"amount":300000},
        {"flow_type":"dist","year":2031,"amount":280000}
      ]
    },
    {
      "canonical": "Ara III",
      "rows": [
        {"flow_type":"calls","year":2023,"amount":159250},
        {"flow_type":"calls","year":2024,"amount":120582},
        {"flow_type":"calls","year":2025,"amount":193700},
        {"flow_type":"calls","year":2026,"amount":260000},
        {"flow_type":"calls","year":2027,"amount":260000},
        {"flow_type":"calls","year":2028,"amount":104000},
        {"flow_type":"calls","year":2029,"amount":26000},
        {"flow_type":"dist","year":2027,"amount":65000},
        {"flow_type":"dist","year":2028,"amount":260000},
        {"flow_type":"dist","year":2029,"amount":260000},
        {"flow_type":"dist","year":2030,"amount":390000},
        {"flow_type":"dist","year":2031,"amount":390000},
        {"flow_type":"dist","year":2032,"amount":357500},
        {"flow_type":"dist","year":2033,"amount":325000}
      ]
    },
    {
      "canonical": "Aurica IV",
      "rows": [
        {"flow_type":"calls","year":2022,"amount":232500},
        {"flow_type":"calls","year":2023,"amount":313950},
        {"flow_type":"calls","year":2024,"amount":115500},
        {"flow_type":"calls","year":2025,"amount":81000},
        {"flow_type":"calls","year":2026,"amount":300000},
        {"flow_type":"calls","year":2027,"amount":300000},
        {"flow_type":"dist","year":2027,"amount":225000},
        {"flow_type":"dist","year":2028,"amount":300000},
        {"flow_type":"dist","year":2029,"amount":375000},
        {"flow_type":"dist","year":2030,"amount":450000},
        {"flow_type":"dist","year":2031,"amount":300000},
        {"flow_type":"dist","year":2032,"amount":300000},
        {"flow_type":"dist","year":2033,"amount":225000}
      ]
    }
  ]';
  fund_rec jsonb;
  v_id     text;
  inserted int;
begin
  for fund_rec in select value from jsonb_array_elements(funds) loop
    select id into v_id
      from private_entities
     where canonical_name = fund_rec->>'canonical'
       and id not like 'MOCKNIF:%'
     limit 1;

    if v_id is null then
      raise warning 'vehicle not found for canonical_name=% — skipping', fund_rec->>'canonical';
      continue;
    end if;

    insert into prospective_cash_forecasts (vehicle_id, fons, flow_type, year, amount)
    select v_id,
           fund_rec->>'canonical',
           (r->>'flow_type')::text,
           (r->>'year')::integer,
           (r->>'amount')::numeric
      from jsonb_array_elements(fund_rec->'rows') r
    on conflict (vehicle_id, flow_type, year) do nothing;

    get diagnostics inserted = row_count;
    raise notice 'Restored % rows for % (%)', inserted, fund_rec->>'canonical', v_id;
  end loop;
end;
$$;
