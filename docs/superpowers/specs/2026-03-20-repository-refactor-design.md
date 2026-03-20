# Repository Refactor Design

> **For agentic workers:** This is a structural refactor spec. No new features, no behavior changes. Every step must leave the app fully functional.

**Goal:** Reduce complexity and duplication in the Turtle Capital Dashboard codebase through five targeted improvements: splitting Dashboard.jsx, centralizing constants, moving parsers to utils, migrating to `usePersistedState`, and standardizing error handling.

**Non-goals:** TypeScript migration, CSS modules/Tailwind, global state management (Zustand/Redux), architectural rewrites.

---

## 1. Dashboard.jsx Split

### Problem
`Dashboard.jsx` (1333 lines) mixes three distinct responsibilities: data import (`DataLoader` modal defined inline at line 27), application state, and layout/tab routing.

### Solution
Move the `DataLoader` function component (currently lines 27–314 of Dashboard.jsx) into its own file `src/components/DataLoader.jsx`. Dashboard.jsx shrinks to state + layout only.

### New file: `src/components/DataLoader.jsx`
Exact lift of the `DataLoader` function from Dashboard.jsx. Owns:
- File picker (`<input type="file">`)
- XLSX sheet parsing + row mapping (calls map functions from utils.js — see Section 3)
- Save-to-DB calls
- Upload state (`loading`, `error`, `success` per key)

**Interface (unchanged from current usage):**
```jsx
<DataLoader
  onLoad={handleLoad}   // (key: string, rows: any[]) => void — called per data key
  onClose={() => setShowLoader(false)}
  dataInfo={dataInfo}
/>
```

`onLoad` is called once per key: `"cc"`, `"pl"`, `"companies"`, `"searchers"`, `"fundMeta"`, `"kpiTrimestral"`. Dashboard.jsx's `handleLoad` function (lines 473–510) handles the merge logic including the special `kpiTrimestral → quarters` transform — this stays in Dashboard.jsx, unchanged.

### Modified: `src/components/Dashboard.jsx`
After extraction, contains only:
- `handleLoad` merge logic
- State initialization (uses existing `usePersistedState` calls — no change)
- Header layout (theme toggle, FonsSelector, nav links, export button)
- Tab switcher (`activeTab` state + conditional render)
- `<DataLoader>` usage (import from `./DataLoader`)

Target: ~300 lines (down from 1333).

---

## 2. Constants Consolidation

### Problem
Color configs and lookup maps are defined in multiple files with diverging values.

### Duplicates to fix

| Constant | Currently in | Resolution |
|---|---|---|
| `GEO_NAME` | SearchersTab.jsx, PortfolioCompaniesTab.jsx | Add to config.js; remove local copies |
| `STATUS_CFG` (pipeline — 3 keys) | config.js ✓ | No change |
| `STATUS_CFG` (searcher — 7 keys) | SearchersTab.jsx only | **Rename to `SEARCHER_STATUS_CFG`**; move to config.js; update SearchersTab to import it |
| `CAT_CFG` | config.js (static values), FundDetail.jsx (hardcoded hex) | Align FundDetail to config.js definition; remove local copy |
| `CAT_CFG_LOCAL` | MensualTab.jsx (dark-mode conditional bg values) | **Leave in place** — uses `dark` boolean for backgrounds; cannot be replaced by config.js's static version |
| `VCPE_CFG` | config.js ✓, FundsIndex.jsx (duplicate) | Remove from FundsIndex; import from config |
| `EST_CFG` | config.js ✓, FundsIndex.jsx (duplicate) | Remove from FundsIndex; import from config |

### Color helpers to move to `utils.js`
Pure functions currently embedded in component files:

```js
// From PortfolioCompaniesTab.jsx → utils.js
export function tvpiColor(v) { ... }
export function tvpiBg(v) { ... }

// From SearchersTab.jsx → utils.js
export function calcMesos(start, end) { ... }
export function mesosColor(n) { ... }
export function mesosBg(n) { ... }
```

### Result
`config.js` is the single source of truth for lookup maps and color palettes. `utils.js` owns all pure color-computing functions. All components import from the canonical location.

---

## 3. XLSX Row Mappers to utils.js

### Problem
`parseCapitalCallsCSV` and `parsePipelineCSV` already live in `utils.js`. Inside `DataLoader` (Dashboard.jsx lines 27–200) there are additional XLSX sheet-to-row mapping functions that transform `XLSX.utils.sheet_to_json` output into the app's data shape. These are structurally similar to the existing utils parsers but currently embedded inline.

### Functions to extract

| Function | From | To | Notes |
|---|---|---|---|
| `parseSearchersCSV` | SearchersTab.jsx (line 79) | utils.js | CSV text → searcher rows |
| `mapCapitalCallsRows` | DataLoader in Dashboard.jsx | utils.js | XLSX rows → rawCC shape |
| `mapPipelineRows` | DataLoader in Dashboard.jsx | utils.js | XLSX rows → pipeline shape |
| `mapCompanyRows` | DataLoader in Dashboard.jsx | utils.js | XLSX rows → company shape |
| `mapSearcherRows` | DataLoader in Dashboard.jsx | utils.js | XLSX rows → searcher shape |
| `mapFundMetaRows` | DataLoader in Dashboard.jsx | utils.js | XLSX rows → fundMeta shape |
| `mapKpiRows` | DataLoader in Dashboard.jsx | utils.js | XLSX rows → kpi shape |

