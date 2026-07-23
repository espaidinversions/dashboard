# Dynamic Liquidity (Historical Time Series) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give liquidity a per-account balance history, drive the existing snapshot views from the latest balance, add a cash-over-time trend chart, and move data entry from Excel to in-app superuser CRUD.

**Architecture:** Normalized Supabase schema — `liquidity_registry` (one row per account) + `liquidity_balances` (time series) — with superuser-only CRUD RPCs and RLS. The client loads both tables and computes the "latest balance per account" in JS into the *existing* account shape, so current consumers are untouched; only a new stacked-area trend chart reads the full series.

**Tech Stack:** React 19 + Vite, Supabase (Postgres, RLS, SECURITY DEFINER RPCs), ECharts (`echarts-for-react`), `node:test` for unit tests. Plain JS/JSX (no TypeScript). Catalan UI, English var names, inline JSX styles via `tc`.

## Global Constraints

- Work on `master`. Deploy = `git push origin master` (→ Vercel).
- Gate before any deploy: `npm run build` **and** `npm test` must pass (baseline 184 tests, adjusted by this plan: −1 removed parser test, + new model/mapper tests).
- No co-author trailer on commits (attribution disabled globally).
- Existing Supabase migrations are immutable — add a new migration only.
- Test runner: `node --test <file>` (uses `node:test` + `node:assert/strict`). Full suite: `npm test`.
- Reuse existing patterns: `KpiCard`, `ReactECharts`, `CHART_PALETTE`, `ecTheme`, `SECTION_LABELS`, `AddRowModal`, `EditableCell`, `DeleteRowButton`, the `is_superuser()` RPC guard + RLS conventions.
- Account shape used across the app (must be preserved by `buildLatestAccounts`): `{ id, nom, banc, section, saldo, saldoNative, divisa, data }` (camelCase; `saldoNative`, not `saldo_native`).
- Section values: `alternatives`, `real-estate`, `mercats-publics`. `SECTION_LABELS` (in `LiquidityCharts.jsx`): Alternatius / Real Estate / Mercats Públics.
- GateGuard hook: the FIRST Bash/Edit/Write that trips the fact gate must restate the required facts, then retry the same call.

---

### Task 1: Supabase migration — schema, RLS, RPCs, data copy, drop old

**Files:**
- Create: `supabase/migrations/20260723120000_liquidity_history.sql`
- Apply via: Supabase MCP `apply_migration` (name `liquidity_history`, the SQL below)

**Interfaces:**
- Produces: tables `liquidity_registry(id, nom, banc, section, divisa, created_at, updated_at)` and `liquidity_balances(id, account_id, data, saldo, saldo_native, created_at, updated_at)`; RPCs `upsert_liquidity_account(p_id, p_nom, p_banc, p_section, p_divisa) → bigint`, `delete_liquidity_account(p_id) → void`, `upsert_liquidity_balance(p_id, p_account_id, p_data, p_saldo, p_saldo_native) → bigint`, `delete_liquidity_balance(p_id) → void`. Drops `liquidity_accounts` + `replace_liquidity_accounts`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260723120000_liquidity_history.sql`:

```sql
-- Dynamic liquidity: normalized registry + balance history, superseding the
-- flat full-replace liquidity_accounts table with a time series.

-- 1. Registry: one row per account.
CREATE TABLE IF NOT EXISTS liquidity_registry (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom        TEXT NOT NULL,
  banc       TEXT,
  section    TEXT NOT NULL CHECK (section IN ('alternatives', 'real-estate', 'mercats-publics')),
  divisa     TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NULL banc treated as '' so (nom, banc, section, divisa) is a real identity key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_liquidity_registry_identity
  ON liquidity_registry (nom, coalesce(banc, ''), section, divisa);
CREATE INDEX IF NOT EXISTS idx_liquidity_registry_section ON liquidity_registry(section);

-- 2. Balances: time series, one row per account per date.
CREATE TABLE IF NOT EXISTS liquidity_balances (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id   BIGINT NOT NULL REFERENCES liquidity_registry(id) ON DELETE CASCADE,
  data         DATE NOT NULL,
  saldo        NUMERIC NOT NULL DEFAULT 0,
  saldo_native NUMERIC,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, data)
);
CREATE INDEX IF NOT EXISTS idx_liquidity_balances_account_data
  ON liquidity_balances (account_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_balances_data ON liquidity_balances (data);

-- 3. RLS: read authenticated, write superuser (mirrors liquidity_accounts).
ALTER TABLE liquidity_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS liquidity_registry_read_authenticated ON liquidity_registry;
CREATE POLICY liquidity_registry_read_authenticated
  ON liquidity_registry FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS liquidity_registry_write_superuser ON liquidity_registry;
CREATE POLICY liquidity_registry_write_superuser
  ON liquidity_registry FOR ALL TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());

DROP POLICY IF EXISTS liquidity_balances_read_authenticated ON liquidity_balances;
CREATE POLICY liquidity_balances_read_authenticated
  ON liquidity_balances FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS liquidity_balances_write_superuser ON liquidity_balances;
CREATE POLICY liquidity_balances_write_superuser
  ON liquidity_balances FOR ALL TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());

