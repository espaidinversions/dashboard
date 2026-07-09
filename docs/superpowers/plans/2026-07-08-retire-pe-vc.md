# Retire PE/VC (`vehicle_tipus`) — `vehicle_est` becomes the only classification

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax.
> The earlier `vcpe → vehicleTipus` migration (`docs/superpowers/plans/2026-05-22-vcpe-to-vehicle-tipus.md`)
> is **already done**: `capital_calls.vcpe` was dropped and `fund_meta.vehicle_tipus` (PE/VC/SF/PC/RE)
> is currently the runtime source for `row.vehicleTipus`. This plan removes that concept entirely.

**Goal:** Stop using the PE/VC vehicle-type category. Persist anything still derived from it into the
DB, replace every runtime read of `vehicleTipus` with the `est` / `estSection` classification, then drop
`fund_meta.vehicle_tipus`.

**Why it's safe now:** `private_entities.vehicle_est` ("Tipus de Vehicle") is populated for **all 179
entities**. Verified against the DB (2026-07-08):
- `capital_calls`: 1495 rows, **0 orphans** (every row's `vehicle_id` has a `private_entity`).
- **0 entities** missing `vehicle_est`.
- `est` resolution in `mappers.js` uses `estOverride = entity.vehicle_est` first, so the `vehicleTipus`
  fallback (`normalizeCapitalCallStrategy(..., vehicleTipus)` / `defaultCapitalCallStrategyForVehicleTipus`)
  **never fires** — `vehicle_est` always wins. PE/VC is dead weight.

**Classification mapping** (already in `src/data/capitalCallStrategyModel.js`):
- `estSection(est)` → `"ALT"` (Fons Primari/Secundari/de Fons/de Coinversió) = vehicle/fons,
  `"RE"` = real estate, `"SF"` (Search Fund - Cerca/Participada) = company, `"PC"` (Participada Altres) = company.
- Helpers already added: `isCompanyEst(est)`, `isReEst(est)`.

**Decisions locked with the user:**
1. The Transactions "VCPE" breakdown chart + filter (PE/VC/RE/SF/PC) → **replace with an `est` (Tipus de
   Vehicle) breakdown**: Fons Primari / Fons Secundari / Fons de Fons / Fons de Coinversió / Fons Real
   Estate / Search Fund - Cerca / Search Fund - Participada / Participada (Altres).
2. Fund-detail route IDs currently encode `PE:<id>` etc. → **emit id-only URLs going forward, but keep
   parsing the legacy `TIPUS:<id>` form** so existing bookmarks still resolve.

**Tech stack:** Supabase (Postgres), React, JS ESM. Project id: `lekmvgtnwvhcvabbhuby`.

**Guardrails:** Existing migrations are immutable — add new ones. Run `npm test` after each code task and
`npm run build` before the column drop. The static offline seed `src/data/capital-calls.js` may still carry
legacy fields; the mappers should tolerate their absence (optional-chaining), so leave that file alone.

---

## Phase 1 — Persist derived `est` to the DB (the "append")

**Files:** Create `supabase/migrations/20260708000000_backfill_capital_calls_est.sql`

- [ ] **Step 1: Pre-check (SQL, expect 157 empty / 0 orphans)**

```sql
SELECT
  COUNT(*) FILTER (WHERE NULLIF(TRIM(est),'') IS NULL) AS est_empty,
  COUNT(*) FILTER (WHERE vehicle_id NOT IN (SELECT id FROM private_entities)) AS orphans
FROM public.capital_calls;
```

- [ ] **Step 2: Migration — fill only EMPTY est from vehicle_est (non-destructive; preserves per-row est)**

```sql
-- 20260708000000_backfill_capital_calls_est.sql
-- Materialize the resolved "Tipus de Vehicle" into capital_calls.est for rows that
-- have none, sourcing from private_entities.vehicle_est. After this the est column is
-- self-contained and no longer depends on fund_meta.vehicle_tipus for resolution.
UPDATE public.capital_calls cc
SET est = pe.vehicle_est
FROM public.private_entities pe
WHERE pe.id = cc.vehicle_id
  AND NULLIF(TRIM(cc.est), '') IS NULL
  AND NULLIF(TRIM(pe.vehicle_est), '') IS NOT NULL;
```

Apply via `mcp__plugin_supabase_supabase__apply_migration` (project `lekmvgtnwvhcvabbhuby`).

- [ ] **Step 3: Verify** — re-run Step 1 SQL; expect `est_empty = 0`.
- [ ] **Step 4: Commit** — `db: backfill capital_calls.est from vehicle_est`

> NOTE: This intentionally does NOT overwrite the 1338 rows that already have an est, so funds with mixed
> per-row strategies (e.g. JP Morgan Fons de Fons + Coinversió rows) keep their distinctions. Classification
> (vehicle vs company vs RE) still comes from `vehicle_est` via the mapper's `estOverride`.

---

## Phase 2 — Replace every `vehicleTipus` read with `est` / `estSection`

Run `grep -rn "vehicleTipus\|vehicle_tipus" src/ api/ server.js` first and treat the list below as the
expected set; reconcile any extras before proceeding.

### Task 2a: DB read/write layer

**Files:** `src/db.js` (or `src/db/*.js` — confirm actual location), `src/data/mappers.js`

- [ ] Remove the `, fund_meta(vehicle_tipus)` nested select from every `capital_calls` query
      (search `fund_meta(vehicle_tipus)`).
- [ ] `src/data/mappers.js` `rowToCapitalCall` (~line 135-148): delete
      `const vehicleTipus = row.fund_meta?.vehicle_tipus ?? null;` and the `vehicleTipus,` field in the
      returned object. Simplify est to:
      `est: entity?.vehicle_est ?? (normalizeCapitalCallStrategy(row.est, null, { fons: row.fons }) ?? "Fons Primari"),`
      (drop the `defaultCapitalCallStrategyForVehicleTipus` arm; with vehicle_est everywhere it's unreachable).
- [ ] Any second mapper occurrence (~line 106-110) that reads `row.fund_meta?.vehicle_tipus` → same treatment.
- [ ] Writes (`insertFund`, `insertCapitalCall`, `updateCapitalCall`): drop the `vehicle_tipus` upsert to
      `fund_meta` and the `vehicleTipus` param used only for est inference; est now comes from `vehicle_est`
      (set on the `private_entities` row) — confirm the write path sets/uses `vehicle_est` and normalize with
      `normalizeCapitalCallStrategy(est, null, {fons})`.

### Task 2b: capitalCallStrategyModel.js

**File:** `src/data/capitalCallStrategyModel.js`

- [ ] `normalizeCapitalCallStrategy(value, vehicleTipus, context)`: keep the signature for compatibility but
      the callers now pass `null`. Leave the SF/PC/RE branches (harmless when arg is null). Do NOT delete
      `estSection` / `isCompanyEst` / `isReEst`.
- [ ] Deprecate `defaultCapitalCallStrategyForVehicleTipus` once no caller remains (grep to confirm), then
      remove it and its export + the import in `src/db/_shared.js`.

### Task 2c: Domain models — swap `vehicleTipus === "X"` for `est`

Import `estSection`/`isReEst`/`isCompanyEst` where needed.

- [ ] `src/data/realEstateModel.js`: `row.vehicleTipus === "RE"` → `isReEst(row.est)` (tx & compr filters).
- [ ] `src/data/searcherModel.js`: `row?.vehicleTipus !== "SF"` → `estSection(row?.est) !== "SF"`.
- [ ] `src/data/privateCompanyModel.js`: `["PC","SF"].includes(row?.vehicleTipus)` → `isCompanyEst(row?.est)`;
      `tipus: row.vehicleTipus` → `tipus: estSection(row.est)` (or drop if unused downstream — verify).
- [ ] `src/data/privateRoutes.js`: `row?.vehicleTipus === "PC"` → `estSection(row?.est) === "PC"`.
- [ ] `src/data/alternativesModel.js`: `buildPrivateSyntheticRows` synthesizes rows with hardcoded
      `vehicleTipus: "SF"|"PC"`. Replace those with the matching `est` values
      (`"Search Fund - Cerca"`/`"Participada (Altres)"`, or carry the real est from the match) so synthetic
      rows classify via `est`. Update the JSDoc param name.
- [ ] `src/data/prospectiveCashModel.js`: `String(row?.vehicleTipus) === "RE"` (2 spots) → `isReEst(row?.est)`.
- [ ] `src/data/dashboardTypes.js`: drop the `vehicleTipus` JSDoc property (or mark removed).

### Task 2d: Route IDs (keep legacy parsing)

**File:** `src/data/fundDetailModel.js`

- [ ] `makeFundRouteId(row)`: stop prefixing with type — return `row?.id ?? slugify(row?.fons ?? "")`.
- [ ] `findFundRowsByRouteId`: accept BOTH forms — if the routeId matches `^[A-Za-z]+:(.+)$`, use capture
      group 1 as the id (legacy); otherwise use it verbatim. Match rows by `row?.id === entityId` only
      (drop the `&& row.vehicleTipus === tipus` clause).
- [ ] `nonCompanyHits` filter `row?.vehicleTipus !== "PC"` → `estSection(row?.est) !== "PC"`.
- [ ] `buildFundDetailSnapshot`: `vehicleTipus = txs[0].vehicleTipus` → derive from est,
      e.g. `estSection(txs[0].est)` or expose the est label directly; update the returned field.
- [ ] `normalizeFundDetailRow` est line: pass `null` for the tipus arg.

### Task 2e: FundDetail.jsx

**File:** `src/components/FundDetail.jsx`

- [ ] Replace `vehicleTipus` destructure with the est-derived section (from the snapshot).
- [ ] Permission check: `vehicleTipus === "RE"` → `isReEst(detail.est)` (or section === "RE").
- [ ] Badge: show the `est` label (Tipus de Vehicle) instead of `VCPE_CFG[vehicleTipus]`; remove `VCPE_CFG`
      if now unused.
- [ ] SF "Fase" column conditionals: `vehicleTipus === "SF"` → `estSection(est) === "SF"`.

### Task 2f: Charts / filters / sorting — VCPE breakdown → est breakdown

**Files:** `src/components/hooks/useTransactionDerivedData.js` and its consumers
(`TxSection.jsx`, `MensualTab.jsx`, `ResumTab.jsx`, `FundsIndex.jsx`, `PipelineFY26.jsx` — grep to confirm).

- [ ] `byVcpe` (groups Capital Call by `r.vehicleTipus`) → group by `r.est` (label = est). Rename to
      `byEst` (or keep the export name to minimize churn but change the grouping key + labels).
- [ ] `fVcpe` filter (Set of vehicleTipus) → filter by `est`. Update the filter UI control's option list to
      the 8 est labels instead of PE/VC/RE/SF/PC.
- [ ] `fonsFiltered` sort `sortFons === "vcpe"` → sort by `est` (or remove the column if redundant with the
      existing est sort/column).
- [ ] Any `ccChartF.type === "vcpe"` click-through filter → `"est"`.
- [ ] Remove now-dead `vehicleTipus` fields threaded through `FONS_MAP2` row shapes if unused.

### Task 2g: Modal + dashboard hook

**Files:** `src/components/CcTransactionModal.jsx`, `src/components/hooks/useDashboardData.js`,
`src/components/contexts/CapitalCallModalContext.jsx`

- [ ] Remove any hidden `vcpe`/`vehicleTipus` field from the modal field list.
- [ ] `useDashboardData` `sanitizeCapitalCallValues`: ensure no `vehicleTipus` in payload;
      `syncSearchersFromCapitalCalls` filter `row?.vehicleTipus === "SF"` → `estSection(row?.est) === "SF"`.

- [ ] **After 2a–2g: `npm test` then `npm run build` — both green.**
- [ ] **Grep gate:** `grep -rn "vehicleTipus\|vehicle_tipus\|VCPE\|vcpe" src/ api/ server.js`
      returns only intentional leftovers (e.g. legacy route-parse regex, comments). Commit.

---

## Phase 3 — Drop `fund_meta.vehicle_tipus`

Only after Phase 2 is deployed and verified in the running app.

**Files:** Create `supabase/migrations/20260708000001_drop_fund_meta_vehicle_tipus.sql`

- [ ] **Step 1: Migration**

```sql
-- 20260708000001_drop_fund_meta_vehicle_tipus.sql
-- vehicle_est (Tipus de Vehicle) is the sole classification source. PE/VC retired.
ALTER TABLE public.fund_meta DROP CONSTRAINT IF EXISTS fund_meta_vehicle_tipus_check;
ALTER TABLE public.fund_meta DROP COLUMN IF EXISTS vehicle_tipus;
```

- [ ] **Step 2: Apply** via `mcp__plugin_supabase_supabase__apply_migration`.
- [ ] **Step 3: Verify** — `SELECT column_name FROM information_schema.columns WHERE table_name='fund_meta';`
      (no `vehicle_tipus`). App still loads; Transactions + Model Caixa scope + est breakdown chart work.
- [ ] **Step 4:** Update `supabase/schema.sql` (the checked-in snapshot) to drop the column/constraint.
- [ ] **Step 5: Commit** — `db: drop fund_meta.vehicle_tipus — vehicle_est is source of truth`.

---

## Deploy & verify

- [ ] `npm run deploy` (per project workflow: git push + `vercel --prod`).
- [ ] Manually verify: fund detail pages open (new + legacy `PE:` URLs), Transactions est breakdown chart,
      Model Caixa Tots/Vehicles/Companyies scope, Real Estate section, Searchers.

## Watch-outs

- Some `vehicleTipus` usages are inside `test/*` and `scripts/*`; update tests that assert on it, leave
  one-off scripts unless they run against prod.
- `src/data/capital-calls.js` offline seed carries legacy per-row fields — mappers must tolerate their
  absence (they already optional-chain). Do not edit that generated file.
- Route-ID backward compatibility is REQUIRED (decision above) — do not drop legacy `TIPUS:<id>` parsing.
