# Prospective Cash — Supabase Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `prospectiveCashData.js` forecast inputs with live reads/writes from the `prospective_cash_forecasts` Supabase table, removing localStorage persistence and all data redundancy.

**Architecture:** Apply the existing migration to create and seed the DB table, then add two pure transformer functions (`forecastRowsToEditorData`, `editorDataToForecastRows`) in `prospectiveCashModel.js`, two Supabase functions (`fetchProspectiveCashForecasts`, `saveProspectiveCashForecasts`) in `db.js`, and wire `ProspectiveCashTab.jsx` to fetch on mount and save via delete+insert. `prospectiveCashData.js` is deleted after all imports are removed.

**Tech Stack:** React (JSX), Supabase JS client (`@supabase/supabase-js`), Vitest (existing test suite in `test/`).

---

## Files Modified

| File | Action |
|------|---------|
| `src/db.js` | Add `fetchProspectiveCashForecasts`, `saveProspectiveCashForecasts` |
| `src/data/prospectiveCashModel.js` | Add transformers; inline USD list; remove old exports |
| `src/components/ProspectiveCashTab.jsx` | Wire fetch/save; remove localStorage; add loading/error/saving states |
| `src/data/prospectiveCashData.js` | **Deleted** |
| `supabase/schema.sql` | Append table definition |
| `test/prospectiveCashModel.test.js` | **Created** — tests for the two transformer functions |

---

## Task 1: Apply the migration to Supabase

**Files:** none (CLI/dashboard action)

> This seeds the `prospective_cash_forecasts` table and all `private_entities` for the funds. Must be done before any frontend wiring is testable.

- [ ] **Step 1: Push the migration**

Run:
```
npx supabase db push
```
Expected output: migration `20260513000000_prospective_cash_forecasts` applied successfully.

If `supabase` CLI is not installed or not linked, apply the SQL manually via the Supabase dashboard SQL editor by running the contents of `supabase/migrations/20260513000000_prospective_cash_forecasts.sql`.

- [ ] **Step 2: Verify the table exists and has rows**

In the Supabase dashboard → Table Editor → `prospective_cash_forecasts`. Confirm rows exist (the migration seeds ~1200+ rows from the seeded fund forecasts).

- [ ] **Step 3: Update `supabase/schema.sql`**

Append to the end of `supabase/schema.sql`:

```sql
-- prospective_cash_forecasts: fund manager forecast inputs per vehicle, flow type, and year.
CREATE TABLE IF NOT EXISTS prospective_cash_forecasts (
  vehicle_id TEXT NOT NULL REFERENCES private_entities(id) ON UPDATE CASCADE ON DELETE CASCADE,
  fons       TEXT NOT NULL,
  flow_type  TEXT NOT NULL CHECK (flow_type IN ('calls', 'dist')),
  year       INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  amount     NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (vehicle_id, flow_type, year)
);

ALTER TABLE prospective_cash_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY prospective_cash_forecasts_read_authenticated
  ON prospective_cash_forecasts FOR SELECT TO authenticated USING (true);

CREATE POLICY prospective_cash_forecasts_write_superuser
  ON prospective_cash_forecasts FOR ALL TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());

CREATE INDEX IF NOT EXISTS idx_prospective_cash_forecasts_fons ON prospective_cash_forecasts(fons);
CREATE INDEX IF NOT EXISTS idx_prospective_cash_forecasts_year ON prospective_cash_forecasts(year);
```

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "docs(schema): add prospective_cash_forecasts table definition"
```

---

## Task 2: Add Supabase functions to `db.js`

**Files:**
- Modify: `src/db.js` (append two exported functions after the existing `upsertPrivateEntitiesIfNew` block, around line 120)

### Context

Follow the same pattern as `fetchAllCapitalCallRows` (line 72): null-guard `supabase`, return `{data, error}`. For `saveProspectiveCashForecasts`, use delete+insert (full replace) so that zeroed-out years don't linger in the DB.

- [ ] **Step 1: Add `fetchProspectiveCashForecasts`**

Find `async function upsertPrivateEntitiesIfNew` in `src/db.js` and add the following two functions immediately after its closing `}`:

```js
export async function fetchProspectiveCashForecasts() {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from("prospective_cash_forecasts")
    .select("vehicle_id, fons, flow_type, year, amount")
    .order("fons")
    .order("flow_type")
    .order("year");
  return { data: data ?? [], error };
}

