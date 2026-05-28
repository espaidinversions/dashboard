# vcpe → vehicle_tipus Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `vcpe` from `capital_calls` entirely and make `fund_meta.vehicle_tipus` the single source of truth for vehicle type classification.

**Architecture:** `fund_meta.vehicle_tipus` already stores the vehicle type per vehicle. Currently `capital_calls` also stores a `vcpe` column per row (denormalized, redundant). The migration: seed missing `fund_meta` rows, change all DB reads to join `fund_meta` for vehicle type, rename `vcpe → vehicleTipus` throughout the app layer, update import scripts to use `fund_meta` for scope, then drop the column.

**Tech Stack:** Supabase (Postgres), React, JavaScript ESM, Supabase JS client v2

---

## Context

- `capital_calls` has 1 738 rows, each with a `vcpe` column (`PE | VC | RE | PC | SF`).
- `fund_meta` has 147 rows with `vehicle_tipus`; ~86 vehicles in `capital_calls` have no `fund_meta` row.
- All app model files filter and branch on `row.vcpe`. Import scripts delete `WHERE vcpe = 'X'`.
- Route IDs are currently encoded as `PE:A123456` — the prefix is the vcpe value.
- `normalizeCapitalCallStrategy(value, vcpe, context)` uses vcpe for strategy inference.

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_seed_fund_meta_orphans.sql` | New: insert fund_meta for 86 vehicles |
| `supabase/migrations/YYYYMMDD_drop_capital_calls_vcpe.sql` | New: drop vcpe column (runs last) |
| `src/db.js` | JOIN fund_meta in all capital_calls SELECTs; remove vcpe from INSERTs/UPDATEs |
| `src/data/mappers.js` | Flatten vehicleTipus from join; remove vcpe |
| `src/data/fundDetailModel.js` | vcpe → vehicleTipus in makeFundRouteId, findFundRowsByRouteId, normalizeFundDetailRow |
| `src/data/capitalCallStrategyModel.js` | Rename param vcpe → vehicleTipus |
| `src/data/alternativesModel.js` | vcpe → vehicleTipus |
| `src/data/privateCompanyModel.js` | vcpe → vehicleTipus |
| `src/data/privateRoutes.js` | vcpe → vehicleTipus |
| `src/data/searchFundSnapshotModel.js` | vcpe → vehicleTipus |
| `src/data/prospectiveCashModel.js` | vcpe → vehicleTipus |
| `src/data/realEstateModel.js` | vcpe → vehicleTipus |
| `src/data/searcherModel.js` | vcpe → vehicleTipus |
| `src/data/dashboardTypes.js` | vcpe → vehicleTipus in JSDoc |
| `src/components/hooks/useDashboardData.js` | Remove vcpe from sanitizeCapitalCallValues; update syncSearchers filter |
| `src/components/FundDetail.jsx` | vcpe → vehicleTipus; remove vcpe destructure |
| `src/components/CcTransactionModal.jsx` | Remove hidden vcpe field |
| `scripts/cc_import.mjs` | Delete by fund_meta scope; upsert vehicle_tipus not vcpe |
| `scripts/sf_import.mjs` | Delete by fund_meta scope (vehicle_tipus=SF) |
| `scripts/startups_import.mjs` | Delete by fund_meta scope (vehicle_tipus=PC) |
| `scripts/cc_import_append.mjs` | Remove vcpe from row shape; upsert fund_meta.vehicle_tipus |

---

## Task 1: Seed fund_meta for orphan vehicles

**Files:**
- Create: `supabase/migrations/20260522_seed_fund_meta_orphans.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 20260522_seed_fund_meta_orphans.sql
-- Inserts a fund_meta row (with vehicle_tipus from capital_calls.vcpe) for every
-- vehicle that exists in capital_calls but has no fund_meta entry.
-- Uses MIN(vcpe) per vehicle so each vehicle gets exactly one canonical type.
-- Montefiore (FRA8294864204) is explicitly set to PE (has both PE and VC rows).

INSERT INTO fund_meta (vehicle_id, fons, vehicle_tipus)
SELECT
  cc.vehicle_id,
  MIN(cc.fons) AS fons,
  CASE cc.vehicle_id
    WHEN 'FRA8294864204' THEN 'PE'
    ELSE MIN(cc.vcpe)
  END AS vehicle_tipus
