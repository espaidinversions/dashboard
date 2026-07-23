# Dynamic Liquidity (Historical Time Series) — Design Spec

**Date:** 2026-07-23
**Status:** Proposed
**Depends on / extends:** `docs/superpowers/specs/2026-07-23-liquidity-portfoli-section-design.md` (the shipped static "Liquiditat" section, commit `037dae6`)

## 1. Problem

Liquidity is currently a **static snapshot**. The `liquidity_accounts` table
(migration `20260722000000_liquidity_accounts.sql`) is full-replace, one row per
account (`{id, nom, banc, section, saldo, saldo_native, divisa, data}`). Data flows
Excel → `mapLiquidityAccountsRows` → `saveLiquidityAccounts` → `useDashboardData`
(`d.liquidityAccounts`) → consumers. There is no history: you cannot see how cash
evolved over time, and every import overwrites the previous state.

## 2. Goal

Make liquidity **dynamic**: store a balance history per account, drive the existing
snapshot views from the *latest* balance, and add a cash-over-time trend chart. Move
data entry from Excel import to in-app superuser CRUD, with Supabase as the single
source of truth.

## 3. Locked decisions (confirmed)

1. **Normalized schema with history** — a registry table (one row per account) plus a
   time-series balances table.
2. **Supabase is the single source of truth.** One-time migration of existing
   `liquidity_accounts` rows into the new tables (each row → one account + one balance
   at its `data`).
3. **Drop the Excel import path for liquidity.** Balances are managed via in-app
   superuser CRUD.
4. **Add a cash-over-time trend chart** (stacked area by section). Existing
   donut/bar/table/summaries keep showing the *latest* balance per account.
5. **CRUD UI:** one shared editor reached from **both** a superuser-only button on the
   Liquiditat page and a new Admin → "Liquiditat" tab.
6. **Writes:** four granular `SECURITY DEFINER` + `is_superuser()` RPCs.
7. **Migration:** one self-contained new migration; drop the old table + RPC.
8. **Latest balance:** computed in JS into the existing account shape (consumers untouched).

## 4. Data model

### 4.1 `liquidity_registry` (one row per account)

| column       | type    | notes |
|--------------|---------|-------|
| `id`         | BIGINT identity PK | surrogate key referenced by balances |
| `nom`        | TEXT NOT NULL | account name |
| `banc`       | TEXT | nullable |
| `section`    | TEXT NOT NULL | CHECK IN (`alternatives`, `real-estate`, `mercats-publics`) |
| `divisa`     | TEXT NOT NULL DEFAULT `'EUR'` | account currency (a property of the account, not the balance) |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ DEFAULT now() | |

- **Uniqueness:** unique on `(nom, banc, section, divisa)` treating NULL `banc` as a
  value. Implementation: `UNIQUE NULLS NOT DISTINCT` on PG15+, otherwise a functional
  unique index on `(nom, coalesce(banc,''), section, divisa)`. (Plan resolves the exact
  form against the deployed Postgres version.)
- Index on `(section)` (mirrors the current table).

### 4.2 `liquidity_balances` (time series)

| column         | type    | notes |
|----------------|---------|-------|
| `id`           | BIGINT identity PK | |
| `account_id`   | BIGINT NOT NULL | REFERENCES `liquidity_registry(id)` ON DELETE CASCADE |
| `data`         | DATE NOT NULL | as-of date of the balance |
| `saldo`        | NUMERIC NOT NULL DEFAULT 0 | balance in EUR |
| `saldo_native` | NUMERIC | balance in the account's own currency (nullable) |
| `created_at`   | TIMESTAMPTZ DEFAULT now() | |
| `updated_at`   | TIMESTAMPTZ DEFAULT now() | |

- **Uniqueness:** `UNIQUE (account_id, data)` — one balance per account per date. Adding
  a balance for an existing date overwrites it (upsert `ON CONFLICT (account_id, data)`).
- Index on `(account_id, data DESC)` (latest lookup) and `(data)` (trend grouping).

Balances are entered on a **monthly cadence** in practice, but `data` remains a full
DATE; the model buckets by month for the trend (§6.2).

### 4.3 RLS

Both tables: `ENABLE ROW LEVEL SECURITY`; read policy `FOR SELECT TO authenticated
USING (true)`; write policy `FOR ALL TO authenticated USING (public.is_superuser())
WITH CHECK (public.is_superuser())`. Mirrors `liquidity_accounts`.

## 5. RPCs (superuser-only)

All `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`, each opening with
`IF NOT public.is_superuser() THEN RAISE EXCEPTION 'Forbidden'; END IF;` — mirroring
`replace_liquidity_accounts`.