export async function saveProspectiveCashForecasts(rows, vehicleIdValues) {
  if (!supabase) return { error: null };
  const ids = [...new Set(vehicleIdValues)].filter(Boolean);
  if (ids.length) {
    const { error: deleteError } = await supabase
      .from("prospective_cash_forecasts")
      .delete()
      .in("vehicle_id", ids);
    if (deleteError) return { error: deleteError };
  }
  if (!rows.length) return { error: null };
  const { error } = await supabase
    .from("prospective_cash_forecasts")
    .insert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })));
  return { error };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/db.js
git commit -m "feat(db): fetchProspectiveCashForecasts + saveProspectiveCashForecasts"
```

---

## Task 3: Add transformer functions to `prospectiveCashModel.js` and remove old exports

**Files:**
- Modify: `src/data/prospectiveCashModel.js` (full rewrite — file is 109 lines)

### Context

`forecastRowsToEditorData` converts `{vehicle_id, fons, flow_type, year, amount}[]` (Supabase rows) into the `{editorData: {years, funds}, vehicleIds}` shape expected by `deriveProspectiveCashRows` and the editor. `years` is derived from the actual data range, extended 3 years forward.

`editorDataToForecastRows` is the inverse: converts `editorData.funds` back to DB rows for save. Zero-value entries are excluded (the `yearMapValue` helper in the tab already removes 0 keys, so this is just a safety guard).

Remove: `PROSPECTIVE_CASH_STORAGE_KEY`, `PROSPECTIVE_CASH_DEFAULT_EDITOR_DATA`, `cloneProspectiveCashEditorData`, `normalizeProspectiveCashEditorData`. The USD funds list moves inline.

- [ ] **Step 1: Replace the entire file**

Replace the full contents of `src/data/prospectiveCashModel.js` with:

```js
export const PROSPECTIVE_CASH_USD_FUNDS = new Set([
  "Adams Street GSF7", "Alder III", "Alpine IX", "Altamar MidMarket", "Ara III",
  "CS Climate Innovation Fund", "CS Seasons Global IV",
  "Chicago Pacific Founders Fund IV", "EBN Pre-IPO II", "EBN Pre-IPO III",
  "Frontenac XIII", "G Squared V", "Galdana Asia I", "Hg Mercury 4",
  "JPM Vintage 2018", "JPM Vintage 2020", "JPM Vintage 2022",
  "K6 Private Investors", "Lee Equity IV", "Magnum Capital IV",
  "Main Capital VIII", "Main Foundation II", "Main Foundation III",
  "Nautic XI", "Norvestor IX", "Norvestor Nova", "Novacap Tech VII",
  "Oakley Origin II", "Pictet Co-Inv IV", "Pictet Co-Inv V",
  "Pictet Monte Rosa V", "Pictet Monte Rosa VI", "Pictet Tech",
  "RCP XIX", "RCP XX", "Veritas IX",
]);

export function forecastRowsToEditorData(rows) {
  const funds = {};
  const vehicleIds = {};
  let minYear = Infinity;
  let maxYear = -Infinity;

  for (const row of rows) {
    const fund = String(row.fons);
    if (!funds[fund]) {
      funds[fund] = { model_calls: {}, model_dist: {} };
      vehicleIds[fund] = row.vehicle_id;
    }
    const year = Number(row.year);
    const amount = Number(row.amount) || 0;
    if (amount <= 0) continue;
    if (row.flow_type === "calls") {
      funds[fund].model_calls[year] = (funds[fund].model_calls[year] ?? 0) + amount;
    } else {
      funds[fund].model_dist[year] = (funds[fund].model_dist[year] ?? 0) + amount;
    }
    if (year < minYear) minYear = year;
    if (year > maxYear) maxYear = year;
  }

  const years =
    minYear === Infinity
      ? []
      : Array.from({ length: maxYear + 3 - minYear + 1 }, (_, i) => minYear + i);

  return { editorData: { years, funds }, vehicleIds };
}