The CSV parsers parse raw text; the XLSX mappers transform pre-parsed row objects. They are named differently (`parseXxx` vs `mapXxxRows`) to reflect this distinction.

### Result
`utils.js` owns all parse/map logic. `DataLoader.jsx` calls `mapXxxRows(rows)` — no field mapping inline. `SearchersTab` calls `parseSearchersCSV` imported from utils.

---

## 4. `usePersistedState` Migration

### Status
`usePersistedState` is **already implemented** in `utils.js` (line 76) with `isSet` support for Set values. It is already used throughout Dashboard.jsx. The gap is that `SearchersTab.jsx` and `PortfolioCompaniesTab.jsx` still use raw `localStorage` read/write scattered across the component.

### Current problem in SearchersTab.jsx
- State initialized with raw `localStorage.getItem` inside `useState` initializer (line 98)
- Mutations call `localStorage.setItem` directly (lines 231, 252, 280, 289) but do NOT call a React `setState` — meaning the stored data updates but React state does not, relying on re-mounting to reflect changes

### Current problem in PortfolioCompaniesTab.jsx
- Same pattern: raw init at line 68, scattered `localStorage.setItem` on lines 82, 100, 127, 136 without a corresponding `setState`

### Fix
Replace the raw init + scattered setItem calls in both components with `usePersistedState`:

```js
// SearchersTab.jsx — replace lines 97-100
const [searchers, setSearchers] = usePersistedState("tc_allSearchers", ALL_SEARCHERS);
// Then replace every: localStorage.setItem("tc_allSearchers", JSON.stringify(x))
// With: setSearchers(x)

// PortfolioCompaniesTab.jsx — replace lines 67-70
const [companies, setCompanies] = usePersistedState("tc_portfolioCompanies", PORTFOLIO_COMPANIES);
// Then replace every: localStorage.setItem("tc_portfolioCompanies", JSON.stringify(x))
// With: setCompanies(x)
```

This also fixes the existing bug where mutations don't trigger re-renders.

### Affected files
`src/components/SearchersTab.jsx`, `src/components/PortfolioCompaniesTab.jsx`

---

## 5. Error Handling Consistency

### Problem
`db.js` consistently returns `{ data, error }` but components handle errors inconsistently — some check `if (error)`, some silently ignore, some show toasts only sometimes.

### Standard pattern (already used in most places, applied everywhere)
```js
const { error } = await upsertX(...);
if (error) {
  toast({ message: "Error desant els canvis.", type: "error" });
  return;
}
```

### Sweep scope
All components that call db mutation functions:
- `SearchersTab.jsx`
- `PortfolioCompaniesTab.jsx`
- `PipelineFY26.jsx`
- `FundsIndex.jsx`
- `CompanyDetail.jsx`
- `AdminUsers.jsx` (already consistent — verify only)
- `AdminData.jsx` (already consistent — verify only)

No new abstractions. No behavior changes for the happy path. Silent failures become visible toast errors.

---

## File Change Summary

| File | Change |
|---|---|
| `src/components/DataLoader.jsx` | **Create** — moved from Dashboard.jsx |
| `src/components/Dashboard.jsx` | **Modify** — shrink from 1333 → ~300 lines |
| `src/config.js` | **Modify** — add GEO_NAME; align CAT_CFG |
| `src/utils.js` | **Modify** — add color helpers, parseSearchersCSV, mapXxxRows functions |
| `src/components/SearchersTab.jsx` | **Modify** — remove local STATUS_CFG (renamed SEARCHER_STATUS_CFG in config), GEO_NAME, color helpers, parseSearchersCSV; use usePersistedState; error handling sweep |
| `src/components/PortfolioCompaniesTab.jsx` | **Modify** — remove GEO_NAME, color helpers; use usePersistedState; error handling sweep |
| `src/components/FundsIndex.jsx` | **Modify** — remove VCPE_CFG, EST_CFG duplicates; error handling sweep |
| `src/components/FundDetail.jsx` | **Modify** — remove local CAT_CFG; import from config |
| `src/components/MensualTab.jsx` | **No change** — CAT_CFG_LOCAL uses dark-mode conditional values; intentionally kept local |
| `src/components/PipelineFY26.jsx` | **Modify** — error handling sweep |
| `src/components/CompanyDetail.jsx` | **Modify** — error handling sweep |

---

## Constraints

- **No behavior changes.** Every refactor step must leave the app working identically.
- **One section at a time.** Each section is a self-contained commit. Do not combine.
- **Test manually after each section** by loading the dashboard and verifying tabs render correctly.
- **Do not touch** inline styles, routing, Supabase schema, or auth logic.
- **`usePersistedState` already exists** — do not rewrite it; migrate callers only.
