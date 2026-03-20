# Repository Refactor Design

> **For agentic workers:** This is a structural refactor spec. No new features, no behavior changes. Every step must leave the app fully functional.

**Goal:** Reduce complexity and duplication in the Turtle Capital Dashboard codebase through five targeted improvements: splitting Dashboard.jsx, centralizing constants, moving CSV parsers to utils, extracting a `usePersistedState` hook, and standardizing error handling.

**Non-goals:** TypeScript migration, CSS modules/Tailwind, global state management (Zustand/Redux), architectural rewrites.

---

## 1. Dashboard.jsx Split

### Problem
`Dashboard.jsx` (1333 lines) mixes three distinct responsibilities: data import (DataLoader modal), application state, and layout/tab routing.

### Solution
Extract `DataLoader` into its own component. Dashboard becomes state + layout only.

### New file: `src/components/DataLoader.jsx`
Owns all import-modal logic currently in Dashboard.jsx:
- File picker (`<input type="file">`)
- XLSX parsing (calls parse functions from utils.js)
- Save-to-DB calls
- Upload state (`loading`, `error`, `success`)

**Interface:**
```jsx
<DataLoader
  onImported={{ rawCC, fundMeta, companies, searchers }}
  open={showLoader}
  onClose={() => setShowLoader(false)}
/>
```

`onImported` receives the parsed+saved data objects so Dashboard can update its state.

### Modified: `src/components/Dashboard.jsx`
After extraction, Dashboard.jsx contains only:
- State initialization (via `usePersistedState` — see Section 4)
- Header layout (theme toggle, FonsSelector, nav links, export button)
- Tab switcher (`activeTab` state + conditional render)
- DataLoader integration

Target: ~300 lines.

---

## 2. Constants Consolidation

### Problem
Color configs and lookup maps are defined in multiple files with diverging values.

### Duplicates to fix

| Constant | Currently in | Resolution |
|---|---|---|
| `GEO_NAME` | SearchersTab.jsx, PortfolioCompaniesTab.jsx | Move to config.js |
| `STATUS_CFG` | config.js ✓, SearchersTab.jsx (duplicate) | Remove from SearchersTab |
| `CAT_CFG` | config.js (uses theme colors) + FundDetail.jsx (hardcoded hex) | Align to config.js definition; remove from FundDetail |
| `VCPE_CFG` | config.js ✓, FundsIndex.jsx (duplicate) | Remove from FundsIndex |
| `EST_CFG` | config.js ✓, FundsIndex.jsx (duplicate) | Remove from FundsIndex |

### Color helpers to extract into `utils.js`
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
`config.js` is the single source of truth for lookup maps and color palettes. `utils.js` owns all pure color-computing functions. All components import from the correct canonical location.

---

## 3. CSV Parsers to utils.js

### Problem
`parseCapitalCallsCSV` and `parsePipelineCSV` already live in `utils.js`. Two parsers are still embedded in components.

### Parsers to extract

| Parser | From | To |
|---|---|---|
| `parseSearchersCSV` | SearchersTab.jsx (inline) | utils.js |
| Company/fund import parsers | Dashboard.jsx DataLoader section | utils.js |

### Result
`utils.js` owns all CSV/XLSX parse logic. DataLoader.jsx calls `parseXxx(rawData)` — no parsing inline. SearchersTab calls `parseSearchersCSV` imported from utils.

---

## 4. `usePersistedState` Hook

### Problem
The localStorage read/write pattern is repeated ~6 times:

```js
// Repeated in Dashboard.jsx, SearchersTab.jsx, PortfolioCompaniesTab.jsx, etc.
const [rawCC, setRawCC] = useState(() => {
  try {
    const s = localStorage.getItem("tc_rawCC");
    return s ? JSON.parse(s) : RAW_CC_DEFAULT;
  } catch { return RAW_CC_DEFAULT; }
});
// And separately on every update:
localStorage.setItem("tc_rawCC", JSON.stringify(updated));
```

### Solution
Add `usePersistedState` to `utils.js`:

```js
export function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : defaultValue;
    } catch { return defaultValue; }
  });
  const setPersisted = useCallback((value) => {
    setState(value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key]);
  return [state, setPersisted];
}
```

### Usage (replaces boilerplate everywhere)
```js
const [rawCC, setRawCC] = usePersistedState("tc_rawCC", RAW_CC_DEFAULT);
const [companies, setCompanies] = usePersistedState("tc_portfolioCompanies", []);
```

### Affected files
Dashboard.jsx, SearchersTab.jsx, PortfolioCompaniesTab.jsx, and any other component that manually reads/writes these four localStorage keys.

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
- SearchersTab.jsx
- PortfolioCompaniesTab.jsx
- PipelineFY26.jsx
- FundsIndex.jsx
- CompanyDetail.jsx
- AdminUsers.jsx (already consistent)
- AdminData.jsx (already consistent)

No new abstractions. No behavior changes for the happy path. Silent failures become visible errors.

---

## File Change Summary

| File | Change |
|---|---|
| `src/components/DataLoader.jsx` | **Create** — extracted from Dashboard.jsx |
| `src/components/Dashboard.jsx` | **Modify** — shrink from 1333 → ~300 lines |
| `src/config.js` | **Modify** — add GEO_NAME, align CAT_CFG |
| `src/utils.js` | **Modify** — add usePersistedState, color helpers, parseSearchersCSV, company parsers |
| `src/components/SearchersTab.jsx` | **Modify** — remove STATUS_CFG, GEO_NAME, color helpers, parseSearchersCSV; import from config/utils; use usePersistedState |
| `src/components/PortfolioCompaniesTab.jsx` | **Modify** — remove GEO_NAME, color helpers; use usePersistedState |
| `src/components/FundsIndex.jsx` | **Modify** — remove VCPE_CFG, EST_CFG duplicates |
| `src/components/FundDetail.jsx` | **Modify** — remove local CAT_CFG, import from config |
| `src/components/PipelineFY26.jsx` | **Modify** — error handling sweep |
| `src/components/CompanyDetail.jsx` | **Modify** — error handling sweep |

---

## Constraints

- **No behavior changes.** Every refactor step must leave the app working identically.
- **One section at a time.** Each section is a self-contained commit. Do not combine.
- **Test manually after each section** by loading the dashboard and verifying tabs render correctly.
- **Do not touch** inline styles, routing, Supabase schema, or auth logic.
