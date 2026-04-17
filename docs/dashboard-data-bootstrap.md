# Dashboard Data Bootstrap

The editable dashboard is now database-authoritative. `searchers`, `participades`, and investment-detail views should read from Supabase, not bundled runtime arrays.

## Baseline Seed Path

When a target Supabase environment is empty, seed it from the legacy in-repo dashboard datasets by generating and applying the baseline migration:

1. `npm run dashboard:seed-migration`
2. `npx -y supabase@2.84.2 db push --include-all`

The generator writes [supabase/migrations/202604161430_seed_dashboard_baseline.sql](../supabase/migrations/202604161430_seed_dashboard_baseline.sql).

## Searcher Deduplication Rule

Legacy searcher seed data contained duplicate `nom` values. The remote database enforces uniqueness on `searchers.nom`, so the generator now collapses duplicates before embedding them in the migration.

Deduplication behavior:

- Rows are grouped by exact `nom`.
- The first populated value wins by default.
- Later rows can fill blanks.
- For conflicting non-empty strings, the longer value wins because it is usually the more specific legal/person name variant.
- `isMock` is preserved if any merged row is mocked.

This keeps the migration deterministic while still allowing later manual cleanup in the website, which is now the source of truth.

## When To Run It

Run the bootstrap flow when:

- provisioning a new Supabase environment
- production/local dashboard tables were cleared
- switching a dashboard area from bundled data to DB-authoritative storage

After the migration is applied, run `npm run verify`.