export function editorDataToForecastRows(editorData, vehicleIds) {
  const rows = [];
  for (const [fons, data] of Object.entries(editorData.funds ?? {})) {
    const vehicle_id = vehicleIds[fons];
    if (!vehicle_id) continue;
    for (const [year, amount] of Object.entries(data.model_calls ?? {})) {
      if (Number(amount) > 0)
        rows.push({ vehicle_id, fons, flow_type: "calls", year: Number(year), amount: Number(amount) });
    }
    for (const [year, amount] of Object.entries(data.model_dist ?? {})) {
      if (Number(amount) > 0)
        rows.push({ vehicle_id, fons, flow_type: "dist", year: Number(year), amount: Number(amount) });
    }
  }
  return rows;
}

export function deriveProspectiveCashRows(editorData, actualCapitalCalls = []) {
  const normalized = editorData && typeof editorData === "object" ? editorData : { years: [], funds: {} };
  const byFundYearType = new Map();
  const committed = deriveCommittedFromCapitalCalls(actualCapitalCalls);
  const firstCall = {};
  const actuals = deriveActualsFromCapitalCalls(actualCapitalCalls);

  for (const [fund, fundData] of Object.entries(normalized.funds ?? {})) {
    if (!committed[fund]) committed[fund] = Number(fundData.committed) || 0;
    const years = new Set();
    ["model_calls", "model_dist"].forEach((key) => {
      Object.keys(fundData[key] ?? {}).forEach((year) => years.add(Number(year)));
    });
    [...years].sort((a, b) => a - b).forEach((year) => {
      const modelCalls = numberAtYear(fundData.model_calls, year);
      const modelDist = numberAtYear(fundData.model_dist, year);
      if (modelCalls) setProspectiveRow(byFundYearType, { fund, year, type: "calls", model: modelCalls, real: 0 });
      if (modelDist) setProspectiveRow(byFundYearType, { fund, year, type: "dist", model: modelDist, real: 0 });
    });
  }

  actuals.forEach((actual) => {
    const key = rowKey(actual);
    const current = byFundYearType.get(key) ?? { ...actual, model: 0, real: 0 };
    current.real += actual.real;
    byFundYearType.set(key, current);
    if (actual.type === "calls" && actual.real > 0 && (!firstCall[actual.fund] || actual.year < firstCall[actual.fund])) {
      firstCall[actual.fund] = actual.year;
    }
  });

  const rows = [...byFundYearType.values()]
    .filter((row) => row.model || row.real)
    .sort((a, b) => a.fund.localeCompare(b.fund) || a.year - b.year || a.type.localeCompare(b.type));

  return { rows, committed, firstCall, years: normalized.years ?? [] };
}

function numberAtYear(values, year) {
  if (!values) return 0;
  return Number(values[year] ?? values[String(year)] ?? 0) || 0;
}

function setProspectiveRow(map, row) {
  const key = rowKey(row);
  const current = map.get(key) ?? { ...row, model: 0, real: 0 };
  current.model += row.model;
  current.real += row.real;
  map.set(key, current);
}

function rowKey(row) {
  return `${row.fund} ${row.year} ${row.type}`;
}

function deriveActualsFromCapitalCalls(rows) {
  if (!Array.isArray(rows)) return [];
  const result = [];
  rows.forEach((row) => {
    const fund = String(row?.fons ?? "").trim();
    const year = Number(row?.any ?? row?.year ?? String(row?.data ?? "").slice(0, 4));
    if (!fund || !year) return;
    const category = String(row?.cat ?? "").trim();
    const amount = Number(row?.eur) || 0;
    if (category === "Capital Call") {
      result.push({ fund, year, type: "calls", model: 0, real: Math.abs(amount) });
    } else if (category === "Distribució" || category === "Retorn Capital") {
      result.push({ fund, year, type: "dist", model: 0, real: Math.abs(amount) });
    }
  });
  return result;
}