-- 4. Superuser-only CRUD RPCs (mirror replace_liquidity_accounts guard).
CREATE OR REPLACE FUNCTION public.upsert_liquidity_account(
  p_id bigint, p_nom text, p_banc text, p_section text, p_divisa text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
  IF NOT public.is_superuser() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO liquidity_registry (nom, banc, section, divisa)
    VALUES (p_nom, p_banc, p_section, coalesce(p_divisa, 'EUR'))
    RETURNING id INTO v_id;
  ELSE
    UPDATE liquidity_registry
      SET nom = p_nom, banc = p_banc, section = p_section,
          divisa = coalesce(p_divisa, 'EUR'), updated_at = now()
      WHERE id = p_id
      RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_liquidity_account(p_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superuser() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  DELETE FROM liquidity_registry WHERE id = p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_liquidity_balance(
  p_id bigint, p_account_id bigint, p_data date, p_saldo numeric, p_saldo_native numeric
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
  IF NOT public.is_superuser() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO liquidity_balances (account_id, data, saldo, saldo_native)
    VALUES (p_account_id, p_data, coalesce(p_saldo, 0), p_saldo_native)
    ON CONFLICT (account_id, data)
      DO UPDATE SET saldo = excluded.saldo, saldo_native = excluded.saldo_native, updated_at = now()
    RETURNING id INTO v_id;
  ELSE
    UPDATE liquidity_balances
      SET account_id = p_account_id, data = p_data, saldo = coalesce(p_saldo, 0),
          saldo_native = p_saldo_native, updated_at = now()
      WHERE id = p_id
      RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_liquidity_balance(p_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superuser() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  DELETE FROM liquidity_balances WHERE id = p_id;
END; $$;

-- 5. One-time data copy from the flat table (each row → 1 account; + 1 balance
--    only when data IS NOT NULL — data-less rows start with zero history).
--    Assumes the flat table is one-row-per-account (it was full-replace).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'liquidity_accounts') THEN
    WITH ins AS (
      INSERT INTO liquidity_registry (nom, banc, section, divisa)
      SELECT nom, banc, section, coalesce(divisa, 'EUR')
      FROM liquidity_accounts
      RETURNING id, nom, coalesce(banc, '') AS banc_k, section, divisa
    )
    INSERT INTO liquidity_balances (account_id, data, saldo, saldo_native)
    SELECT ins.id, la.data, la.saldo, la.saldo_native
    FROM liquidity_accounts la
    JOIN ins ON ins.nom = la.nom
            AND ins.banc_k = coalesce(la.banc, '')
            AND ins.section = la.section
            AND ins.divisa = coalesce(la.divisa, 'EUR')
    WHERE la.data IS NOT NULL;
  END IF;
END $$;

-- 6. Drop the old flat table + RPC (now superseded).
DROP FUNCTION IF EXISTS public.replace_liquidity_accounts(jsonb);
DROP TABLE IF EXISTS liquidity_accounts;
```

- [ ] **Step 2: Apply the migration to the remote project**

Use the Supabase MCP tool `apply_migration` with `name: "liquidity_history"` and `query` = the full SQL above. (Load the tool schema first via ToolSearch `select:mcp__plugin_supabase_supabase__apply_migration`.)
Expected: success, no error.

- [ ] **Step 3: Verify the schema and data copy**

Use Supabase MCP `execute_sql` with:
```sql
SELECT
  (SELECT count(*) FROM liquidity_registry) AS accounts,
  (SELECT count(*) FROM liquidity_balances) AS balances,
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='liquidity_accounts') AS old_table_exists;
```
Expected: `accounts` = number of former `liquidity_accounts` rows; `balances` = number of those rows that had a non-NULL `data`; `old_table_exists` = 0.

- [ ] **Step 4: Commit the migration file**

```bash
git add "supabase/migrations/20260723120000_liquidity_history.sql"
git commit -m "feat: liquidity history schema, RLS, CRUD RPCs; drop flat table"
```

---

### Task 2: Row mappers for registry and balances

**Files:**
- Modify: `src/data/mappers.js` (add two functions near the existing liquidity mappers, ~line 281-307)
- Test: `test/liquidityMappers.test.js` (create)

**Interfaces:**
- Produces: `rowToLiquidityRegistry(row) → { id, nom, banc, section, divisa }`; `rowToLiquidityBalance(row) → { id, accountId, data, saldo, saldoNative }`.

- [ ] **Step 1: Write the failing test**

Create `test/liquidityMappers.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { rowToLiquidityRegistry, rowToLiquidityBalance } from "../src/data/mappers.js";

test("rowToLiquidityRegistry maps snake_case row to camelCase account", () => {
  const row = { id: 7, nom: "Compte", banc: "Caixa", section: "alternatives", divisa: "USD" };
  assert.deepEqual(rowToLiquidityRegistry(row), {
    id: 7, nom: "Compte", banc: "Caixa", section: "alternatives", divisa: "USD",
  });
});

test("rowToLiquidityRegistry defaults banc to null and divisa to EUR", () => {
  const out = rowToLiquidityRegistry({ id: 1, nom: "X", section: "real-estate" });
  assert.equal(out.banc, null);
  assert.equal(out.divisa, "EUR");
});

test("rowToLiquidityBalance maps account_id/saldo_native to camelCase and coerces numbers", () => {
  const row = { id: 3, account_id: 7, data: "2026-06-30", saldo: "1000.5", saldo_native: "900" };
  assert.deepEqual(rowToLiquidityBalance(row), {
    id: 3, accountId: 7, data: "2026-06-30", saldo: 1000.5, saldoNative: 900,
  });
});

test("rowToLiquidityBalance leaves null saldo_native as null and defaults saldo to 0", () => {
  const out = rowToLiquidityBalance({ id: 4, account_id: 7, data: "2026-06-30", saldo: null, saldo_native: null });
  assert.equal(out.saldo, 0);
  assert.equal(out.saldoNative, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/liquidityMappers.test.js`
Expected: FAIL — `rowToLiquidityRegistry`/`rowToLiquidityBalance` not exported.

- [ ] **Step 3: Add the mappers**

In `src/data/mappers.js`, immediately after `rowToLiquidityAccount` (ends ~line 307), add:

```js
/** DB registry row (snake_case) → app account identity (camelCase). */
export function rowToLiquidityRegistry(row) {
  return {
    id: row.id,
    nom: row.nom ?? "",
    banc: row.banc ?? null,
    section: row.section,
    divisa: row.divisa ?? "EUR",
  };
}

/** DB balance row (snake_case) → app balance (camelCase). */
export function rowToLiquidityBalance(row) {
  const saldo = Number(row.saldo);
  const native = row.saldo_native != null ? Number(row.saldo_native) : null;
  return {
    id: row.id,
    accountId: row.account_id,
    data: row.data ?? null,
    saldo: Number.isFinite(saldo) ? saldo : 0,
    saldoNative: native != null && Number.isFinite(native) ? native : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/liquidityMappers.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/mappers.js test/liquidityMappers.test.js
git commit -m "feat: add liquidity registry/balance row mappers"
```

---

### Task 3: Model — `buildLatestAccounts` and `buildLiquidityTrend`

**Files:**
- Modify: `src/data/liquidityModel.js` (add two functions; keep existing ones unchanged)
- Test: `test/liquidityModel.test.js` (append)

**Interfaces:**
- Consumes: registry `[{ id, nom, banc, section, divisa }]`, balances `[{ id, accountId, data, saldo, saldoNative }]` (from Task 2 shape).
- Produces: `buildLatestAccounts(registry, balances) → [{ id, nom, banc, section, saldo, saldoNative, divisa, data }]` (existing account shape); `buildLiquidityTrend(registry, balances) → { months: string[], series: [{ section, values: number[] }] }`.

- [ ] **Step 1: Write the failing tests**

Append to `test/liquidityModel.test.js`:

```js
import { buildLatestAccounts, buildLiquidityTrend } from "../src/data/liquidityModel.js";

const REG = [
  { id: 1, nom: "ALT A", banc: "Caixa", section: "alternatives", divisa: "EUR" },
  { id: 2, nom: "RE B", banc: "UBS", section: "real-estate", divisa: "USD" },
  { id: 3, nom: "No history", banc: null, section: "mercats-publics", divisa: "EUR" },
];
const BAL = [
  { id: 10, accountId: 1, data: "2026-04-30", saldo: 100, saldoNative: null },
  { id: 11, accountId: 1, data: "2026-06-30", saldo: 150, saldoNative: null },
  { id: 12, accountId: 2, data: "2026-05-31", saldo: 200, saldoNative: 220 },
];

test("buildLatestAccounts picks the max-date balance per account", () => {
  const out = buildLatestAccounts(REG, BAL);
  const a1 = out.find((a) => a.id === 1);
  assert.equal(a1.saldo, 150);
  assert.equal(a1.data, "2026-06-30");
  assert.equal(a1.divisa, "EUR");
  const a2 = out.find((a) => a.id === 2);
  assert.equal(a2.saldo, 200);
  assert.equal(a2.saldoNative, 220);
});

test("buildLatestAccounts yields zero/no-date for accounts with no balances", () => {
  const a3 = buildLatestAccounts(REG, BAL).find((a) => a.id === 3);
  assert.equal(a3.saldo, 0);
  assert.equal(a3.saldoNative, null);
  assert.equal(a3.data, null);
});

test("buildLatestAccounts returns the existing account shape and handles empty input", () => {
  assert.deepEqual(buildLatestAccounts([], []), []);
  assert.deepEqual(buildLatestAccounts(undefined, undefined), []);
  const keys = Object.keys(buildLatestAccounts(REG, BAL)[0]).sort();
  assert.deepEqual(keys, ["banc", "data", "divisa", "id", "nom", "saldo", "saldoNative", "section"]);
});

test("buildLiquidityTrend buckets by month, sorted, with carry-forward", () => {
  const { months, series } = buildLiquidityTrend(REG, BAL);
  assert.deepEqual(months, ["2026-04", "2026-05", "2026-06"]);
  const alt = series.find((s) => s.section === "alternatives");
  // 100 in Apr, carried to May, 150 in Jun
  assert.deepEqual(alt.values, [100, 100, 150]);
  const re = series.find((s) => s.section === "real-estate");
  // nothing in Apr, 200 from May onward (carry-forward)
  assert.deepEqual(re.values, [0, 200, 200]);
  const pub = series.find((s) => s.section === "mercats-publics");
  assert.deepEqual(pub.values, [0, 0, 0]);
});

test("buildLiquidityTrend returns empty structure for no balances", () => {
  assert.deepEqual(buildLiquidityTrend(REG, []), { months: [], series: [] });
  assert.deepEqual(buildLiquidityTrend(undefined, undefined), { months: [], series: [] });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/liquidityModel.test.js`
Expected: FAIL — `buildLatestAccounts`/`buildLiquidityTrend` not exported.

- [ ] **Step 3: Implement the two functions**

Append to `src/data/liquidityModel.js` (reuses the existing `toNumber` and `LIQUIDITY_SECTIONS`):

```js
function monthKey(dateStr) {
  return String(dateStr).slice(0, 7); // YYYY-MM
}

/**
 * Latest balance per registry account, projected into the existing account
 * shape so snapshot consumers need no changes.
 * @param {Array} registry - [{ id, nom, banc, section, divisa }]
 * @param {Array} balances - [{ accountId, data, saldo, saldoNative }]
 */
export function buildLatestAccounts(registry, balances) {
  const accts = Array.isArray(registry) ? registry : [];
  const rows = Array.isArray(balances) ? balances : [];

  const latest = new Map(); // accountId → balance with max data
  for (const b of rows) {
    if (b?.accountId == null || !b?.data) continue;
    const prev = latest.get(b.accountId);
    if (!prev || b.data > prev.data) latest.set(b.accountId, b);
  }

  return accts.map((a) => {
    const b = latest.get(a.id);
    return {
      id: a.id,
      nom: a.nom ?? "",
      banc: a.banc ?? null,
      section: a.section,
      saldo: b ? toNumber(b.saldo) : 0,
      saldoNative: b && b.saldoNative != null ? toNumber(b.saldoNative) : null,
      divisa: a.divisa ?? "EUR",
      data: b ? b.data : null,
    };
  });
}

/**
 * Cash-over-time by section for a stacked-area chart. Months are the sorted
 * unique YYYY-MM buckets present in the data; each section's value at a month
 * is the sum of its accounts' latest balance as-of ≤ that month (carry-forward).
 * @returns {{ months: string[], series: Array<{ section: string, values: number[] }> }}
 */
export function buildLiquidityTrend(registry, balances) {
  const accts = Array.isArray(registry) ? registry : [];
  const rows = (Array.isArray(balances) ? balances : []).filter((b) => b?.data && b.accountId != null);
  if (rows.length === 0) return { months: [], series: [] };

  const months = [...new Set(rows.map((b) => monthKey(b.data)))].sort();

  const byAccount = new Map(); // accountId → balances sorted by date asc
  for (const b of rows) {
    if (!byAccount.has(b.accountId)) byAccount.set(b.accountId, []);
    byAccount.get(b.accountId).push(b);
  }
  for (const list of byAccount.values()) {
    list.sort((x, y) => (x.data < y.data ? -1 : x.data > y.data ? 1 : 0));
  }

  const sectionOf = new Map(accts.map((a) => [a.id, a.section]));

  const series = LIQUIDITY_SECTIONS.map((section) => ({
    section,
    values: months.map((m) => {
      let sum = 0;
      for (const [accountId, list] of byAccount) {
        if (sectionOf.get(accountId) !== section) continue;
        let val = 0;
        for (const b of list) {
          if (monthKey(b.data) <= m) val = toNumber(b.saldo);
          else break;
        }
        sum += val;
      }
      return sum;
    }),
  }));

  return { months, series };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/liquidityModel.test.js`
Expected: PASS (all existing + 5 new tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/liquidityModel.js test/liquidityModel.test.js
git commit -m "feat: buildLatestAccounts + buildLiquidityTrend liquidity model"
```

---

### Task 4: DB layer — load + CRUD wrappers

**Files:**
- Modify (rewrite): `src/db/liquidityAccounts.js`

**Interfaces:**
- Consumes: `rowToLiquidityRegistry`, `rowToLiquidityBalance` (Task 2); `supabase`, `logAudit` (from `_shared.js`).
- Produces: `loadLiquidity() → Promise<{ registry: Array, balances: Array }>`; `upsertLiquidityAccount(account) → Promise<{ id, error }>`; `deleteLiquidityAccount(id) → Promise<{ error }>`; `upsertLiquidityBalance(balance) → Promise<{ id, error }>`; `deleteLiquidityBalance(id) → Promise<{ error }>`. Account arg: `{ id?, nom, banc, section, divisa }`. Balance arg: `{ id?, accountId, data, saldo, saldoNative }`.

- [ ] **Step 1: Rewrite the module**

Replace the entire contents of `src/db/liquidityAccounts.js` with:

```js
import { rowToLiquidityRegistry, rowToLiquidityBalance } from "../data/mappers.js";
import { supabase, logAudit } from "./_shared.js";

const MISSING_RPC =
  'L\'operació segura no està disponible al servidor. Aplica les migracions de Supabase pendents i torna-ho a provar.';

function normalizeRpcError(error, rpcName) {
  if (!error) return null;
  if (error.code === "PGRST202" || error.message?.includes(rpcName)) return new Error(MISSING_RPC);
  return error;
}

/**
 * Load the liquidity registry + full balance history. Degrades to empty lists
 * when Supabase is unavailable or the tables are missing (migration not applied).
 * @returns {Promise<{ registry: Array, balances: Array }>}
 */
export async function loadLiquidity() {
  if (!supabase) return { registry: [], balances: [] };
  const [{ data: reg, error: regErr }, { data: bal, error: balErr }] = await Promise.all([
    supabase.from("liquidity_registry").select("id,nom,banc,section,divisa").order("section").order("nom"),
    supabase.from("liquidity_balances").select("id,account_id,data,saldo,saldo_native").order("account_id").order("data"),
  ]);
  if (regErr || !Array.isArray(reg)) {
    if (regErr) console.warn("loadLiquidity registry failed (table may be missing):", regErr.message);
    return { registry: [], balances: [] };
  }
  if (balErr) console.warn("loadLiquidity balances failed:", balErr.message);
  return {
    registry: reg.map(rowToLiquidityRegistry),
    balances: Array.isArray(bal) ? bal.map(rowToLiquidityBalance) : [],
  };
}

/** Insert (id null) or update a registry account. Superuser-only (RPC guard + RLS). */
export async function upsertLiquidityAccount(account) {
  if (!supabase) return { id: null, error: null };
  const { data, error } = await supabase.rpc("upsert_liquidity_account", {
    p_id: account.id ?? null,
    p_nom: String(account.nom ?? "").trim(),
    p_banc: account.banc != null && account.banc !== "" ? String(account.banc).trim() : null,
    p_section: account.section,
    p_divisa: String(account.divisa ?? "EUR").trim() || "EUR",
  });
  const err = normalizeRpcError(error, "upsert_liquidity_account");
  if (!err) await logAudit(account.id ? "update" : "insert", "liquidity_registry", data ?? account.id, { new: account });
  return { id: data ?? null, error: err };
}

/** Delete a registry account (balances cascade). Superuser-only. */
export async function deleteLiquidityAccount(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.rpc("delete_liquidity_account", { p_id: id });
  const err = normalizeRpcError(error, "delete_liquidity_account");
  if (!err) await logAudit("delete", "liquidity_registry", id, null);
  return { error: err };
}

/** Insert (id null) or update a monthly balance. Superuser-only. */
export async function upsertLiquidityBalance(balance) {
  if (!supabase) return { id: null, error: null };
  const saldo = Number(balance.saldo);
  const native = balance.saldoNative != null && balance.saldoNative !== "" ? Number(balance.saldoNative) : null;
  const { data, error } = await supabase.rpc("upsert_liquidity_balance", {
    p_id: balance.id ?? null,
    p_account_id: balance.accountId,
    p_data: balance.data,
    p_saldo: Number.isFinite(saldo) ? saldo : 0,
    p_saldo_native: native != null && Number.isFinite(native) ? native : null,
  });
  const err = normalizeRpcError(error, "upsert_liquidity_balance");
  if (!err) await logAudit(balance.id ? "update" : "insert", "liquidity_balances", data ?? balance.id, { new: balance });
  return { id: data ?? null, error: err };
}

/** Delete a balance. Superuser-only. */
export async function deleteLiquidityBalance(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.rpc("delete_liquidity_balance", { p_id: id });
  const err = normalizeRpcError(error, "delete_liquidity_balance");
  if (!err) await logAudit("delete", "liquidity_balances", id, null);
  return { error: err };
}
```

- [ ] **Step 2: Verify no remaining imports of the removed exports**

Run: `grep -rn "loadLiquidityAccounts\|saveLiquidityAccounts" src`
Expected: only matches inside files that Task 5/6 will fix (`src/db.js` re-export is a wildcard, unaffected; `useDashboardData.js` and `dashboardBundle.js` are handled next). No other consumers.

- [ ] **Step 3: Build to confirm the module parses**

Run: `npm run build`
Expected: build fails ONLY on `useDashboardData.js` / `dashboardBundle.js` still importing the old names (fixed in Task 5). If it fails elsewhere, stop and investigate.

- [ ] **Step 4: Commit**

```bash
git add src/db/liquidityAccounts.js
git commit -m "feat: liquidity db layer — loadLiquidity + CRUD RPC wrappers"
```

---

### Task 5: Rewire loaders and the data hook

**Files:**
- Modify: `src/db/dashboardBundle.js` (remove liquidity from `loadAll`)
- Modify: `src/components/hooks/useDashboardData.js` (load registry+balances, compute `liquidityAccounts`, expose `reloadLiquidity`, drop Excel save)

**Interfaces:**
- Consumes: `loadLiquidity` (Task 4), `buildLatestAccounts` (Task 3).
- Produces (hook return): `liquidityAccounts` (computed latest snapshot, existing shape), `liquidityRegistry`, `liquidityBalances`, `reloadLiquidity()`.

- [ ] **Step 1: Remove liquidity from `dashboardBundle.js` `loadAll`**

In `src/db/dashboardBundle.js`:
- Delete `rowToLiquidityAccount,` from the import block (line ~17).
- Remove the `la` element from the destructured `Promise.all` and delete its query line (line ~33: `supabase.from("liquidity_accounts")...`). The array becomes `const [cc, fm, pl, co, sr, pe] = await Promise.all([ ... , private_entities query ]);`.
- Delete the liquidity block (lines ~81-84: the `if (la.error)` warn and `result.liquidityAccounts = ...`).
- Change the empty-guard (line ~86) from
  `if (!result.rawCC && !result.fundMeta && !result.funds0 && !result.companies && !result.searchers && result.liquidityAccounts.length === 0) {`
  to
  `if (!result.rawCC && !result.fundMeta && !result.funds0 && !result.companies && !result.searchers) {`

- [ ] **Step 2: Rewire the hook — imports and state**

In `src/components/hooks/useDashboardData.js`:
- Line 2: remove `saveLiquidityAccounts` from the `../../db.js` import; add `loadLiquidity`. Result:
  `import { loadAll, insertCapitalCall, updateCapitalCall, deleteCapitalCall, loadCapitalCalls, saveCapitalCalls, savePipeline, saveCompanies, saveSearchers, saveFundMeta, saveDashboardBundle, loadLiquidity } from "../../db.js";`
- Add after line 11: `import { buildLatestAccounts } from "../../data/liquidityModel.js";`
- Replace line 117 (`const [liquidityAccounts, setLiquidityAccounts] = useState([]);`) with:
  ```js
  const [liquidityRegistry, setLiquidityRegistry] = useState([]);
  const [liquidityBalances, setLiquidityBalances] = useState([]);
  ```

- [ ] **Step 3: Add liquidity load + reload**

In `src/components/hooks/useDashboardData.js`, add a `reloadLiquidity` callback and an initial-load effect (place after the `loadAll` effect, ~line 192):

```js
  const reloadLiquidity = useCallback(async () => {
    const { registry, balances } = await loadLiquidity();
    setLiquidityRegistry(registry);
    setLiquidityBalances(balances);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadLiquidity()
      .then(({ registry, balances }) => {
        if (cancelled) return;
        setLiquidityRegistry(registry);
        setLiquidityBalances(balances);
      })
      .catch((err) => console.error("Initial liquidity load failed:", err));
    return () => { cancelled = true; };
  }, []);
```

Then remove line 184 (`if (Array.isArray(data.liquidityAccounts)) setLiquidityAccounts(data.liquidityAccounts);`) from the `loadAll` effect.

- [ ] **Step 4: Compute `liquidityAccounts` and drop the Excel save branch**

- Add near the other `useMemo`s (~line 345):
  ```js
  const liquidityAccounts = useMemo(
    () => buildLatestAccounts(liquidityRegistry, liquidityBalances),
    [liquidityRegistry, liquidityBalances],
  );
  ```
- Delete the Excel liquidity branch (lines 306-312, the comment + `if (Array.isArray(rows.liquidityAccounts)) { ... setLiquidityAccounts(...) }`).
- In the return object (line 365), replace `liquidityAccounts, setLiquidityAccounts,` with:
  `liquidityAccounts, liquidityRegistry, liquidityBalances, reloadLiquidity,`

- [ ] **Step 5: Confirm no other consumer used `setLiquidityAccounts`**

Run: `grep -rn "setLiquidityAccounts" src`
Expected: no matches. (If any exist, they were snapshot setters and must move to `reloadLiquidity` — none expected.)

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: PASS. `d.liquidityAccounts` still feeds `LiquidityOverview`, `LiquiditatSection`, Inici, and section summaries unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/db/dashboardBundle.js src/components/hooks/useDashboardData.js
git commit -m "feat: load liquidity registry+balances; derive latest snapshot in JS"
```

---

### Task 6: Drop the Excel import path for liquidity

**Files:**
- Modify: `src/components/DataLoader.jsx` (remove liquidity sheet detection ~lines 48-49)
- Modify: `src/utils/parsers.js` (remove `mapLiquidityAccountsRows` ~213-232 and `normalizeLiquiditySection` ~202-205 if unused)
- Modify/Delete: the `mapLiquidityAccountsRows` unit test (find it first)

**Interfaces:**
- Produces: no liquidity path through Excel import; other sheets untouched.

- [ ] **Step 1: Locate the parser test and other references**

Run: `grep -rn "mapLiquidityAccountsRows\|normalizeLiquiditySection" src test`
Note every file/line. Expected: definition + the `DataLoader.jsx` call + a test in `test/`.

- [ ] **Step 2: Remove the DataLoader liquidity branch**

In `src/components/DataLoader.jsx`, delete the two lines (~48-49):
```js
    const laRows = sheet("Liquiditat");
    if (hasHeaders(laRows, ["Compte", "Secció", "Saldo (€)"])) { bundle.liquidityAccounts = mapLiquidityAccountsRows(laRows); loaded++; }
```
Also remove the now-unused `mapLiquidityAccountsRows` import in that file (check top-of-file imports).

- [ ] **Step 3: Remove the dead parser functions**

In `src/utils/parsers.js`, delete `mapLiquidityAccountsRows` (~213-232). Delete `normalizeLiquiditySection` (~202-205) ONLY if Step 1 showed no other references. Remove their exports and any now-unused local helpers unique to them.

- [ ] **Step 4: Remove the parser test for liquidity import**

Delete the `mapLiquidityAccountsRows` test(s) found in Step 1 (remove the test block, or the file if it only tested this). This intentionally reduces the baseline by 1 test.

- [ ] **Step 5: Build + full test run**

Run: `npm run build && npm test`
Expected: build PASS; tests PASS (baseline − removed parser test + Task 2/3 additions).

- [ ] **Step 6: Commit**

```bash
git add src/components/DataLoader.jsx src/utils/parsers.js test
git commit -m "refactor: drop Excel import path for liquidity (managed in-app now)"
```

---

### Task 7: Trend chart (stacked area by section)

**Files:**
- Modify: `src/components/liquidity/LiquidityCharts.jsx` (add `LiquidityTrendChart`)
- Modify: `src/components/liquidity/LiquidityOverview.jsx` (render the trend, pass registry+balances)
- Modify: `src/components/Dashboard.jsx` (pass `liquidityRegistry`/`liquidityBalances` to `LiquidityOverview`)

**Interfaces:**
- Consumes: `buildLiquidityTrend` (Task 3), `d.liquidityRegistry`, `d.liquidityBalances`.
- Produces: `LiquidityTrendChart({ registry, balances, tc })`.

- [ ] **Step 1: Add the trend chart component**

In `src/components/liquidity/LiquidityCharts.jsx`, import the trend builder (extend the existing model import on line 5):
```js
import { buildLiquiditySummary, buildLiquidityByBank, buildLiquidityByCurrency, buildLiquidityTrend } from "../../data/liquidityModel.js";
```
Then add before `LiquidityCharts`:

```jsx
export function LiquidityTrendChart({ registry, balances, tc }) {
  const { months, series } = buildLiquidityTrend(registry, balances);
  const t = ecTheme(tc);

  return (
    <ChartCard tc={tc} title="Evolució de la Liquiditat">
      {months.length === 0 ? (
        <EmptyState tc={tc} />
      ) : (
        <ReactECharts
          style={{ width: "100%", height: 300 }}
          opts={{ renderer: "canvas" }}
          option={{
            grid: { top: 16, right: 20, bottom: 24, left: 12, containLabel: true },
            tooltip: {
              ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" },
              formatter: (params) => {
                if (!params?.length) return "";
                const rows = params
                  .map((p) => `${p.marker}${p.seriesName}: ${fmtM(p.value)}`)
                  .join("<br/>");
                return `<b>${params[0].axisValue}</b><br/>${rows}`;
              },
            },
            legend: {
              show: true, bottom: 0, textStyle: { color: tc.textMid, fontSize: 10 },
              data: series.map((s) => SECTION_LABELS[s.section] ?? s.section),
            },
            xAxis: {
              type: "category", data: months, boundaryGap: false,
              axisLine: { lineStyle: { color: tc.border } }, axisTick: { show: false },
              axisLabel: { color: tc.textLight, fontSize: 10 },
            },
            yAxis: {
              type: "value", axisLine: { show: false }, axisTick: { show: false },
              axisLabel: { color: tc.textLight, fontSize: 10, formatter: (v) => fmtM(v) },
              splitLine: { lineStyle: { color: tc.border } },
            },
            series: series.map((s, i) => ({
              name: SECTION_LABELS[s.section] ?? s.section,
              type: "line", stack: "total", areaStyle: { opacity: 0.75 },
              smooth: false, showSymbol: false,
              lineStyle: { width: 1.5 },
              itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] ?? NEUTRAL },
              data: s.values,
            })),
          }}
        />
      )}
    </ChartCard>
  );
}
```

- [ ] **Step 2: Render the trend on the Liquiditat page**

In `src/components/liquidity/LiquidityOverview.jsx`:
- Update the signature to accept the series data: `export function LiquidityOverview({ accounts, registry, balances, tc, dark }) {`
- Import the trend chart: `import { LiquidityCharts, LiquidityTrendChart } from "./LiquidityCharts.jsx";` (adjust the existing import which currently pulls `LiquidityCharts`).
- Add a full-width trend row above the donut/bar grid (before the `<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit ...">`):
  ```jsx
  <LiquidityTrendChart registry={registry} balances={balances} tc={tc} />
  ```

- [ ] **Step 3: Pass the series from Dashboard**

In `src/components/Dashboard.jsx`, find the `<LiquidityOverview ... />` render and add props (final prop set arrives in Task 9):
```jsx
<LiquidityOverview accounts={d.liquidityAccounts} registry={d.liquidityRegistry} balances={d.liquidityBalances} tc={tc} dark={dark} />
```
(Run `grep -n "LiquidityOverview" src/components/Dashboard.jsx` to locate it.)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/liquidity/LiquidityCharts.jsx src/components/liquidity/LiquidityOverview.jsx src/components/Dashboard.jsx
git commit -m "feat: cash-over-time stacked-area trend chart on Liquiditat"
```

---

### Task 8: Superuser CRUD editor

**Files:**
- Create: `src/components/liquidity/LiquidityEditor.jsx`

**Reference pattern (read before writing):** `src/components/CcTransactionModal.jsx` (how to build a `fields` array + `AddRowModal` usage), `src/components/shared/AddRowModal.jsx` (props: `fields`, `onSave(values, setError)`, `onClose`, `title`, `submitLabel`; field types `text`/`number`/`date`/`select`, and how it pre-fills for edit mode), `src/components/shared/DeleteRowButton.jsx` (`onDelete` two-step confirm), `src/components/shared/LiquiditatSection.jsx` (table styling with `tc`).

**Interfaces:**
- Consumes: `registry`, `balances`, `reloadLiquidity` (props); the Task 4 db functions (`upsertLiquidityAccount`, `deleteLiquidityAccount`, `upsertLiquidityBalance`, `deleteLiquidityBalance` from `../../db.js`); `buildLatestAccounts` for the latest-balance column.
- Produces: `LiquidityEditor({ registry, balances, reloadLiquidity, tc })`.

- [ ] **Step 1: Create the editor component**

Create `src/components/liquidity/LiquidityEditor.jsx`. Structure below; fill the two commented table blocks with real markup mirroring `LiquiditatSection.jsx` (rows, `tc` styling, `fmtM` for amounts). Confirm `AddRowModal`'s exact edit-mode pre-fill prop against `CcTransactionModal.jsx` and match it (shown here as `initialValues`).

```jsx
import { useState } from "react";
import { AddRowModal } from "../shared/AddRowModal.jsx";
import { DeleteRowButton } from "../shared/DeleteRowButton.jsx";
import { fmtM } from "../../utils.js";
import { buildLatestAccounts } from "../../data/liquidityModel.js";
import {
  upsertLiquidityAccount, deleteLiquidityAccount,
  upsertLiquidityBalance, deleteLiquidityBalance,
} from "../../db.js";

const SECTION_OPTIONS = [
  { value: "alternatives", label: "Alternatius" },
  { value: "real-estate", label: "Real Estate" },
  { value: "mercats-publics", label: "Mercats Públics" },
];
const DIVISA_OPTIONS = ["EUR", "USD", "GBP", "CHF"].map((d) => ({ value: d, label: d }));

const accountFields = [
  { key: "nom", label: "Compte", type: "text", required: true },
  { key: "banc", label: "Banc", type: "text" },
  { key: "section", label: "Secció", type: "select", options: SECTION_OPTIONS, defaultValue: "alternatives" },
  { key: "divisa", label: "Divisa", type: "select", options: DIVISA_OPTIONS, defaultValue: "EUR" },
];

export function LiquidityEditor({ registry, balances, reloadLiquidity, tc }) {
  const [accountModal, setAccountModal] = useState(null); // null | { id? } (edit carries id)
  const [balanceModal, setBalanceModal] = useState(null); // null | { accountId } | { id, accountId, data, saldo, saldoNative }
  const [selectedId, setSelectedId] = useState(null);

  const latestById = new Map(buildLatestAccounts(registry, balances).map((a) => [a.id, a]));
  const selected = registry.find((a) => a.id === selectedId) ?? null;
  const selectedBalances = balances
    .filter((b) => b.accountId === selectedId)
    .sort((a, b) => (a.data < b.data ? 1 : -1)); // newest first

  const saveAccount = async (values, setError) => {
    const { error } = await upsertLiquidityAccount({ id: accountModal?.id, ...values });
    if (error) { setError(error.message); return; }
    setAccountModal(null);
    await reloadLiquidity();
  };
  const removeAccount = async (id) => {
    const { error } = await deleteLiquidityAccount(id);
    if (!error) { if (selectedId === id) setSelectedId(null); await reloadLiquidity(); }
  };
  const saveBalance = async (values, setError) => {
    const { error } = await upsertLiquidityBalance({
      id: balanceModal?.id,
      accountId: balanceModal?.accountId,
      data: values.data,
      saldo: values.saldo,
      saldoNative: values.saldoNative,
    });
    if (error) { setError(error.message); return; }
    setBalanceModal(null);
    await reloadLiquidity();
  };
  const removeBalance = async (id) => {
    const { error } = await deleteLiquidityBalance(id);
    if (!error) await reloadLiquidity();
  };

  const balanceFields = (divisa) => [
    { key: "data", label: "Data", type: "date", required: true },
    { key: "saldo", label: "Saldo (€)", type: "number", required: true },
    ...(divisa && divisa !== "EUR"
      ? [{ key: "saldoNative", label: `Saldo (${divisa})`, type: "number" }]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ACCOUNTS TABLE — header "Comptes" + "Afegir compte" button (setAccountModal({})).
          Columns: nom, banc, section label, divisa, latest saldo via
          latestById.get(a.id)?.saldo (fmtM). Row actions: "Editar"
          (setAccountModal({ id: a.id })), DeleteRowButton(onDelete → removeAccount(a.id)),
          "Saldos" (setSelectedId(a.id)). Style like LiquiditatSection.jsx with tc. */}

      {/* BALANCE HISTORY — only when `selected`. Header "Saldos · {selected.nom}" +
          "Afegir saldo" (setBalanceModal({ accountId: selected.id })). List
          selectedBalances: data, saldo (fmtM), saldoNative when present. Row actions:
          "Editar" (setBalanceModal({ id: b.id, accountId: b.accountId, data: b.data,
          saldo: b.saldo, saldoNative: b.saldoNative })), DeleteRowButton(onDelete →
          removeBalance(b.id)). */}

      {accountModal && (
        <AddRowModal
          title={accountModal.id ? "Editar compte" : "Afegir compte"}
          submitLabel="Desar"
          fields={accountFields}
          initialValues={accountModal.id
            ? { nom: selected?.nom, banc: selected?.banc, section: selected?.section, divisa: selected?.divisa }
            : undefined}
          onSave={saveAccount}
          onClose={() => setAccountModal(null)}
        />
      )}
      {balanceModal && (
        <AddRowModal
          title={balanceModal.id ? "Editar saldo" : "Afegir saldo"}
          submitLabel="Desar"
          fields={balanceFields(selected?.divisa)}
          initialValues={balanceModal.id
            ? { data: balanceModal.data, saldo: balanceModal.saldo, saldoNative: balanceModal.saldoNative }
            : undefined}
          onSave={saveBalance}
          onClose={() => setBalanceModal(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/liquidity/LiquidityEditor.jsx
git commit -m "feat: superuser liquidity CRUD editor (accounts + monthly balances)"
```

---

### Task 9: Wire the two entry points

**Files:**
- Modify: `src/components/liquidity/LiquidityOverview.jsx` (superuser "Gestiona" toggle)
- Modify: `src/components/Dashboard.jsx` (pass `reloadLiquidity` + `canManage` to `LiquidityOverview`)
- Modify: `src/components/AdminPanel.jsx` (new "Liquiditat" tab rendering `LiquidityEditor`)

**Interfaces:**
- Consumes: `LiquidityEditor` (Task 8), `useAuth().canEditSection` (`ACCESS_SUPERUSER`), `d.reloadLiquidity`, `d.liquidityRegistry`, `d.liquidityBalances`.

- [ ] **Step 1: Page entry point — "Gestiona" toggle on Liquiditat**

In `src/components/liquidity/LiquidityOverview.jsx`:
- Extend the signature: `export function LiquidityOverview({ accounts, registry, balances, reloadLiquidity, canManage, tc, dark }) {`
- Add imports: `import { useState } from "react";` and `import { LiquidityEditor } from "./LiquidityEditor.jsx";`
- Add `const [managing, setManaging] = useState(false);`
- In the KPI row, when `canManage`, render a button (styled with `tc`) toggling `managing` (label `Gestiona` when closed, `Tanca` when open).
- When `managing`, render `<LiquidityEditor registry={registry} balances={balances} reloadLiquidity={reloadLiquidity} tc={tc} />` above the charts grid; otherwise render the charts/table as today.

- [ ] **Step 2: Feed the page entry point from Dashboard**

In `src/components/Dashboard.jsx`, update the `<LiquidityOverview .../>` render to the final prop set:
```jsx
<LiquidityOverview
  accounts={d.liquidityAccounts}
  registry={d.liquidityRegistry}
  balances={d.liquidityBalances}
  reloadLiquidity={d.reloadLiquidity}
  canManage={canEditSection("liquidity")}
  tc={tc}
  dark={dark}
/>
```
`canEditSection` comes from `useAuth()`. Confirm it's already destructured in `Dashboard.jsx` (it is used for other gates); if not, add it to the `useAuth()` destructure.

- [ ] **Step 3: Admin entry point — new "Liquiditat" tab**

In `src/components/AdminPanel.jsx`:
- Add to `NAV_BASE` (after `{ id: "pm", label: "PM Operacions" }`): `{ id: "liquidity", label: "Liquiditat" }`.
- Import `LiquidityEditor`.
- Determine how `AdminPanel` accesses dashboard data: run `grep -n "useDashboardData\|liquidity\|props" src/components/AdminPanel.jsx`. If AdminPanel calls `useDashboardData()` itself, read `liquidityRegistry`, `liquidityBalances`, `reloadLiquidity` from it; if it receives a `d`/data prop from `Dashboard.jsx`, thread those three through that prop instead (follow the existing pattern for how `AdminData`/`AdminEntities` get their data).
- In the content dispatch (near `{activeTab === "data" && <AdminData />}`), add:
  ```jsx
  {activeTab === "liquidity" && (
    <LiquidityEditor registry={liquidityRegistry} balances={liquidityBalances} reloadLiquidity={reloadLiquidity} tc={tc} />
  )}
  ```
  binding the three values from whichever source Step 3 established.

- [ ] **Step 4: Build + full test run**

Run: `npm run build && npm test`
Expected: build PASS; all tests PASS.

- [ ] **Step 5: Manual verification (superuser + non-superuser)**

Start the app (`npm run dev` or the project's run skill). As a superuser: the Liquiditat page shows "Gestiona"; add an account, add two monthly balances → charts/trend/table update after save; Admin → Liquiditat shows the same editor. As a non-superuser: no "Gestiona" button, no Admin tab access; server rejects writes (RPC `Forbidden`) even if forced.

- [ ] **Step 6: Commit**

```bash
git add src/components/liquidity/LiquidityOverview.jsx src/components/Dashboard.jsx src/components/AdminPanel.jsx
git commit -m "feat: liquidity editor entry points (page button + admin tab)"
```

---

## Deploy (after all tasks pass the gate)

- [ ] Confirm gate green: `npm run build && npm test`.
- [ ] `git push origin master` (→ Vercel). Verify the deployed Liquiditat page renders the trend and the editor works end-to-end.

---

## Self-Review

**Spec coverage:**
- §4 schema → Task 1. §4.3 RLS → Task 1 Step 1. §5 RPCs → Task 1. §6.1 db layer → Task 4. §6.2 model → Task 3. §6.3 mappers → Task 2. §6.4 hook → Task 5. §7 Excel drop → Task 6. §8.1 trend → Task 7. §8.2 editor → Task 8. §8.3 both entry points → Task 9. §9 migration+copy+drop → Task 1. §10 testing → Tasks 2/3 (unit) + build/manual in 7/8/9. All spec sections mapped.

**Placeholder scan:** No "TBD"/"handle edge cases". Two intentional narrative blocks (Task 8 table markup, Task 9 how AdminPanel receives data) point to named reference files and exact patterns; the novel wiring (mutations, reload, gating) is shown as real code.

**Type consistency:** Account shape `{ id, nom, banc, section, saldo, saldoNative, divisa, data }` consistent across Task 3 output, Task 4 args, Task 8 usage. Balance shape `{ id, accountId, data, saldo, saldoNative }` consistent (Task 2 mapper → Task 3 model → Task 4 wrapper → Task 8 editor). RPC param names (`p_id, p_account_id, p_data, p_saldo, p_saldo_native`) match between Task 1 SQL and Task 4 calls. Function names (`buildLatestAccounts`, `buildLiquidityTrend`, `loadLiquidity`, `reloadLiquidity`, `upsert/deleteLiquidityAccount/Balance`) consistent throughout.
