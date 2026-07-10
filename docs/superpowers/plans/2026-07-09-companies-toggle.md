# Companies Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one shared `Incloure companies` toggle (default off) that optionally folds companies (Search Funds + Participades) into the Alternatives MOIC/IRR cohort matrix and the Portfoli/Fons table.

**Architecture:** Generalize the ALT-only cohort summarizer into a section-parameterized helper so a second `buildCompanyCohortMatrix` shares the same math. The matrix component becomes presentational/reusable (title + labels + action as props). A single `usePersistedState("ui_alt_include_companies", false)` flag in `Dashboard` drives both surfaces, each rendering a bound checkbox.

**Tech Stack:** React (JSX), `node:test` unit tests, Vite build, localStorage-backed `usePersistedState`.

## Global Constraints

- Companies = `estSection(est) === "SF"` (Search Fund – Cerca/Participada) or `=== "PC"` (Participada Altres). Vehicles = `estSection(est) === "ALT"`.
- Toggle default is **OFF**; OFF = strict ALT-only on both surfaces (Option A).
- Company MOIC comes from the provisional `tvpi: 1`; IRR from real dated flows. Do not special-case company TVPI.
- Acquired search funds are deduped out of the SF set via `excludeIds` (mirrors `useDashboardData`'s `sfTx.filter(!actualCompanyIds.has(id))`).
- Do NOT touch the Real Estate usage of `FundsIndexInner` or run any DataLoader re-import.
- Existing `buildAltCohortMatrix(rawCC, fundMeta, asOfDate)` positional signature and output shape must stay unchanged (existing tests depend on it).

---

## File Structure

- `src/data/altCohortModel.js` (modify) — extract `summarizeFundsBySection` + `buildMatrixFromFunds`; add `COMPANY_STRATEGIES`, `COMPANY_STRATEGY_LABELS`, `buildCompanyCohortMatrix`.
- `test/altCohortModel.test.js` (modify) — add company-matrix tests.
- `src/components/funds/IncludeCompaniesToggle.jsx` (create) — shared checkbox control.
- `src/components/funds/AltCohortMatrix.jsx` (modify) — accept `title`, `strategyLabels`, `action` props.
- `src/components/tabs/ResumTab.jsx` (modify) — render companies matrix + toggle action.
- `src/components/Dashboard.jsx` (modify) — shared flag, compute `companyMatrix`, pass props to `ResumTab` and Portfoli `FundsIndexInner`.
- `src/components/FundsIndex.jsx` (modify) — `includeCompanies`/`onToggleCompanies` props, relaxed filter, toggle in header.
- `src/utils/storage.js` (modify) — register the new key in `TC_LS_KEYS`.

---

### Task 1: Refactor cohort model into a section-parameterized core (pure refactor)

**Files:**
- Modify: `src/data/altCohortModel.js`
- Test: `test/altCohortModel.test.js` (existing tests are the regression guard)

**Interfaces:**
- Consumes: `estSection` (existing import), `computeCohort` (existing, unchanged).
- Produces:
  - `summarizeFundsBySection(rawCC, fundMeta, { sections }) → Array<{ id, est, vintage, calls, dist, tvpi, flows }>`
  - `buildMatrixFromFunds(funds, strategies, asOfDate) → { vintages, strategies, cells, totals:{ byVintage, byStrategy, grand } }`
  - `buildAltCohortMatrix(rawCC, fundMeta, asOfDate?)` — unchanged public behavior, now delegates.

- [ ] **Step 1: Run existing tests to confirm green baseline**

Run: `node --test --test-isolation=none test/altCohortModel.test.js`
Expected: PASS (9 tests).

- [ ] **Step 2: Replace `summarizeAltFunds` and `buildAltCohortMatrix` with the parameterized core**

In `src/data/altCohortModel.js`, replace the `summarizeAltFunds` function (currently starting `function summarizeAltFunds(rawCC, fundMeta) {`) and the `buildAltCohortMatrix` function body with:

```js
/**
 * Collapse raw capital-call rows into one summary per fund, keeping only funds
 * whose resolved section is in `sections` (e.g. ["ALT"] or ["SF","PC"]).
 * Strategy = earliest-dated Compromís row's est; vintage = earliest Compromís
 * year; funds with no dated commitment are skipped.
 */
function summarizeFundsBySection(rawCC, fundMeta, { sections }) {
  const source = Array.isArray(rawCC) ? rawCC : [];
  const metaList = Array.isArray(fundMeta) ? fundMeta : [];
  const keep = new Set(sections);

  const groups = new Map();
  for (const raw of source) {
    const routeId = makeFundRouteId(raw);
    if (!routeId) continue;
    if (!groups.has(routeId)) groups.set(routeId, []);
    groups.get(routeId).push(normalizeFundDetailRow(raw));
  }

  const funds = [];
  for (const rows of groups.values()) {
    const compromisRows = rows
      .filter((r) => r.cat === "Compromís" && r.data)
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const est = compromisRows.find((r) => r.est)?.est ?? null;
    if (!keep.has(estSection(est))) continue;

    const vintage = compromisRows
      .map((r) => Number(String(r.data).slice(0, 4)))
      .filter((y) => Number.isFinite(y))[0];
    if (vintage == null) continue;

    const calls = rows
      .filter((r) => r.cat === "Capital Call")
      .reduce((s, r) => s + Number(r.eur || 0), 0);
    const dist = rows
      .filter((r) => DIST_CATS.has(r.cat))
      .reduce((s, r) => s + Math.abs(Number(r.eur || 0)), 0);
    const flows = rows.filter((r) => isFlowCat(r.cat) && r.data);

    const id = rows.find((r) => r.id)?.id ?? null;
    const name = rows[0]?.fons ?? null;
    const meta = metaList.find((m) => (id && m.id === id) || m.fons === name);
    const tvpi = meta?.tvpi ?? null;

    funds.push({ id, est, vintage, calls, dist, tvpi, flows });
  }
  return funds;
}

/** Build the { vintages, strategies, cells, totals } cross-tab from fund summaries. */
function buildMatrixFromFunds(funds, strategies, asOfDate) {
  const vintages = [...new Set(funds.map((f) => f.vintage))].sort((a, b) => a - b);

  const cells = {};
  for (const vintage of vintages) {
    for (const strategy of strategies) {
      const inCell = funds.filter((f) => f.vintage === vintage && f.est === strategy);
      cells[`${vintage}|${strategy}`] = inCell.length ? computeCohort(inCell, asOfDate) : null;
    }
  }

  const byVintage = {};
  for (const vintage of vintages) {
    byVintage[vintage] = computeCohort(funds.filter((f) => f.vintage === vintage), asOfDate);
  }
  const byStrategy = {};
  for (const strategy of strategies) {
    byStrategy[strategy] = computeCohort(funds.filter((f) => f.est === strategy), asOfDate);
  }
  const grand = computeCohort(funds, asOfDate);

  return { vintages, strategies, cells, totals: { byVintage, byStrategy, grand } };
}

/**
 * Build the MOIC/IRR cohort matrix for the Alternatives (vehicle) funds.
 * @returns {{ vintages: number[], strategies: string[],
 *   cells: Record<string, {moic:number|null, irr:number|null}|null>,
 *   totals: { byVintage: Record<string, object|null>,
 *             byStrategy: Record<string, object|null>, grand: object|null } }}
 */
export function buildAltCohortMatrix(
  rawCC,
  fundMeta,
  asOfDate = new Date().toISOString().slice(0, 10),
) {
  const funds = summarizeFundsBySection(rawCC, fundMeta, { sections: ["ALT"] });
  return buildMatrixFromFunds(funds, ALT_STRATEGIES, asOfDate);
}
```

- [ ] **Step 3: Run existing tests to verify the refactor preserved behavior**

Run: `node --test --test-isolation=none test/altCohortModel.test.js`
Expected: PASS (all 9 original tests still green — matrix output shape unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/data/altCohortModel.js
git commit -m "refactor: extract section-parameterized cohort core in altCohortModel"
```

---

### Task 2: Add company strategies + `buildCompanyCohortMatrix`

**Files:**
- Modify: `src/data/altCohortModel.js`
- Test: `test/altCohortModel.test.js`

**Interfaces:**
- Consumes: `summarizeFundsBySection`, `buildMatrixFromFunds`, `estSection` (from Task 1 / existing).
- Produces:
  - `COMPANY_STRATEGIES: string[]`
  - `COMPANY_STRATEGY_LABELS: Record<string,string>`
  - `buildCompanyCohortMatrix(rawCC, fundMeta, { excludeIds?: Set, asOfDate?: string }) → same matrix shape as buildAltCohortMatrix`

- [ ] **Step 1: Write the failing tests**

Update the import line at the top of `test/altCohortModel.test.js`:

```js
import { buildAltCohortMatrix, buildCompanyCohortMatrix, ALT_STRATEGIES, COMPANY_STRATEGIES } from "../src/data/altCohortModel.js";
```

Then append these tests at the end of the file:

```js
test("company matrix groups SF and PC by company strategies × vintage; ignores ALT", () => {
  const rows = [
    { id: "S1", fons: "Searcher One", est: "Search Fund - Cerca", cat: "Compromís", eur: 50000, data: "2021-01-01" },
    { id: "S1", fons: "Searcher One", est: "Search Fund - Cerca", cat: "Capital Call", eur: 50000, data: "2021-06-01" },
    { id: "P1", fons: "Participada One", est: "Participada (Altres)", cat: "Compromís", eur: 200000, data: "2022-01-01" },
    { id: "P1", fons: "Participada One", est: "Participada (Altres)", cat: "Capital Call", eur: 200000, data: "2022-06-01" },
    // An ALT vehicle must be ignored by the company matrix.
    { id: "A1", fons: "Alt Fund", est: "Fons Primari", cat: "Compromís", eur: 100000, data: "2020-01-01" },
    { id: "A1", fons: "Alt Fund", est: "Fons Primari", cat: "Capital Call", eur: 100000, data: "2020-06-01" },
  ];
  const meta = [
    { id: "S1", fons: "Searcher One", tvpi: 1.0 },
    { id: "P1", fons: "Participada One", tvpi: 2.0 },
    { id: "A1", fons: "Alt Fund", tvpi: 3.0 },
  ];
  const matrix = buildCompanyCohortMatrix(rows, meta, { asOfDate: ASOF });
  assert.deepEqual(matrix.strategies, COMPANY_STRATEGIES);
  assert.deepEqual(matrix.vintages, [2021, 2022]);
  assert.ok(Math.abs(matrix.cells["2021|Search Fund - Cerca"].moic - 1.0) < 1e-9);
  assert.ok(Math.abs(matrix.cells["2022|Participada (Altres)"].moic - 2.0) < 1e-9);
  assert.equal(matrix.vintages.includes(2020), false);
});

test("acquired search funds (in excludeIds) are dropped from the company matrix SF set", () => {
  const rows = [
    { id: "ACQ", fons: "Acme Searcher", est: "Search Fund - Cerca", cat: "Compromís", eur: 50000, data: "2021-01-01" },
    { id: "ACQ", fons: "Acme Searcher", est: "Search Fund - Cerca", cat: "Capital Call", eur: 50000, data: "2021-06-01" },
    { id: "P2", fons: "Other Participada", est: "Participada (Altres)", cat: "Compromís", eur: 100000, data: "2021-01-01" },
    { id: "P2", fons: "Other Participada", est: "Participada (Altres)", cat: "Capital Call", eur: 100000, data: "2021-06-01" },
  ];
  const meta = [
    { id: "ACQ", fons: "Acme Searcher", tvpi: 1.5 },
    { id: "P2", fons: "Other Participada", tvpi: 2.0 },
  ];
  const matrix = buildCompanyCohortMatrix(rows, meta, { excludeIds: new Set(["ACQ"]), asOfDate: ASOF });
  // Acquired searcher excluded → its SF cell is empty.
  assert.equal(matrix.cells["2021|Search Fund - Cerca"], null);
  // Unrelated participada remains.
  assert.ok(Math.abs(matrix.cells["2021|Participada (Altres)"].moic - 2.0) < 1e-9);
});

test("companies without a Compromís vintage are skipped", () => {
  const rows = [
    { id: "NP", fons: "No Compromís Co", est: "Participada (Altres)", cat: "Capital Call", eur: 100000, data: "2021-06-01" },
  ];
  const meta = [{ id: "NP", fons: "No Compromís Co", tvpi: 2.0 }];
  const matrix = buildCompanyCohortMatrix(rows, meta, { asOfDate: ASOF });
  assert.deepEqual(matrix.vintages, []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-isolation=none test/altCohortModel.test.js`
Expected: FAIL — `buildCompanyCohortMatrix` / `COMPANY_STRATEGIES` are not exported yet (import error or `not a function`).

- [ ] **Step 3: Implement the company constants and builder**

In `src/data/altCohortModel.js`, add the constants right after the `ALT_STRATEGY_LABELS` block:

```js
// Company strategies (Search Funds + Participades), in fixed display order.
export const COMPANY_STRATEGIES = [
  "Search Fund - Cerca",
  "Search Fund - Participada",
  "Participada (Altres)",
];

export const COMPANY_STRATEGY_LABELS = {
  "Search Fund - Cerca": "Cerca",
  "Search Fund - Participada": "Participada",
  "Participada (Altres)": "Altres",
};
```

Then add the builder right after `buildAltCohortMatrix`:

```js
/**
 * Build the MOIC/IRR cohort matrix for companies (Search Funds + Participades).
 * `excludeIds` drops acquired search funds from the SF set so they are not
 * counted as both a searcher and a participada (mirrors useDashboardData's
 * sfTx.filter(!actualCompanyIds.has(id))). Same output shape as buildAltCohortMatrix.
 */
export function buildCompanyCohortMatrix(
  rawCC,
  fundMeta,
  { excludeIds = new Set(), asOfDate = new Date().toISOString().slice(0, 10) } = {},
) {
  const all = summarizeFundsBySection(rawCC, fundMeta, { sections: ["SF", "PC"] });
  const funds = all.filter((f) => !(estSection(f.est) === "SF" && excludeIds.has(f.id)));
  return buildMatrixFromFunds(funds, COMPANY_STRATEGIES, asOfDate);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test --test-isolation=none test/altCohortModel.test.js`
Expected: PASS (original 9 + 3 new = 12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/altCohortModel.js test/altCohortModel.test.js
git commit -m "feat: add buildCompanyCohortMatrix for the companies cohort section"
```

---

### Task 3: Shared `IncludeCompaniesToggle` control

**Files:**
- Create: `src/components/funds/IncludeCompaniesToggle.jsx`

**Interfaces:**
- Produces: `IncludeCompaniesToggle({ checked: boolean, onChange: (checked:boolean)=>void, tc: object })` — a labeled checkbox reading "Incloure companies".

- [ ] **Step 1: Create the component**

Create `src/components/funds/IncludeCompaniesToggle.jsx`:

```jsx
import React from "react";

/** Small labeled checkbox that toggles company rows into the vehicles views. */
export function IncludeCompaniesToggle({ checked, onChange, tc }) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        color: tc.textMid,
        userSelect: "none",
      }}
    >
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: "pointer", accentColor: tc.navy }}
      />
      Incloure companies
    </label>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds (no import/JSX errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/funds/IncludeCompaniesToggle.jsx
git commit -m "feat: add IncludeCompaniesToggle shared control"
```

---

### Task 4: Make `AltCohortMatrix` reusable (title / labels / action props)

**Files:**
- Modify: `src/components/funds/AltCohortMatrix.jsx`

**Interfaces:**
- Consumes: `ALT_STRATEGY_LABELS` (existing default import), `SectionHeader` (existing, already supports an `action` prop).
- Produces: `AltCohortMatrix({ matrix, tc, title?, strategyLabels?, action? })`. Defaults preserve current ALT rendering. Strategy iteration continues to use `matrix.strategies`.

- [ ] **Step 1: Update the component signature and header**

In `src/components/funds/AltCohortMatrix.jsx`, change the default export signature line from `export default function AltCohortMatrix({ matrix, tc }) {` to:

```jsx
export default function AltCohortMatrix({
  matrix,
  tc,
  title = "MOIC i IRR per Vintage i Estratègia",
  strategyLabels = ALT_STRATEGY_LABELS,
  action,
}) {
```

Change the `SectionHeader` line inside the returned JSX from:

```jsx
      <SectionHeader title="MOIC i IRR per Vintage i Estratègia" tc={tc} />
```
to:
```jsx
      <SectionHeader title={title} tc={tc} action={action} />
```

Change the column-label cell from `ALT_STRATEGY_LABELS[s] ?? s` to `strategyLabels[s] ?? s`:

```jsx
                <th key={s} style={{ ...headCell, textAlign: "right" }}>{strategyLabels[s] ?? s}</th>
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds; existing Resum matrix still renders with default title/labels (defaults unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/components/funds/AltCohortMatrix.jsx
git commit -m "refactor: make AltCohortMatrix accept title/strategyLabels/action props"
```

---

### Task 5: Wire the matrix surface (Dashboard flag + ResumTab companies section)

**Files:**
- Modify: `src/components/Dashboard.jsx`
- Modify: `src/components/tabs/ResumTab.jsx`
- Modify: `src/utils/storage.js`

**Interfaces:**
- Consumes: `buildCompanyCohortMatrix`, `COMPANY_STRATEGY_LABELS` (Task 2); `IncludeCompaniesToggle` (Task 3); reusable `AltCohortMatrix` (Task 4); `usePersistedState` (existing, already imported in Dashboard from `../utils.js`).
- Produces: `ResumTab` accepts `companyMatrix`, `includeCompanies`, `onToggleCompanies` in addition to current props. `Dashboard` owns `includeCompanies` state and passes it down.

- [ ] **Step 1: Register the persistence key**

In `src/utils/storage.js`, add `"ui_alt_include_companies"` to the `TC_LS_KEYS` array (in the `ui_*` group, e.g. right after the line containing `"ui_navItem", "ui_sidebarCollapsed",`):

```js
  "ui_alt_include_companies",
```

- [ ] **Step 2: Add the shared flag and company matrix in Dashboard**

In `src/components/Dashboard.jsx`, update the import from `altCohortModel`:

```js
import { buildAltCohortMatrix, buildCompanyCohortMatrix } from "../data/altCohortModel.js";
```

Add the persisted flag near the other Dashboard state (after the destructured router-state block, before the `return`):

```js
  const [includeCompanies, setIncludeCompanies] = usePersistedState("ui_alt_include_companies", false);
```

Replace the `ResumTab` render block (currently passing only `matrix={buildAltCohortMatrix(...)}`) with:

```jsx
          {tab === "resum" && (
            <ResumTab
              tc={tc}
              byFy={byFy}
              byEst={byEst}
              estCfg={estCfg}
              matrix={buildAltCohortMatrix(d.rawCC, readStoredJSON("tc_fundMeta", []))}
              companyMatrix={buildCompanyCohortMatrix(d.rawCC, readStoredJSON("tc_fundMeta", []), { excludeIds: d.actualCompanyIds })}
              includeCompanies={includeCompanies}
              onToggleCompanies={setIncludeCompanies}
            />
          )}
```

- [ ] **Step 3: Render the companies matrix + toggle in ResumTab**

In `src/components/tabs/ResumTab.jsx`, update imports (add below the existing `AltCohortMatrix` import):

```jsx
import { COMPANY_STRATEGY_LABELS } from "../../data/altCohortModel.js";
import { IncludeCompaniesToggle } from "../funds/IncludeCompaniesToggle.jsx";
```

Update the function signature:

```jsx
export function ResumTab({
  tc = TC_LIGHT,
  byFy = [],
  byEst = [],
  estCfg = {},
  matrix = null,
  companyMatrix = null,
  includeCompanies = false,
  onToggleCompanies = () => {},
}) {
```

Replace the existing matrix block (currently `{matrix && matrix.vintages && matrix.vintages.length > 0 && ( <div style={{ marginBottom: 18 }}><AltCohortMatrix matrix={matrix} tc={tc} /></div> )}`) with:

```jsx
      {matrix && matrix.vintages && matrix.vintages.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <AltCohortMatrix
            matrix={matrix}
            tc={tc}
            action={
              <IncludeCompaniesToggle
                checked={includeCompanies}
                onChange={onToggleCompanies}
                tc={tc}
              />
            }
          />
          {includeCompanies && companyMatrix && companyMatrix.vintages && companyMatrix.vintages.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <AltCohortMatrix
                matrix={companyMatrix}
                tc={tc}
                title="MOIC i IRR — Companies (Search Funds + Participades)"
                strategyLabels={COMPANY_STRATEGY_LABELS}
              />
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: Verify build and model tests**

Run: `npm run build && node --test --test-isolation=none test/altCohortModel.test.js`
Expected: build succeeds; 12 tests pass.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open the dashboard, go to **Mercats Privats → Resum**. Confirm: the matrix header shows an "Incloure companies" checkbox; toggling it on reveals a second "Companies" matrix below (Cerca / Participada / Altres columns); refresh preserves the toggle state.

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.jsx src/components/tabs/ResumTab.jsx src/utils/storage.js
git commit -m "feat: companies cohort section + shared toggle on Mercats Privats Resum"
```

---

### Task 6: Wire the fund-table surface (FundsIndex filter + toggle)

**Files:**
- Modify: `src/components/FundsIndex.jsx`
- Modify: `src/components/Dashboard.jsx`

**Interfaces:**
- Consumes: `IncludeCompaniesToggle` (Task 3); `includeCompanies`/`setIncludeCompanies` shared flag (Task 5); `estSection` (existing import in FundsIndex).
- Produces: `FundsIndexInner({ ..., includeCompanies?: boolean, onToggleCompanies?: (checked:boolean)=>void })`. Props are only supplied for the Alternatives Portfoli usage.

- [ ] **Step 1: Accept the new props in FundsIndexInner**

In `src/components/FundsIndex.jsx`, add the import:

```js
import { IncludeCompaniesToggle } from "./funds/IncludeCompaniesToggle.jsx";
```

Update the signature from `export function FundsIndexInner({ inline = false, searchOverride, vcpeTypes, excludeIds }) {` to:

```js
export function FundsIndexInner({ inline = false, searchOverride, vcpeTypes, excludeIds, includeCompanies = false, onToggleCompanies }) {
```

- [ ] **Step 2: Relax the section filter (Option A: OFF = strict ALT-only)**

In `shouldIncludeRow` inside the `filtered` memo, replace the `vcpeTypes` branch. Current code:

```js
      if (Array.isArray(vcpeTypes) && vcpeTypes.length > 0) {
        const sectionId = getVehiclePermissionSection(row);
        if (vcpeTypes.includes("RE")) return sectionId === "real-estate" && canAccessRealEstate;
        return sectionId === "alternatives" && canAccessAlternatives && estSection(row.est) !== "SF";
      }
```

Replace with:

```js
      if (Array.isArray(vcpeTypes) && vcpeTypes.length > 0) {
        const sectionId = getVehiclePermissionSection(row);
        if (vcpeTypes.includes("RE")) return sectionId === "real-estate" && canAccessRealEstate;
        if (!(sectionId === "alternatives" && canAccessAlternatives)) return false;
        const sec = estSection(row.est);
        // OFF: strict vehicles-only (ALT). ON: vehicles + companies (SF + PC).
        return includeCompanies ? (sec === "ALT" || sec === "SF" || sec === "PC") : sec === "ALT";
      }
```

Add `includeCompanies` to the `filtered` memo dependency array (currently ends `..., vcpeTypes, filters]`):

```js
  }, [rows, search, canAccessAlternatives, canAccessRealEstate, vcpeTypes, filters, includeCompanies]);
```

- [ ] **Step 3: Render the toggle in the "Vehicles" header**

In `src/components/FundsIndex.jsx`, replace the section header line `<SectionHeader title="Vehicles" count={filtered.length} tc={tc} />` with:

```jsx
            <SectionHeader
              title="Vehicles"
              tc={tc}
              action={
                onToggleCompanies ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                    <IncludeCompaniesToggle checked={includeCompanies} onChange={onToggleCompanies} tc={tc} />
                    <span style={{ fontSize: 11, color: tc.textLight, fontWeight: 400 }}>{filtered.length}</span>
                  </div>
                ) : undefined
              }
              count={onToggleCompanies ? undefined : filtered.length}
            />
```

- [ ] **Step 4: Pass the shared flag from Dashboard's Portfoli usage**

In `src/components/Dashboard.jsx`, update the Portfoli `FundsIndexInner` render (the `inversionsSubTab === "fons"` branch) from:

```jsx
                  ? <FundsIndexInner searchOverride={globalSearch} vcpeTypes={["PE", "VC"]} excludeIds={d.actualCompanyIds} />
```
to:
```jsx
                  ? <FundsIndexInner searchOverride={globalSearch} vcpeTypes={["PE", "VC"]} excludeIds={d.actualCompanyIds} includeCompanies={includeCompanies} onToggleCompanies={setIncludeCompanies} />
```

Leave the Real Estate `FundsIndexInner` (`vcpeTypes={["RE"]}`) untouched — no toggle there.

- [ ] **Step 5: Verify build and model tests**

Run: `npm run build && node --test --test-isolation=none test/altCohortModel.test.js`
Expected: build succeeds; 12 tests pass.

- [ ] **Step 6: Manual smoke check**

Run `npm run dev`. Go to **Inversions → Portfoli**. Confirm: the "Vehicles" header shows the "Incloure companies" checkbox and the row count; OFF shows only ALT vehicles (no Participada rows leaking in); ON adds Search Fund + Participada rows. Flip it on the Resum tab and confirm the Portfoli table reflects the same state (shared flag). Confirm the Real Estate funds table has NO toggle.

- [ ] **Step 7: Commit**

```bash
git add src/components/FundsIndex.jsx src/components/Dashboard.jsx
git commit -m "feat: companies toggle on Portfoli fund table (OFF = strict ALT-only)"
```

---

## Self-Review

**Spec coverage:**
- Section 1 (data model: `summarizeFundsBySection`, `COMPANY_STRATEGIES/LABELS`, `buildCompanyCohortMatrix`, `buildAltCohortMatrix` wrapper, dedup) → Tasks 1 & 2. ✅
- Section 2 (matrix UI: reusable `AltCohortMatrix`, ResumTab second section, toggle in header, Dashboard computes `companyMatrix`) → Tasks 4 & 5. ✅
- Section 3 (fund table: `includeCompanies` prop, OFF = strict ALT, ON = ALT+SF+PC, header toggle, alternatives-only) → Task 6. ✅
- Section 4 (shared `usePersistedState("ui_alt_include_companies", false)`, both surfaces) → Task 5 (state + Resum) & Task 6 (Portfoli). ✅
- Section 5 (tests: grouping, dedup, no-Compromís skip, ALT regression) → Task 2 (3 new tests) + Tasks 1/5/6 regression runs. ✅

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✅

**Type consistency:** `summarizeFundsBySection` returns `{ id, est, vintage, calls, dist, tvpi, flows }` (id added in Task 1) and `buildCompanyCohortMatrix` relies on `f.id` for the dedup — consistent. `IncludeCompaniesToggle` `onChange(checked)` matches `onToggleCompanies = setIncludeCompanies` (a `usePersistedState` setter accepts a value). `AltCohortMatrix` `action`/`title`/`strategyLabels` props consistent across Tasks 4/5. ✅

## Out of Scope

- Real Estate TVPI baseline for the 7 null-TVPI RE funds.
- DataLoader re-import.
- The untracked `scripts/turtle_import_*.sql` files.
