# Private Entities Model

Alternatives no longer use mutable display names as identity.

## Canonical ID rules

- Private companies use `entity_id`
- Alternative vehicles use `vehicle_id`
- When `ID_Vehicles.xlsx` has a reliable match, that ID is the workbook `NIF`
- When the workbook does not cover a name, the repo generates a stable temporary mock ID like `MOCKNIF:COMPANY:TTPACK` or `MOCKNIF:VEHICLE:ALDEA-VENTURES`

The mock IDs are intentional. They avoid unsafe fuzzy matches while still making IDs immutable and rename-safe until you replace them with real NIFs.

## Source of truth

- Canonical names live in `public.private_entities`
- Display-name snapshots remain in `portfolio_companies.nom`, `capital_calls.fons`, and `fund_meta.fons`
- `rename_private_entity(...)` updates the registry and propagates the new name across those tables

The website should edit canonical names through the entity ID. IDs are read-only.

## Files

- Workbook catalog generator: `scripts/generate_private_entities_catalog.mjs`
- Registry migration generator: `scripts/generate_private_entities_migration.mjs`
- Mock-ID report generator: `scripts/generate_private_entities_mock_report.mjs`
- Seed migration generator: `scripts/generate_dashboard_seed_migration.mjs`
- Runtime matcher / resolver: `src/data/privateEntities.js`
- Generated workbook catalog: `src/generated/dashboard/privateEntitiesWorkbook.js`
- Generated mock-ID report: `docs/private-entities-mock-ids.md`

## Routine

After `ID_Vehicles.xlsx` changes:

1. `npm run dashboard:private-entities-catalog`
2. `npm run dashboard:private-entities-migration`
3. `npm run dashboard:private-entities-mock-report`
4. `npm run dashboard:seed-migration`
5. Review mock IDs in `docs/private-entities-mock-ids.md`
6. `npm run build`
7. `npx -y supabase@2.84.2 db push --include-all`

## Current limitation

The workbook does not cover every current private-company or vehicle display name. Those rows still get immutable mock IDs, but not all of them are NIF-backed yet. The matcher intentionally prefers explicit mock IDs over speculative mappings.

## Replacing a mock ID later

1. Add the real NIF mapping in `ID_Vehicles.xlsx` or `src/data/privateEntities.js`
2. Regenerate the catalog / migration scripts
3. Apply the migration
4. The canonical name can stay the same; only the entity ID changes from `MOCKNIF:...` to the real NIF