function deriveCommittedFromCapitalCalls(rows) {
  const committed = {};
  if (!Array.isArray(rows)) return committed;
  rows.forEach((row) => {
    const fund = String(row?.fons ?? "").trim();
    if (!fund || row?.cat !== "Compromís") return;
    committed[fund] = (committed[fund] ?? 0) + Math.abs(Number(row?.eur) || 0);
  });
  return committed;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/prospectiveCashModel.js
git commit -m "refactor(model): forecastRowsToEditorData + editorDataToForecastRows; inline USD list; remove localStorage exports"
```

---

## Task 4: Write and run tests for the two transformer functions

**Files:**
- Create: `test/prospectiveCashModel.test.js`

### Context

Both `forecastRowsToEditorData` and `editorDataToForecastRows` are pure functions — ideal for unit tests. Cover: round-trip (rows → editorData → rows), empty input, 0-amount filtering, year range derivation, vehicle_id tracking.

- [ ] **Step 1: Create the test file**

```js
// test/prospectiveCashModel.test.js
import { describe, it, expect } from "vitest";
import {
  forecastRowsToEditorData,
  editorDataToForecastRows,
} from "../src/data/prospectiveCashModel.js";

const ROWS = [
  { vehicle_id: "V001", fons: "Fund A", flow_type: "calls", year: 2024, amount: 100000 },
  { vehicle_id: "V001", fons: "Fund A", flow_type: "calls", year: 2025, amount: 200000 },
  { vehicle_id: "V001", fons: "Fund A", flow_type: "dist",  year: 2027, amount: 50000  },
  { vehicle_id: "V002", fons: "Fund B", flow_type: "calls", year: 2026, amount: 300000 },
  { vehicle_id: "V002", fons: "Fund B", flow_type: "dist",  year: 2028, amount: 0      }, // zero: skip
];

describe("forecastRowsToEditorData", () => {
  it("groups rows by fons into model_calls and model_dist", () => {
    const { editorData } = forecastRowsToEditorData(ROWS);
    expect(editorData.funds["Fund A"].model_calls[2024]).toBe(100000);
    expect(editorData.funds["Fund A"].model_calls[2025]).toBe(200000);
    expect(editorData.funds["Fund A"].model_dist[2027]).toBe(50000);
    expect(editorData.funds["Fund B"].model_calls[2026]).toBe(300000);
  });

  it("skips zero-amount rows", () => {
    const { editorData } = forecastRowsToEditorData(ROWS);
    expect(editorData.funds["Fund B"].model_dist[2028]).toBeUndefined();
  });

  it("tracks vehicleIds by fons", () => {
    const { vehicleIds } = forecastRowsToEditorData(ROWS);
    expect(vehicleIds["Fund A"]).toBe("V001");
    expect(vehicleIds["Fund B"]).toBe("V002");
  });

  it("derives years from min to max+3", () => {
    const { editorData } = forecastRowsToEditorData(ROWS);
    expect(editorData.years[0]).toBe(2024);           // min year in data
    expect(editorData.years.at(-1)).toBe(2026 + 3);   // max year + 3
    expect(editorData.years).toEqual([2024, 2025, 2026, 2027, 2028, 2029]);
  });

  it("returns empty editorData for empty input", () => {
    const { editorData, vehicleIds } = forecastRowsToEditorData([]);
    expect(editorData.years).toEqual([]);
    expect(editorData.funds).toEqual({});
    expect(vehicleIds).toEqual({});
  });
});

describe("editorDataToForecastRows", () => {
  it("converts editorData back to DB rows", () => {
    const { editorData, vehicleIds } = forecastRowsToEditorData(ROWS);
    const rows = editorDataToForecastRows(editorData, vehicleIds);
    expect(rows).toContainEqual({ vehicle_id: "V001", fons: "Fund A", flow_type: "calls", year: 2024, amount: 100000 });
    expect(rows).toContainEqual({ vehicle_id: "V001", fons: "Fund A", flow_type: "dist",  year: 2027, amount: 50000  });
    expect(rows).toContainEqual({ vehicle_id: "V002", fons: "Fund B", flow_type: "calls", year: 2026, amount: 300000 });
  });

  it("excludes funds with no vehicleId", () => {
    const editorData = {
      years: [2024],
      funds: { "Orphan Fund": { model_calls: { 2024: 99999 }, model_dist: {} } },
    };
    const rows = editorDataToForecastRows(editorData, {});
    expect(rows).toHaveLength(0);
  });

  it("is a round-trip (rows → editorData → rows produces same set)", () => {
    const nonZeroRows = ROWS.filter((r) => Number(r.amount) > 0);
    const { editorData, vehicleIds } = forecastRowsToEditorData(nonZeroRows);
    const backRows = editorDataToForecastRows(editorData, vehicleIds);
    // Same length and every source row appears in result
    expect(backRows).toHaveLength(nonZeroRows.length);
    for (const src of nonZeroRows) {
      expect(backRows).toContainEqual({
        vehicle_id: src.vehicle_id,
        fons: src.fons,
        flow_type: src.flow_type,
        year: src.year,
        amount: src.amount,
      });
    }
  });
});
```

- [ ] **Step 2: Run the tests**

```
npm test test/prospectiveCashModel.test.js
```

Expected: all 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/prospectiveCashModel.test.js
git commit -m "test(model): forecastRowsToEditorData + editorDataToForecastRows round-trip tests"
```

---

## Task 5: Wire `ProspectiveCashTab.jsx` to Supabase

**Files:**
- Modify: `src/components/ProspectiveCashTab.jsx`

### Context

Four areas change: (1) imports, (2) state + useEffect, (3) saveAndApply / resetDraft / updateFundValue callbacks, (4) render — add loading/error guards and a save-error banner. The `EditorPanel` sub-component also needs a `saving` prop so its "Aplica i desa" button can be disabled during the async save.

- [ ] **Step 1: Update imports (lines 1–13)**

Find and replace the existing import block at the top of `src/components/ProspectiveCashTab.jsx`:

```jsx
import React, { useCallback, useMemo, useState } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { useTheme } from "../theme.js";
import { readStoredJSON, writeStoredJSON } from "../utils.js";
import {
  PROSPECTIVE_CASH_DEFAULT_EDITOR_DATA,
  PROSPECTIVE_CASH_STORAGE_KEY,
  PROSPECTIVE_CASH_USD_FUNDS,
  cloneProspectiveCashEditorData,
  deriveProspectiveCashRows,
  normalizeProspectiveCashEditorData,
} from "../data/prospectiveCashModel.js";
```

Replace with:

```jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { useTheme } from "../theme.js";
import { fetchProspectiveCashForecasts, saveProspectiveCashForecasts } from "../db.js";
import {
  PROSPECTIVE_CASH_USD_FUNDS,
  deriveProspectiveCashRows,
  editorDataToForecastRows,
  forecastRowsToEditorData,
} from "../data/prospectiveCashModel.js";
```

- [ ] **Step 2: Replace state initialisation block (lines ~80–96)**

Find:
```jsx
  const initialEditorData = useMemo(
    () => normalizeProspectiveCashEditorData(readStoredJSON(PROSPECTIVE_CASH_STORAGE_KEY, PROSPECTIVE_CASH_DEFAULT_EDITOR_DATA)),
    [],
  );
  const [editorData, setEditorData] = useState(initialEditorData);
  const cashData = useMemo(() => deriveProspectiveCashRows(editorData, rawCapitalCalls), [editorData, rawCapitalCalls]);
  const [view, setView] = useState("dashboard");
  const [mode, setMode] = useState("calls");
  const [tableType, setTableType] = useState("calls");
  const [fund, setFund] = useState("all");
  const [periods, setPeriods] = useState({ closed: true, current: true, fwd: true });
  const [yearFilters, setYearFilters] = useState(new Set());
  const [vintageFilter, setVintageFilter] = useState(null);
  const [sort, setSort] = useState({ key: "devAbs", dir: "desc" });
  const [editorType, setEditorType] = useState("calls");
  const [editorSearch, setEditorSearch] = useState("");
  const [dirty, setDirty] = useState(false);
```

Replace with:

```jsx
  const [editorData, setEditorData] = useState({ years: [], funds: {} });
  const [vehicleIds, setVehicleIds] = useState({});
  const fetchedRef = useRef({ years: [], funds: {} });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const cashData = useMemo(() => deriveProspectiveCashRows(editorData, rawCapitalCalls), [editorData, rawCapitalCalls]);
  const [view, setView] = useState("dashboard");
  const [mode, setMode] = useState("calls");
  const [tableType, setTableType] = useState("calls");
  const [fund, setFund] = useState("all");
  const [periods, setPeriods] = useState({ closed: true, current: true, fwd: true });
  const [yearFilters, setYearFilters] = useState(new Set());
  const [vintageFilter, setVintageFilter] = useState(null);
  const [sort, setSort] = useState({ key: "devAbs", dir: "desc" });
  const [editorType, setEditorType] = useState("calls");
  const [editorSearch, setEditorSearch] = useState("");
  const [dirty, setDirty] = useState(false);
```

- [ ] **Step 3: Add useEffect for fetch (insert after state declarations, before first useMemo)**

After the `const [dirty, setDirty] = useState(false);` line and before `const fundOptions = useMemo(...)`, insert:

```jsx
  useEffect(() => {
    let cancelled = false;
    fetchProspectiveCashForecasts().then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setFetchError(error.message); setLoading(false); return; }
      const { editorData: derived, vehicleIds: ids } = forecastRowsToEditorData(data);
      fetchedRef.current = derived;
      setEditorData(derived);
      setVehicleIds(ids);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);
```

- [ ] **Step 4: Replace `saveAndApply` (lines ~192–198)**

Find:
```jsx
  const saveAndApply = useCallback(() => {
    const normalized = normalizeProspectiveCashEditorData(editorData);
    writeStoredJSON(PROSPECTIVE_CASH_STORAGE_KEY, normalized);
    setEditorData(normalized);
    setDirty(false);
    setView("dashboard");
  }, [editorData]);
```

Replace with:

```jsx
  const saveAndApply = useCallback(async () => {
    setSaving(true);
    const rows = editorDataToForecastRows(editorData, vehicleIds);
    const { error } = await saveProspectiveCashForecasts(rows, Object.values(vehicleIds));
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    fetchedRef.current = editorData;
    setSaveError(null);
    setDirty(false);
    setView("dashboard");
  }, [editorData, vehicleIds]);
```

- [ ] **Step 5: Replace `resetDraft` (lines ~200–204)**

Find:
```jsx
  const resetDraft = useCallback(() => {
    const base = cloneProspectiveCashEditorData();
    setEditorData(base);
    setDirty(true);
  }, []);
```

Replace with:

```jsx
  const resetDraft = useCallback(() => {
    setEditorData(fetchedRef.current);
    setDirty(false);
  }, []);
```

- [ ] **Step 6: Replace `updateFundValue` (lines ~206–213)**

Find:
```jsx
  const updateFundValue = useCallback((fundName, updater) => {
    setEditorData((current) => {
      const next = cloneProspectiveCashEditorData(current);
      next.funds[fundName] = updater({ ...next.funds[fundName] });
      return next;
    });
    setDirty(true);
  }, []);
```

Replace with:

```jsx
  const updateFundValue = useCallback((fundName, updater) => {
    setEditorData((current) => ({
      ...current,
      funds: { ...current.funds, [fundName]: updater({ ...current.funds[fundName] }) },
    }));
    setDirty(true);
  }, []);
```

- [ ] **Step 7: Add loading/error guards before the return statement**

Find the `return (` line that starts the component's JSX output. Insert immediately before it:

```jsx
  if (loading) return (
    <div className="tab-panel" style={{ padding: 32, color: tc.textLight, fontSize: 14 }}>
      Carregant previsions...
    </div>
  );
  if (fetchError) return (
    <div className="tab-panel" style={{ padding: 32, color: "#c00", fontSize: 14 }}>
      Error carregant previsions: {fetchError}
    </div>
  );
```

- [ ] **Step 8: Update the dirty save button and add save-error banner (lines ~253–257)**

Find:
```jsx
          {dirty && (
            <button onClick={saveAndApply} style={buttonStyle(tc, dirty)}>
              Aplica i desa
            </button>
          )}
```

Replace with:

```jsx
          {dirty && (
            <button onClick={saveAndApply} disabled={saving} style={buttonStyle(tc, dirty && !saving)}>
              {saving ? "Desant..." : "Aplica i desa"}
            </button>
          )}
          {saveError && (
            <div style={{ color: "#c00", fontSize: 12, alignSelf: "center" }}>{saveError}</div>
          )}
```

- [ ] **Step 9: Pass `saving` to `EditorPanel`**

Find the `EditorPanel` call site (it receives `saveAndApply`, `dirty`, `resetDraft`, etc.). Add `saving={saving}` to its props.

Then find the `EditorPanel` function signature at the bottom of the file:
```jsx
function EditorPanel({ tc, editorData, committedByFund, paidInByFund, fundNames, editorType, setEditorType, editorSearch, setEditorSearch, updateFundValue, saveAndApply, exportEditorCsv, resetDraft, dirty }) {
```

Add `saving` to the destructured props:
```jsx
function EditorPanel({ tc, editorData, committedByFund, paidInByFund, fundNames, editorType, setEditorType, editorSearch, setEditorSearch, updateFundValue, saveAndApply, exportEditorCsv, resetDraft, dirty, saving }) {
```

Find the EditorPanel's save button (line ~811):
```jsx
        <button onClick={saveAndApply} style={buttonStyle(tc, dirty)}>Aplica i desa</button>
```

Replace with:
```jsx
        <button onClick={saveAndApply} disabled={saving} style={buttonStyle(tc, dirty && !saving)}>
          {saving ? "Desant..." : "Aplica i desa"}
        </button>
```

- [ ] **Step 10: Verify in browser**

Start dev server (`npm run dev`). Navigate to "Model Caixa" tab:
1. Tab should show "Carregant previsions..." briefly, then render the dashboard.
2. Charts and fund table should populate from Supabase data.
3. Navigate to Editor view — fund list should appear.
4. Change a value → "Aplica i desa" button appears → click it → button shows "Desant..." → returns to Dashboard view.
5. Check `prospective_cash_forecasts` in Supabase to confirm the new amounts are there.
6. Refresh the page — edited values should persist.

- [ ] **Step 11: Commit**

```bash
git add src/components/ProspectiveCashTab.jsx
git commit -m "feat(tab): wire ProspectiveCashTab to Supabase fetch/save; remove localStorage"
```

---

## Task 6: Delete `prospectiveCashData.js`

**Files:**
- Delete: `src/data/prospectiveCashData.js`

### Context

Nothing imports this file after Tasks 3 and 5 are complete. Deleting it removes the only remaining data redundancy.

- [ ] **Step 1: Verify no remaining imports**

Run:
```
npx grep -r "prospectiveCashData" src/
```

Expected: no output (zero matches).

- [ ] **Step 2: Delete the file**

```bash
git rm src/data/prospectiveCashData.js
```

- [ ] **Step 3: Run the full test suite**

```
npm test
```

Expected: all tests pass (the prospectiveCashModel tests from Task 4 pass; no test imports `prospectiveCashData.js`).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete prospectiveCashData.js — DB is now source of truth"
```
