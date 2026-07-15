-- The 2026-05 CC import appended search-fund capital calls that already
-- existed under tipus 'Aportació capital' / 'Ampliació capital' / 'Préstec',
-- writing them again as tipus 'Aportació'. Remove the re-imported twin of
-- each duplicate group (same fons, vehicle, cat, date, amount), keeping the
-- original row and its est classification (e.g. 'Search Fund - Participada'
-- on acquired searchers, which the re-import had reset to 'Cerca').
-- Applied to production 2026-07-15 (26 rows removed; verified 0 duplicate
-- groups remain).
delete from capital_calls c
where c.tipus = 'Aportació'
  and exists (
    select 1
    from capital_calls o
    where o.id < c.id
      and o.tipus <> 'Aportació'
      and o.fons = c.fons
      and o.cat = c.cat
      and o.vehicle_id is not distinct from c.vehicle_id
      and o.data is not distinct from c.data
      and o.eur is not distinct from c.eur
  );