FROM capital_calls cc
LEFT JOIN fund_meta fm ON fm.vehicle_id = cc.vehicle_id
WHERE fm.vehicle_id IS NULL
  AND cc.vcpe IS NOT NULL
GROUP BY cc.vehicle_id
ON CONFLICT (vehicle_id) DO NOTHING;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run via `mcp__plugin_supabase_supabase__apply_migration` with the SQL above, project_id `lekmvgtnwvhcvabbhuby`.

- [ ] **Step 3: Verify — all capital_calls vehicles now have a fund_meta row**

```sql
SELECT COUNT(*) AS orphans
FROM capital_calls cc
LEFT JOIN fund_meta fm ON fm.vehicle_id = cc.vehicle_id
WHERE fm.vehicle_id IS NULL AND cc.vcpe IS NOT NULL;
-- Expected: 0
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260522_seed_fund_meta_orphans.sql
git commit -m "db: seed fund_meta vehicle_tipus for all orphan capital_calls vehicles"
```

---

## Task 2: Update DB read layer — join fund_meta in capital_calls queries

The Supabase JS client supports nested selects: `.select("*, fund_meta(vehicle_tipus)")`. This returns `row.fund_meta.vehicle_tipus`. The mapper then flattens it onto `row.vehicleTipus`.

**Files:**
- Modify: `src/db.js`
- Modify: `src/data/mappers.js`

- [ ] **Step 1: Change capital_calls SELECT queries in db.js to join fund_meta**

There are multiple `.from("capital_calls").select("*")` calls. Change each to:

```js
.from("capital_calls").select("*, fund_meta(vehicle_tipus)")
```

The affected lines are:
- `src/db.js:52` — single vehicle query
- `src/db.js:93` — paginated load
- `src/db.js:105` — paginated range
- `src/db.js:1083` — `updateCapitalCall` old-row fetch

For the `.insert(...).select().single()` on line 1072, change to:
```js
.insert(row).select("*, fund_meta(vehicle_tipus)").single()
```

- [ ] **Step 2: Update rawCCToRow mapper in src/data/mappers.js**

Find the mapper that processes capital_calls rows (around line 108). Add flattening of the nested fund_meta object and map to `vehicleTipus`:

Current (line ~108):
```js
vcpe: row.vcpe,
est: normalizeCapitalCallStrategy(row.est, row.vcpe, row),
```

Replace with:
```js
vehicleTipus: row.fund_meta?.vehicle_tipus ?? row.vcpe ?? null,
est: normalizeCapitalCallStrategy(row.est, row.fund_meta?.vehicle_tipus ?? row.vcpe ?? null, row),
```

Do the same for the second occurrence around line 143:
```js
vehicleTipus: row.fund_meta?.vehicle_tipus ?? row.vcpe ?? null,
est: normalizeCapitalCallStrategy(row.est, row.fund_meta?.vehicle_tipus ?? row.vcpe ?? null, { fons: row.fons }),
```

- [ ] **Step 3: Run existing tests to check nothing is broken**

```bash
npm test
```