- `upsert_liquidity_account(p_id bigint, p_nom text, p_banc text, p_section text, p_divisa text) RETURNS bigint`
  — `p_id` NULL → INSERT (returns new id); otherwise UPDATE the row. Returns the account id.
- `delete_liquidity_account(p_id bigint) RETURNS void` — deletes the account; balances
  cascade.
- `upsert_liquidity_balance(p_id bigint, p_account_id bigint, p_data date, p_saldo numeric, p_saldo_native numeric) RETURNS bigint`
  — INSERT or, on `(account_id, data)` conflict, UPDATE `saldo`/`saldo_native`. `p_id`
  present → update that row. Returns the balance id.
- `delete_liquidity_balance(p_id bigint) RETURNS void`.

RPCs are `SECURITY DEFINER` (bypass RLS) but self-check `is_superuser()`, so the guard
holds even though the RLS write policy also restricts direct table writes.

## 6. Client data layer

### 6.1 DB access — `src/db/liquidityAccounts.js`

Rewritten (filename kept to minimize churn; the module now covers registry + balances):

- `loadLiquidity()` → `{ registry: [...], balances: [...] }` (camelCase via mappers),
  ordered `registry` by `section, nom` and `balances` by `account_id, data`. Degrades to
  `{ registry: [], balances: [] }` when Supabase is unavailable or tables are missing
  (same defensive behaviour as today's `loadLiquidityAccounts`).
- `upsertLiquidityAccount(account)`, `deleteLiquidityAccount(id)`,
  `upsertLiquidityBalance(balance)`, `deleteLiquidityBalance(id)` — thin wrappers over
  `supabase.rpc(...)`, returning `{ id?, error }`. On a missing-RPC error (`PGRST202`),
  return a friendly Catalan message like `atomicReplace` does ("Aplica les migracions de
  Supabase pendents…"). Each mutation calls `logAudit(...)` (existing helper) for the
  financial audit trail.

### 6.2 Model — `src/data/liquidityModel.js`

Existing `buildLiquiditySummary` / `buildLiquidityByBank` / `buildLiquidityByCurrency`
are **unchanged** — they keep operating on an array of accounts in the current shape.
Two new pure functions:

- `buildLatestAccounts(registry, balances)` → array of
  `{ id, nom, banc, section, saldo, saldo_native, divisa, data }` (the **existing account
  shape**). For each registry account, pick its balance with the max `data`
  (`UNIQUE(account_id, data)` guarantees no same-date ties; documented fallback if ever
  needed: higher `updated_at`, then higher `id`). Accounts with no balances yield
  `saldo: 0, saldo_native: null, data: null`.
- `buildLiquidityTrend(registry, balances)` → `{ months: string[], series: [{ section,
  values: number[] }] }` for the stacked area:
  - `months` = sorted unique `YYYY-MM` buckets present across all balances.
  - For each month and section, sum over that section's accounts of the account's
    **latest balance as-of ≤ that month (carry-forward)**; an account with no balance
    yet at that month contributes 0. Carry-forward keeps the area continuous when an
    account isn't updated every month.
  - Empty input → `{ months: [], series: [] }`.

### 6.3 Mappers — `src/data/mappers.js`

Add `rowToLiquidityRegistry` / `liquidityRegistryToRow` and `rowToLiquidityBalance` /
`liquidityBalanceToRow`. The existing `rowToLiquidityAccount` / `liquidityAccountToRow`
are removed once no longer referenced (they mapped the old flat table).

### 6.4 Data hook — `src/components/hooks/useDashboardData.js`

- Load via `loadLiquidity()`; hold `liquidityRegistry` and `liquidityBalances` state.
- Expose (memoized) `liquidityAccounts = buildLatestAccounts(registry, balances)` under
  the **same `d.liquidityAccounts` name** — existing consumers unchanged.
- Also expose `d.liquidityRegistry`, `d.liquidityBalances` (for the editor and trend) and
  `reloadLiquidity()` which re-fetches both and updates state immutably.
- Remove the Excel liquidity save branch (`useDashboardData.js:308-312`).

## 7. Dropping the Excel import path (liquidity only)

- Remove the liquidity sheet detection in `DataLoader.jsx:48-49`
  (`sheet("Liquiditat")` → `mapLiquidityAccountsRows`).
- Remove the now-dead `mapLiquidityAccountsRows` (and `normalizeLiquiditySection` if
  unused elsewhere) from `src/utils/parsers.js`, and their tests.
- Other tabs' Excel imports (capital calls, pipeline, PM, entities, …) are untouched.

## 8. UI

### 8.1 Trend chart — `src/components/liquidity/LiquidityCharts.jsx`

Add `LiquidityTrendChart({ registry, balances, tc })`: an ECharts **stacked area** using
`ecTheme`, `CHART_PALETTE`, and the existing `SECTION_LABELS`. X-axis = `months`; one
stacked series per section (`fmtM` formatting, shared tooltip). Rendered full-width in
`LiquidityOverview` above the donut/bar grid. Empty state reuses the existing
`EmptyState`.

### 8.2 Shared editor — `src/components/liquidity/LiquidityEditor.jsx` (new)

Superuser-only. Two levels, reusing `AddRowModal`, `EditableCell`, `DeleteRowButton`:

- **Accounts table** (registry): columns `nom`, `banc`, `section`, `divisa`, plus latest
  balance (read-only, from `buildLatestAccounts`). Add/edit via `AddRowModal`
  (`section` = select over the three sections; `divisa` = select), delete via
  `DeleteRowButton` (cascades balances — confirm copy states this).
- **Balance history** for the selected account: list of `{ data, saldo, saldo_native }`
  sorted by date desc; add/edit a monthly balance via `AddRowModal` (`data` = date,
  `saldo` = EUR number required, `saldo_native` = number, shown when `divisa ≠ EUR`),
  delete via `DeleteRowButton`. No FX conversion — the user enters both EUR and native
  amounts (matches the current data model; YAGNI on rate lookup).
- Every mutation calls the matching db-layer function, then `reloadLiquidity()`; state
  updates are immutable.

### 8.3 Entry points (both)

- **Liquiditat page:** `LiquidityOverview` renders a "Gestiona" button gated by
  `canEditSection("liquidity")` (`ACCESS_SUPERUSER`) that reveals `LiquidityEditor`
  in-context; charts/trend reflect edits after `reloadLiquidity()`.
- **Admin panel:** new `{ id: "liquidity", label: "Liquiditat" }` entry in
  `AdminPanel.jsx` `NAV_BASE`, rendering the same `LiquidityEditor`.

Server-side, the RPCs enforce `is_superuser()` regardless of the client gate. Note the
existing grantable **`liquidity` permission governs view access**; **editing requires
superuser** (`canEditSection("liquidity")`).

## 9. Migration (single, self-contained)

New migration `supabase/migrations/<ts>_liquidity_history.sql`:

1. `CREATE TABLE liquidity_registry` and `liquidity_balances` (§4), with constraints,
   indexes, RLS policies.
2. `CREATE OR REPLACE FUNCTION` the four RPCs (§5).
3. **Copy existing data:** for each `liquidity_accounts` row, insert one registry row
   (`nom, banc, section, divisa`) and one balance (`account_id`, `data` — falling back to
   a sensible default such as `now()::date` if `data` is NULL —, `saldo`, `saldo_native`),
   in a single statement/CTE so `account_id` links correctly.
4. `DROP FUNCTION IF EXISTS public.replace_liquidity_accounts(jsonb);`
   `DROP TABLE IF EXISTS liquidity_accounts;`

Existing migrations remain immutable. Applied via the Supabase MCP `apply_migration`
(and committed to `supabase/migrations/`).

## 10. Testing

- **`test/liquidityModel.test.js`** — extend (AAA):
  - `buildLatestAccounts`: picks max-`data` balance per account; accounts with no
    balances → `saldo 0`, `data null`; multiple accounts independent.
  - `buildLiquidityTrend`: month buckets sorted; carry-forward across gaps; per-section
    sums; empty input → empty.
  - Existing `buildLiquiditySummary`/`byBank`/`byCurrency` tests stay green (unchanged).
- **Mapper tests** for the new registry/balance row converters.
- Remove the `mapLiquidityAccountsRows` parser test (dropped path); any net change in
  the 184-test baseline is intentional and called out in the plan.
- Gate before deploy: `npm run build` **and** `npm test` (baseline 184 must pass, minus
  the intentionally removed parser test plus the new model/mapper tests).

## 11. Out of scope (YAGNI)

- FX rate lookup / auto EUR conversion (user enters both amounts).
- Bulk balance import / CSV upload (Excel path is being removed by design).
- Editing history of the `data`-less accounts beyond the one migrated balance.
- Per-account trend drill-down (only section-level stacked area for now).

## 12. Files touched

**New:** the migration; `src/components/liquidity/LiquidityEditor.jsx`.
**Modified:** `src/db/liquidityAccounts.js`, `src/data/liquidityModel.js`,
`src/data/mappers.js`, `src/components/hooks/useDashboardData.js`,
`src/components/liquidity/LiquidityCharts.jsx`,
`src/components/liquidity/LiquidityOverview.jsx`, `src/components/AdminPanel.jsx`,
`src/components/DataLoader.jsx`, `src/utils/parsers.js`, `test/liquidityModel.test.js`
(+ mapper test file).