Expected: all tests pass (model tests don't query DB, so unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/db.js src/data/mappers.js
git commit -m "feat: join fund_meta.vehicle_tipus when loading capital_calls"
```

---

## Task 3: Rename vcpe → vehicleTipus in capitalCallStrategyModel.js

**Files:**
- Modify: `src/data/capitalCallStrategyModel.js`
- Modify: `test/capitalCallStrategyModel.test.js`

- [ ] **Step 1: Rename parameter in normalizeCapitalCallStrategy**

Current (`src/data/capitalCallStrategyModel.js:59`):
```js
export function normalizeCapitalCallStrategy(value, vcpe = null, context = null) {
  ...
  const snapshotStrategy = _snapshotInferrer?.({
    fons: typeof context === "string" ? context : context?.fons,
    vcpe,
  }) ?? null;
  ...
  if (vcpe === "RE") return "Fons Real Estate";
  if (vcpe === "PC") return STRATEGY_PARTICIPADA_ALTRES;
  if (vcpe === "SF") { ... }
  if ((vcpe === "PE" || vcpe === "VC") && key.startsWith("search fund")) { ... }
```

Replace entire function signature and body references:
```js
export function normalizeCapitalCallStrategy(value, vehicleTipus = null, context = null) {
  const raw = String(value ?? "").trim();
  const key = slugifyStrategy(raw);

  if (key && STRATEGY_MAP.has(key)) return STRATEGY_MAP.get(key);

  const snapshotStrategy = _snapshotInferrer?.({
    fons: typeof context === "string" ? context : context?.fons,
    vcpe: vehicleTipus,
  }) ?? null;
  if (snapshotStrategy) return snapshotStrategy;

  if (vehicleTipus === "RE") return "Fons Real Estate";
  if (vehicleTipus === "PC") return STRATEGY_PARTICIPADA_ALTRES;
  if (vehicleTipus === "SF") {
    if (key.includes("adquis") || key.includes("particip")) return SF_STRATEGY_ADQUISICIO;
    if (key.includes("cerca") || !key) return SF_STRATEGY_CERCA;
  }
  if ((vehicleTipus === "PE" || vehicleTipus === "VC") && key.startsWith("search fund")) {
    return raw ? STRATEGY_MAP.get(key) ?? raw : null;
  }

  return raw || null;
}
```

- [ ] **Step 2: Rename defaultCapitalCallStrategyForVcpe**

```js
export function defaultCapitalCallStrategyForVehicleTipus(vehicleTipus) {
  if (vehicleTipus === "RE") return "Fons Real Estate";
  if (vehicleTipus === "SF") return SF_STRATEGY_CERCA;
  if (vehicleTipus === "PC") return STRATEGY_PARTICIPADA_ALTRES;
  return "Fons Primari";
}
```

- [ ] **Step 3: Update test/capitalCallStrategyModel.test.js**

Grep for `vcpe` in the test file and replace each `vcpe` argument name with `vehicleTipus`. The values (`"PE"`, `"SF"`, etc.) stay the same — only the variable names change.

- [ ] **Step 4: Run strategy model tests**

```bash
npm test -- capitalCallStrategyModel
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/capitalCallStrategyModel.js test/capitalCallStrategyModel.test.js
git commit -m "refactor: rename vcpe param to vehicleTipus in capitalCallStrategyModel"
```

---

## Task 4: Rename vcpe → vehicleTipus in data model files

**Files:**
- Modify: `src/data/fundDetailModel.js`
- Modify: `src/data/alternativesModel.js`
- Modify: `src/data/privateCompanyModel.js`
- Modify: `src/data/privateRoutes.js`
- Modify: `src/data/searchFundSnapshotModel.js`
- Modify: `src/data/prospectiveCashModel.js`
- Modify: `src/data/realEstateModel.js`
- Modify: `src/data/searcherModel.js`
- Modify: `src/data/dashboardTypes.js`

- [ ] **Step 1: Update fundDetailModel.js**

`src/data/fundDetailModel.js:10` — `makeFundRouteId`:
```js
export function makeFundRouteId(row) {
  if (row?.id && row?.vehicleTipus) return `${row.vehicleTipus}:${row.id}`;
  return row?.id ?? slugify(row?.fons ?? "");
}
```

`src/data/fundDetailModel.js:19-20` — `findFundRowsByRouteId`:
```js
const [, vehicleTipus, entityId] = match;
return source.filter((row) => row?.id === entityId && row?.vehicleTipus === vehicleTipus);
```

`src/data/fundDetailModel.js:28`:
```js
const nonCompanyHits = hits.filter((row) => row?.vehicleTipus !== "PC");
```

`src/data/fundDetailModel.js:40`:
```js
est: normalizeCapitalCallStrategy(row?.est, row?.vehicleTipus, row),
```

`src/data/fundDetailModel.js:68` — `buildFundDetailSnapshot`:
```js
const vehicleTipus = txs[0].vehicleTipus;
```

`src/data/fundDetailModel.js:102`:
```js
vehicleTipus,
```

- [ ] **Step 2: Update alternativesModel.js**

Replace all `vcpe` field references with `vehicleTipus`. The function signature `buildPrivateSyntheticRows(rows, { vcpe, include, fons, tipus, est })` becomes:
```js
export function buildPrivateSyntheticRows(rows, { vehicleTipus, include, fons, tipus, est }) {
```

Replace `vcpe` with `vehicleTipus` throughout, including:
- `id: row?.id ?? slugify(\`${vehicleTipus}-${fundName}\`)`
- `vehicleTipus,` in the row shape
- Dedup keys: `` `${row.fons}|${row.data}|${row.cat}|${row.eur}|${row.vehicleTipus}` ``
- Return objects: `{ fons: aliased, vehicleTipus: "SF" }` / `{ fons: aliased, vehicleTipus: "PC" }`

- [ ] **Step 3: Update privateCompanyModel.js**

`src/data/privateCompanyModel.js:48`:
```js
if (!["PC", "SF"].includes(row?.vehicleTipus)) return;
```

`src/data/privateCompanyModel.js:57`:
```js
tipus: row.vehicleTipus,
```

- [ ] **Step 4: Update privateRoutes.js**

```js
if (row?.vehicleTipus === "PC") {
```

- [ ] **Step 5: Update searchFundSnapshotModel.js**

In the JSDoc and function body, rename `vcpe` parameter to `vehicleTipus`:
```js
return function inferStrategy({ fons, vehicleTipus } = {}) {
  ...
  if (vehicleTipus === "PC") return STRATEGY_PARTICIPADA_ALTRES;
```

- [ ] **Step 6: Update prospectiveCashModel.js**

Replace `row?.vcpe` / `row.vcpe` with `row?.vehicleTipus` / `row.vehicleTipus`:
- Line ~30: `if (String(row?.vehicleTipus ?? "").trim() !== "RE") continue;`
- Line ~127: `if (String(row?.vehicleTipus ?? "").trim() === "RE") {`

- [ ] **Step 7: Update realEstateModel.js**

```js
tx: rows.filter((row) => row.vehicleTipus === "RE" && row.cat !== "Compromís"),
compr: rows.filter((row) => row.vehicleTipus === "RE" && row.cat === "Compromís"),
```

- [ ] **Step 8: Update searcherModel.js**

```js
if (row?.vehicleTipus !== "SF") return;
```

- [ ] **Step 9: Update dashboardTypes.js JSDoc**

Find `@property {string} vcpe` and replace:
```js
 * @property {string} vehicleTipus
```

- [ ] **Step 10: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add src/data/
git commit -m "refactor: rename vcpe to vehicleTipus across all data model files"
```

---

## Task 5: Update db.js — remove vcpe from writes, use vehicleTipus

**Files:**
- Modify: `src/db.js`

- [ ] **Step 1: Update insertFund — remove vcpe param, write vehicle_tipus to fund_meta instead**

Current signature (`src/db.js:643`):
```js
export async function insertFund(fons, vcpe, est, compromisEur, divisa, options = {}) {
```

New signature:
```js
export async function insertFund(fons, vehicleTipus, est, compromisEur, divisa, options = {}) {
```

Change (`src/db.js:650`):
```js
const normalizedEst = normalizeCapitalCallStrategy(est, vehicleTipus, { fons }) ?? defaultCapitalCallStrategyForVehicleTipus(vehicleTipus);
```

Remove `vcpe` from the capital_calls INSERT (`src/db.js:652-661`):
```js
const { error: ccErr } = await supabase.from("capital_calls").insert({
  vehicle_id: resolved.id,
  fons: resolved.canonicalName,
  est: normalizedEst, cat: "Compromís", eur: compromisEur, divisa,
  comentaris: options.comentaris ?? null,
  amount_native: options.amountNative ?? (divisa === "EUR" ? compromisEur : null),
  fx_rate: options.fxRate ?? (divisa === "EUR" ? 1 : null),
  fx_source: options.fxSource ?? (divisa === "EUR" ? "identity" : null),
  mes, year, fy, tipus: "Compromís", data: data_iso,
});
```

Add vehicle_tipus to the fund_meta upsert (`src/db.js:664`):
```js
await supabase.from("fund_meta")
  .upsert({ vehicle_id: resolved.id, fons: resolved.canonicalName, vehicle_tipus: vehicleTipus, tvpi: null, irr: null }, { onConflict: "vehicle_id" });
```

Update audit log call and return value — replace `vcpe` with `vehicleTipus`.

- [ ] **Step 2: Update insertCapitalCall — remove vcpe from row**

`src/db.js:1060-1061`:
```js
// Remove: vcpe: cc.vcpe ?? null,
est: normalizeCapitalCallStrategy(cc.est, cc.vehicleTipus ?? null, cc) ?? null,
```

The `row` object no longer includes a `vcpe` field.

- [ ] **Step 3: Update updateCapitalCall — remove vcpe handling**

Remove the `vcpe` update block (`src/db.js:1112-1116`). The `est` normalization must now fetch `vehicle_tipus` from `fund_meta` for the affected row:

```js
if (Object.prototype.hasOwnProperty.call(fields, "est")) {
  const nextEst = Object.prototype.hasOwnProperty.call(updates, "est") ? updates.est : old?.est;
  const nextFons = Object.prototype.hasOwnProperty.call(updates, "fons") ? updates.fons : old?.fons;
  // Look up vehicle_tipus from fund_meta for this vehicle
  const { data: fmRow } = await supabase
    .from("fund_meta")
    .select("vehicle_tipus")
    .eq("vehicle_id", old?.vehicle_id)
    .single();
  updates.est = normalizeCapitalCallStrategy(nextEst, fmRow?.vehicle_tipus ?? null, { fons: nextFons });
}
```

- [ ] **Step 4: Update defaultCapitalCallStrategyForVcpe call sites in db.js**

Replace any remaining `defaultCapitalCallStrategyForVcpe` references with `defaultCapitalCallStrategyForVehicleTipus`.

- [ ] **Step 5: Run tests**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/db.js
git commit -m "feat: remove vcpe from capital_calls writes; vehicle_tipus lives in fund_meta"
```

---

## Task 6: Update useDashboardData.js and CcTransactionModal.jsx

**Files:**
- Modify: `src/components/hooks/useDashboardData.js`
- Modify: `src/components/CcTransactionModal.jsx`

- [ ] **Step 1: Update sanitizeCapitalCallValues in useDashboardData.js**

Remove `vcpe` from the destructure and return value (`src/components/hooks/useDashboardData.js:20-40`):

```js
function sanitizeCapitalCallValues(values) {
  const {
    fons, tipus, cat, est, divisa, comentaris,
    data, eur, amountNative, fxRate, fxSource,
    recallable, non_recallable, from_recallable,
  } = values ?? {};
  return {
    fons: String(fons ?? "").trim(),
    tipus: normalizeCapitalCallTipus(tipus),
    cat: cat ?? null,
    est: est ?? null,   // est normalization happens in db.js now, using fund_meta lookup
    divisa: divisa || "EUR",
    comentaris: String(comentaris ?? "").trim() || null,
    data,
    eur,
    amountNative,
    fxRate,
    fxSource,
    recallable,
    non_recallable,
    from_recallable,
  };
}
```

- [ ] **Step 2: Update syncSearchersFromCapitalCalls filter**

`src/components/hooks/useDashboardData.js:71`:
```js
const sfRows = Array.isArray(rows) ? rows.filter((row) => row?.vehicleTipus === "SF") : [];
```

- [ ] **Step 3: Remove hidden vcpe field from CcTransactionModal.jsx**

`src/components/CcTransactionModal.jsx:93` — remove the vcpe field entry entirely:
```js
// DELETE this line:
{ key: "vcpe", label: "VCPE", type: "select", options: ["PE", "VC", "RE", "SF", "PC"], defaultValue: isEdit ? editRow.vcpe : (addDefaults?.vcpe ?? "PE"), visible: () => false },
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/components/hooks/useDashboardData.js src/components/CcTransactionModal.jsx
git commit -m "refactor: remove vcpe from transaction modal and sanitize payload"
```

---

## Task 7: Update FundDetail.jsx

**Files:**
- Modify: `src/components/FundDetail.jsx`

- [ ] **Step 1: Replace vcpe destructure with vehicleTipus**

`src/components/FundDetail.jsx:47`:
```js
const { fundName, fundId, vehicleTipus, est, compromis, calls, dist, net, utilPct, tvpiFund, dpiFund, rvpiFund, irrFund, txLog, recallablePool } = detail ?? {};
```

- [ ] **Step 2: Update permission check**

`src/components/FundDetail.jsx:96`:
```js
const canAccessFund = vehicleTipus === "RE" ? canAccessSection("real-estate") : canAccessSection("alternatives");
```

- [ ] **Step 3: Update Badge display**

`src/components/FundDetail.jsx:123`:
```js
<Badge label={vehicleTipus} cfg={VCPE_CFG[vehicleTipus] || {}} />
```

- [ ] **Step 4: Update SF column conditional**

`src/components/FundDetail.jsx:293` and `:303`:
```js
{["Data", "Tipus", "Import (Original)", "Import (Euros)", "Recallable", ...(vehicleTipus === "SF" ? ["Fase"] : []), ...(canEdit ? [""] : [])].map(h => (
...
{vehicleTipus === "SF" ? <th style={{ padding: "6px 12px" }} /> : null}
```

- [ ] **Step 5: Run tests and check app builds**

```bash
npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/FundDetail.jsx
git commit -m "refactor: rename vcpe to vehicleTipus in FundDetail"
```

---

## Task 8: Update import scripts

**Files:**
- Modify: `scripts/cc_import.mjs`
- Modify: `scripts/sf_import.mjs`
- Modify: `scripts/startups_import.mjs`
- Modify: `scripts/cc_import_append.mjs`

### cc_import.mjs

- [ ] **Step 1: Change the delete query**

Current (`scripts/cc_import.mjs:297`):
```js
.in("vcpe", ["PE", "VC", "RE"]);
```

Change to delete based on fund_meta scope (fund vehicles, not PC/SF companies):
```js
// Delete all fund-vehicle capital_calls (PE, VC, RE in fund_meta)
const { data: fundVehicles } = await sb
  .from("fund_meta")
  .select("vehicle_id")
  .in("vehicle_tipus", ["PE", "VC", "RE"]);
const fundIds = (fundVehicles ?? []).map((r) => r.vehicle_id);
await sb.from("capital_calls").delete().in("vehicle_id", fundIds);
```

- [ ] **Step 2: Change row inserts — remove vcpe field, upsert fund_meta instead**

When inserting rows, remove `vcpe` from the row object. Instead, upsert `fund_meta` with `vehicle_tipus` for each vehicle before inserting capital_calls:

```js
// Before bulk insert, ensure fund_meta has vehicle_tipus for each vehicle
const metaRows = [...new Map(rows.map(r => [r.vehicle_id, { vehicle_id: r.vehicle_id, fons: r.fons, vehicle_tipus: r.vehicleTipus }])).values()];
await sb.from("fund_meta").upsert(metaRows, { onConflict: "vehicle_id" });

// Then insert without vcpe
const ccRows = rows.map(({ vehicleTipus, ...r }) => r);  // strip vehicleTipus from row
await sb.from("capital_calls").insert(ccRows);
```

### sf_import.mjs

- [ ] **Step 3: Change SF delete query**

Current (`scripts/sf_import.mjs:483`):
```js
await sb.from("capital_calls").delete().eq("vcpe", "SF");
```

Change to:
```js
const { data: sfVehicles } = await sb.from("fund_meta").select("vehicle_id").eq("vehicle_tipus", "SF");
const sfIds = (sfVehicles ?? []).map((r) => r.vehicle_id);
if (sfIds.length) await sb.from("capital_calls").delete().in("vehicle_id", sfIds);
```

- [ ] **Step 4: Change SF PC delete query in sf_import.mjs**

Current (`scripts/sf_import.mjs:486`):
```js
.eq("vcpe", "PC")
```

Change to:
```js
const { data: pcVehicles } = await sb.from("fund_meta").select("vehicle_id").eq("vehicle_tipus", "PC");
const pcIds = (pcVehicles ?? []).map((r) => r.vehicle_id);
if (pcIds.length) await sb.from("capital_calls").delete().in("vehicle_id", pcIds);
```

- [ ] **Step 5: Remove vcpe from row inserts in sf_import.mjs**

Find `vcpe: "SF"` in row construction (`scripts/sf_import.mjs:425`) and remove it. Before inserting, upsert fund_meta with `vehicle_tipus: "SF"` for the vehicle.

### startups_import.mjs

- [ ] **Step 6: Change PC delete query**

Current (`scripts/startups_import.mjs:257`):
```js
await sb.from("capital_calls").delete().eq("vcpe", "PC");
```

Change to:
```js
const { data: pcVehicles } = await sb.from("fund_meta").select("vehicle_id").eq("vehicle_tipus", "PC");
const pcIds = (pcVehicles ?? []).map((r) => r.vehicle_id);
if (pcIds.length) await sb.from("capital_calls").delete().in("vehicle_id", pcIds);
```

- [ ] **Step 7: Remove vcpe from row inserts in startups_import.mjs**

`scripts/startups_import.mjs:142` — remove `vcpe: "PC"` from the row. Upsert fund_meta with `vehicle_tipus: "PC"` for the vehicle before inserting capital_calls.

Also remove `vcpe: "SF"` at `scripts/startups_import.mjs:218` and `scripts/startups_import.mjs` SF delete at line 218.

### cc_import_append.mjs

- [ ] **Step 8: Remove vcpe from row shape and validation**

`scripts/cc_import_append.mjs:92-93` — remove `vcpe` from `FUNDS_COLS` and `STARTUP_COLS`.

`scripts/cc_import_append.mjs:121-122` — remove vcpe parsing and `VALID_VCPE` check. Instead, read vehicle_tipus from fund_meta after vehicle resolution, or accept vehicleTipus as a passed-in parameter.

`scripts/cc_import_append.mjs:129` — remove `vcpe` from pushed row object.

`scripts/cc_import_append.mjs:191` — remove `vcpe: raw.vcpe || null`.

`scripts/cc_import_append.mjs:315` — change kind derivation:
```js
// Look up from fund_meta instead of vcpe
const { data: fmRow } = await sb.from("fund_meta").select("vehicle_tipus").eq("vehicle_id", vehicleId).single();
const kind = (fmRow?.vehicle_tipus === "SF" || fmRow?.vehicle_tipus === "PC") ? "company" : "vehicle";
```

- [ ] **Step 9: Commit**

```bash
git add scripts/
git commit -m "feat: update import scripts to use fund_meta.vehicle_tipus instead of capital_calls.vcpe"
```

---

## Task 9: Drop vcpe column from capital_calls

Do this only after all code changes are deployed and verified.

**Files:**
- Create: `supabase/migrations/20260522_drop_capital_calls_vcpe.sql`

- [ ] **Step 1: Create migration**

```sql
-- 20260522_drop_capital_calls_vcpe.sql
-- Safe to run only after all app code no longer reads or writes capital_calls.vcpe.
ALTER TABLE public.capital_calls DROP COLUMN IF EXISTS vcpe;
```

- [ ] **Step 2: Apply migration**

Run via `mcp__plugin_supabase_supabase__apply_migration` with project_id `lekmvgtnwvhcvabbhuby`.

- [ ] **Step 3: Verify no references remain in code**

```bash
grep -r "\.vcpe" src/ scripts/ --include="*.{js,jsx,mjs}" | grep -v "node_modules"
# Expected: no output
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260522_drop_capital_calls_vcpe.sql
git commit -m "db: drop capital_calls.vcpe column — vehicle_tipus in fund_meta is source of truth"
```

---

## Self-Review

**Spec coverage:**
- ✅ All 86 orphan vehicles get fund_meta rows (Task 1)
- ✅ DB reads join fund_meta for vehicle type (Task 2)
- ✅ `normalizeCapitalCallStrategy` renamed (Task 3)
- ✅ All data model files renamed (Task 4)
- ✅ db.js writes updated (Task 5)
- ✅ useDashboardData + modal updated (Task 6)
- ✅ FundDetail updated (Task 7)
- ✅ All import scripts updated (Task 8)
- ✅ vcpe column dropped (Task 9)

**Gaps / watch-outs:**
- `src/data/capital-calls.js` (static fallback file) still has `vcpe` fields on every row. This file is the offline seed data. After the DB migration, the app always reads from Supabase first, so the static file is rarely hit. Leave it as-is for now — it will continue to produce rows with `vcpe` which the updated mappers will handle via the `?? row.vcpe` fallback in Task 2.
- The `_snapshotInferrer` in `capitalCallStrategyModel.js` passes `vcpe` in the context object. After Task 3, it passes `vcpe: vehicleTipus` — this is an alias that keeps the inferrer working unchanged.
- Route IDs (`PE:A123456`) keep the same format since `makeFundRouteId` now encodes `vehicleTipus` which has the same values. Existing bookmarks remain valid.
- Test files in `test/` that reference `vcpe` need renaming too — check `test/capitalCallStrategyModel.test.js` (covered in Task 3) and `test/prospectiveCashModel.test.js`.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run `/autoplan` for full review pipeline, or individual reviews above.
