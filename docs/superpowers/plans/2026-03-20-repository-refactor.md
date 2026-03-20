# Repository Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce complexity and duplication across the codebase — split Dashboard.jsx, centralize constants, move parsers/mappers to utils, migrate localStorage state to `usePersistedState`, and standardize error handling.

**Architecture:** Pure structural refactor — no behavior or UI changes. Six self-contained tasks, each committed independently. The app must load and function correctly after every commit.

**Tech Stack:** React 18, Vite, Supabase, Recharts. No test framework — verification is manual via `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-03-20-repository-refactor-design.md`

---

## Task 1: Extract DataLoader into its own file

**Files:**
- Create: `src/components/DataLoader.jsx`
- Modify: `src/components/Dashboard.jsx`

The `DataLoader` function component currently lives at lines 27–314 of `Dashboard.jsx`. This task moves it verbatim to its own file.

- [ ] **Step 1: Create `src/components/DataLoader.jsx`**

The file needs its own imports (currently it relies on Dashboard's imports). Create with:

```jsx
import React, { useState, useRef } from "react";
import { useTheme } from "../theme.js";
import { parseCapitalCallsCSV, parsePipelineCSV } from "../utils.js";
```

Then copy the entire `DataLoader` function body from `Dashboard.jsx` lines 27–314 (from `function DataLoader({` through the closing `}` before `// ── Helpers localStorage`).

End the file with:
```jsx
export { DataLoader };
```

- [ ] **Step 2: Remove DataLoader from Dashboard.jsx and import it**

In `src/components/Dashboard.jsx`:

1. Delete lines 27–314 (the `DataLoader` function — everything from `// ── Data loader modal` through the closing `}` before `// ── Helpers localStorage`).
2. Add this import near the top with the other component imports:
```js
import { DataLoader } from "./DataLoader.jsx";
```

- [ ] **Step 3: Verify**

Run `npm run dev`. Open the app. Click the "Carregar" / data import button. The DataLoader modal should open normally. Import a CSV file and confirm data loads.

- [ ] **Step 4: Commit**

```bash
git add src/components/DataLoader.jsx src/components/Dashboard.jsx
git commit -m "refactor: extract DataLoader into its own file"
```

---

## Task 2: Centralize constants in config.js

**Files:**
- Modify: `src/config.js`
- Modify: `src/components/SearchersTab.jsx`
- Modify: `src/components/PortfolioCompaniesTab.jsx`
- Modify: `src/components/FundsIndex.jsx`
- Modify: `src/components/FundDetail.jsx`

- [ ] **Step 1: Add GEO_NAME and SEARCHER_STATUS_CFG to config.js**

In `src/config.js`, after the existing `CANAL_CFG` block (after line 33), add:

```js
export const GEO_NAME = {
  ES:"ESP", EN:"UK", IT:"ITA", DE:"DEU", FR:"FRA",
  PT:"POR", NL:"NED", US:"USA", CH:"CHE", SE:"SWE",
  MX:"MEX", PL:"POL", TR:"TUR",
};

export const SEARCHER_STATUS_CFG = {
  "Invertit en fase de cerca":     { bg:"#E8F8E8", color:"#1C6B1D" },
  "Invertit en fase d'adquisició": { bg:"#D6EAD6", color:"#1C5220" },
  "Descartat":                      { bg:"#FDECEA", color:"#B01F17" },
  "En anàlisi":                     { bg:"#FFF8E1", color:"#8A6400" },
  "Sobresuscrit":                   { bg:"#F0EEFA", color:"#5A3E9A" },
  "Pendent de formalitzar":         { bg:"#E6EDF3", color:"#2B5070" },
  "No tancat":                      { bg:"#F5F5F5", color:"#777"    },
};
```

- [ ] **Step 2: Update SearchersTab.jsx**

In `src/components/SearchersTab.jsx`:

1. Update the import from `../utils.js` to also import from config:
```js
import { GEO_NAME, SEARCHER_STATUS_CFG } from "../config.js";
```

2. Delete lines 14–29 (the local `GEO_NAME` and `STATUS_CFG` constants).

3. In the `StatusBadge` component (around line 31), replace `STATUS_CFG` with `SEARCHER_STATUS_CFG`:
```js
const cfg = SEARCHER_STATUS_CFG[s] || { bg:TC.border, color:TC.textMid };
```

- [ ] **Step 3: Update PortfolioCompaniesTab.jsx**

In `src/components/PortfolioCompaniesTab.jsx`:

1. Add import at top:
```js
import { GEO_NAME } from "../config.js";
```

2. Delete line 15 (the local `GEO_NAME` constant).

- [ ] **Step 4: Update FundsIndex.jsx — remove VCPE_CFG and EST_CFG**

In `src/components/FundsIndex.jsx`:

1. Update the import from `../config.js` to include `VCPE_CFG` and `EST_CFG`:
```js
import { RAW_CC as RAW_CC_DEFAULT, FUND_META as FUND_META_DEFAULT, VCPE_CFG, EST_CFG } from "../config.js";
```

2. Delete lines 11–20 (the local `VCPE_CFG` and `EST_CFG` constants).

- [ ] **Step 5: Update FundDetail.jsx — remove local CAT_CFG**

In `src/components/FundDetail.jsx`:

1. Update the import from `../config.js` to include `CAT_CFG`:
```js
import { RAW_CC as RAW_CC_DEFAULT, FUND_META as FUND_META_DEFAULT, CAT_CFG } from "../config.js";
```

2. Delete lines 11–17 (the local `CAT_CFG` constant).

- [ ] **Step 6: Verify**

Run `npm run dev`. Check: Dashboard loads, Funds tab shows VCPE/EST badges correctly, Fund detail page shows category badges on transactions, Searchers tab shows status badges correctly.

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/components/SearchersTab.jsx src/components/PortfolioCompaniesTab.jsx src/components/FundsIndex.jsx src/components/FundDetail.jsx
git commit -m "refactor: centralize GEO_NAME, SEARCHER_STATUS_CFG, VCPE_CFG, EST_CFG, CAT_CFG in config.js"
```

---

## Task 3: Move color helper functions to utils.js

**Files:**
- Modify: `src/utils.js`
- Modify: `src/components/PortfolioCompaniesTab.jsx`
- Modify: `src/components/SearchersTab.jsx`

- [ ] **Step 1: Add color helpers to utils.js**

In `src/utils.js`, after the `slugify` function at the end of the file, add:

```js
// ── TVPI colour helpers ────────────────────────────────────
export function tvpiColor(t) {
  if (t == null) return "#999";
  if (t < 1.0)  return "#C62828";
  if (t < 1.5)  return "#7A6000";
  return "#1C6B1D";
}
export function tvpiBg(t) {
  if (t == null) return "#F5F5F5";
  if (t < 1.0)  return "#FDECEA";
  if (t < 1.5)  return "#FFF8E1";
  return "#E8F8E8";
}

// ── Mesos cercant helpers ──────────────────────────────────
export function calcMesos(iso) {
  if (!iso) return 0;
  const today = new Date();
  const d = new Date(iso);
  return Math.max(0, (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth()));
}
export function mesosColor(m) {
  const pct = Math.min(m / 24, 1);
  const hue = Math.round((1 - pct) * 130);
  return `hsl(${hue},60%,38%)`;
}
export function mesosBg(m) {
  const pct = Math.min(m / 24, 1);
  const hue = Math.round((1 - pct) * 130);
  return `hsl(${hue},60%,94%)`;
}
```

- [ ] **Step 2: Update PortfolioCompaniesTab.jsx**

In `src/components/PortfolioCompaniesTab.jsx`:

1. Update the import from `../utils.js`:
```js
import { fmtM, slugify, tvpiColor, tvpiBg } from "../utils.js";
```

2. Delete the local `tvpiColor` and `tvpiBg` functions (lines 28–39).

- [ ] **Step 3: Update SearchersTab.jsx**

In `src/components/SearchersTab.jsx`:

1. Update the import from `../utils.js`:
```js
import { fmtM, calcMesos, mesosColor, mesosBg } from "../utils.js";
```

2. Delete: the module-level `const today = new Date()` (line 44), and the local `calcMesos`, `mesosColor`, `mesosBg` functions (lines 45–60).

- [ ] **Step 4: Verify**

Run `npm run dev`. Check: Portfolio Companies tab shows TVPI color badges correctly (red/yellow/green). Searchers tab shows months-active color correctly.

- [ ] **Step 5: Commit**

```bash
git add src/utils.js src/components/PortfolioCompaniesTab.jsx src/components/SearchersTab.jsx
git commit -m "refactor: move tvpiColor, tvpiBg, calcMesos, mesosColor, mesosBg to utils.js"
```

---

## Task 4: Move XLSX row mappers and parseSearchersCSV to utils.js

**Files:**
- Modify: `src/utils.js`
- Modify: `src/components/DataLoader.jsx`
- Modify: `src/components/SearchersTab.jsx`

The inline `.map(r => ({...}))` lambdas inside `DataLoader.jsx`'s `readXLSX` function get extracted as named export functions. `parseSearchersCSV` moves from `SearchersTab.jsx` to `utils.js`.

- [ ] **Step 1: Add named mapper functions to utils.js**

In `src/utils.js`, after the color helpers added in Task 3, add:

```js
// ── XLSX row mappers ───────────────────────────────────────
export function mapCapitalCallsRows(rows) {
  return rows.map(r => ({
    fons:   String(r["Fons"] ?? ""),
    tipus:  String(r["Tipus"] ?? ""),
    cat:    String(r["Categoria"] ?? ""),
    data:   String(r["Data"] ?? ""),
    mes:    Number(r["Mes"]),
    any:    Number(r["Any"]),
    fy:     String(r["FY"] ?? ""),
    vcpe:   String(r["VCPE"] ?? ""),
    est:    String(r["Estructura"] ?? ""),
    eur:    Number(r["Import (€)"]),
    divisa: String(r["Divisa"] ?? ""),
  }));
}

export function mapPipelineRows(rows) {
  return rows.map(r => ({
    id:        Number(r["ID"]),
    name:      String(r["Nom"] ?? ""),
    amount:    Number(r["Import"]) || 0,
    currency:  String(r["Divisa"] ?? "EUR"),
    geography: String(r["Geo"] ?? ""),
    strategy:  String(r["Estratègia"] ?? ""),
    sector:    String(r["Sector"] ?? ""),
    status:    String(r["Status"] ?? ""),
    canal:     String(r["Canal"] ?? ""),
    active:    String(r["Actiu"]) === "1",
  }));
}

export function mapCompanyRows(rows) {
  return rows.map(r => ({
    nom:           String(r["Nom"] ?? ""),
    tipus:         String(r["Tipus"] ?? ""),
    segment:       String(r["Segment"] ?? ""),
    entrepreneurs: String(r["Entrepreneurs"] ?? ""),
    origen:        String(r["Origen"] ?? ""),
    geo:           String(r["Geo"] ?? ""),
    ticket:        r["Ticket (€M)"] ? Number(r["Ticket (€M)"]) * 1e6 : 0,
    tvpi:          r["TVPI"] !== "" && r["TVPI"] != null ? Number(r["TVPI"]) : null,
    rev:           r["Ingressos (€M)"] ? Number(r["Ingressos (€M)"]) * 1e6 : null,
    ebitda:        r["EBITDA (€M)"] ? Number(r["EBITDA (€M)"]) * 1e6 : null,
    dataCompr:     String(r["Data Compromís"] ?? ""),
    mesosOperant:  r["Mesos Operant"] != null && r["Mesos Operant"] !== "" ? Number(r["Mesos Operant"]) : null,
  }));
}

export function mapSearcherRows(rows) {
  return rows.map(r => ({
    nom:             String(r["Nom"] ?? ""),
    statusScreening: String(r["Status"] ?? ""),
    formEntrada:     String(r["Forma Entrada"] ?? ""),
    geo:             String(r["Geo"] ?? ""),
    ticket:          r["Ticket (€M)"] ? Number(r["Ticket (€M)"]) * 1e6 : null,
    dataInici:       String(r["Data Inici"] ?? ""),
    modalitat:       String(r["Modalitat"] ?? ""),
  }));
}

export function mapFundMetaRows(rows) {
  return rows.map(r => ({
    fons: String(r["Fons"] ?? ""),
    tvpi: r["TVPI"] !== "" && r["TVPI"] != null ? Number(r["TVPI"]) : null,
  }));
}

export function mapKpiRows(rows) {
  const KPI_MAP = {
    "Ingressos (€M)":       "rev",
    "Ing. Pressupost (€M)": "revBudget",
    "EBITDA (€M)":          "ebitda",
    "EBITDA Pres. (€M)":    "ebitdaBudget",
    "Deute Net (€M)":       "dfn",
    "DFN Pres. (€M)":       "dfnBudget",
  };
  const byNom = new Map();
  rows.forEach(r => {
    const nom = String(r["Nom"] ?? "");
    const qMap = new Map();
    Object.entries(r).forEach(([col, val]) => {
      const sep = col.indexOf(" | ");
      if (sep === -1) return;
      const q = col.slice(0, sep);
      const metric = col.slice(sep + 3);
      const key = KPI_MAP[metric];
      if (!key) return;
      if (!qMap.has(q)) qMap.set(q, { q });
      const v = val !== "" && val != null ? Number(val) * 1e6 : null;
      qMap.get(q)[key] = v;
    });
    byNom.set(nom, [...qMap.values()].sort((a, b) => {
      const [, qa, ya] = a.q.match(/Q(\d) (\d+)/) || [, "0", "0"];
      const [, qb, yb] = b.q.match(/Q(\d) (\d+)/) || [, "0", "0"];
      return (+ya * 4 + +qa) - (+yb * 4 + +qb);
    }));
  });
  return byNom;
}

export function parseSearchersCSV(text) {
  const lines = text.trim().split("\n");
  const header = lines[0].split(",");
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    const obj = {};
    header.forEach((h, i) => { obj[h.trim()] = (cols[i] || "").trim().replace(/^"|"$/g, ""); });
    return obj;
  });
}
```

- [ ] **Step 2: Update DataLoader.jsx to use the new mappers**

In `src/components/DataLoader.jsx`:

1. Update the import from `../utils.js`:
```js
import { parseCapitalCallsCSV, parsePipelineCSV, mapCapitalCallsRows, mapPipelineRows, mapCompanyRows, mapSearcherRows, mapFundMetaRows, mapKpiRows } from "../utils.js";
```

2. In the `readXLSX` function, replace the six inline `.map(r => ({...}))` blocks with calls to the named functions:

Replace the `ccRows` block (was lines 53–68 in Dashboard.jsx):
```js
if (ccRows?.length) {
  onLoad("cc", mapCapitalCallsRows(ccRows));
  loaded++;
}
```

Replace the `plRows` block:
```js
if (plRows?.length) {
  onLoad("pl", mapPipelineRows(plRows));
  loaded++;
}
```

Replace the `coRows` block:
```js
if (coRows?.length) {
  onLoad("companies", mapCompanyRows(coRows));
  loaded++;
}
```

Replace the `srRows` block:
```js
if (srRows?.length) {
  onLoad("searchers", mapSearcherRows(srRows));
  loaded++;
}
```

Replace the `fmRows` block:
```js
if (fmRows?.length) {
  onLoad("fundMeta", mapFundMetaRows(fmRows));
  loaded++;
}
```

Replace the `kpiRows` block (the large KPI_MAP + byNom logic):
```js
if (kpiRows?.length) {
  onLoad("kpiTrimestral", mapKpiRows(kpiRows));
  loaded++;
}
```

- [ ] **Step 3: Update SearchersTab.jsx**

In `src/components/SearchersTab.jsx`:

1. Update the import from `../utils.js`:
```js
import { fmtM, calcMesos, mesosColor, mesosBg, parseSearchersCSV } from "../utils.js";
```

2. Delete the local `parseSearchersCSV` function (lines 79–88).

- [ ] **Step 4: Verify**

Run `npm run dev`. Click "Carregar dades" and upload an XLSX file with multiple sheets — confirm all tabs load correctly. Verify Searchers CSV import still works.

- [ ] **Step 5: Commit**

```bash
git add src/utils.js src/components/DataLoader.jsx src/components/SearchersTab.jsx
git commit -m "refactor: move XLSX row mappers and parseSearchersCSV to utils.js"
```

---

## Task 5: Migrate localStorage state to usePersistedState

**Files:**
- Modify: `src/components/SearchersTab.jsx`
- Modify: `src/components/PortfolioCompaniesTab.jsx`

`usePersistedState` is already implemented in `utils.js` (line 76). This task replaces the manual init + scattered `localStorage.setItem` calls in these two components. This also fixes a bug where mutations stored to localStorage but didn't trigger React re-renders.

- [ ] **Step 1: Update SearchersTab.jsx**

In `src/components/SearchersTab.jsx`:

1. Update the import from `../utils.js` to include `usePersistedState`:
```js
import { fmtM, calcMesos, mesosColor, mesosBg, parseSearchersCSV, usePersistedState } from "../utils.js";
```

2. Replace the manual state init (lines 97–100):
```js
// REMOVE this:
const [historicData, setHistoricData] = useState(() => {
  try { const s = localStorage.getItem("tc_allSearchers"); return s ? JSON.parse(s) : ALL_SEARCHERS; }
  catch { return ALL_SEARCHERS; }
});

// REPLACE with:
const [historicData, setHistoricData] = usePersistedState("tc_allSearchers", ALL_SEARCHERS);
```

3. Find every `localStorage.setItem("tc_allSearchers", JSON.stringify(...))` call in the file. There are four: around lines 231, 252, 280, 289. Each wraps a `setHistoricData` call or stands alone. Remove the `try { localStorage.setItem(...) } catch {}` wrapper — `setHistoricData` (now from `usePersistedState`) handles persistence automatically.

   Example pattern to find and fix:
   ```js
   // REMOVE these wrappers wherever they appear:
   try { localStorage.setItem("tc_allSearchers", JSON.stringify(updated)); } catch {}
   ```

4. Find `localStorage.removeItem("tc_allSearchers")` (around line 241). Replace with `setHistoricData(ALL_SEARCHERS)`.

- [ ] **Step 2: Update PortfolioCompaniesTab.jsx**

In `src/components/PortfolioCompaniesTab.jsx`:

1. Update the import from `../utils.js` to include `usePersistedState`:
```js
import { fmtM, slugify, tvpiColor, tvpiBg, usePersistedState } from "../utils.js";
```

2. Replace the manual state init (lines 67–70):
```js
// REMOVE this:
const [companies, setCompanies] = useState(() => {
  try { const s = localStorage.getItem("tc_portfolioCompanies"); return s ? JSON.parse(s) : PORTFOLIO_COMPANIES; }
  catch { return PORTFOLIO_COMPANIES; }
});

// REPLACE with:
const [companies, setCompanies] = usePersistedState("tc_portfolioCompanies", PORTFOLIO_COMPANIES);
```

3. Remove all `try { localStorage.setItem("tc_portfolioCompanies", JSON.stringify(...)) } catch {}` wrappers (around lines 82, 100, 127, 136). The `setCompanies` setter handles persistence.

4. Replace `localStorage.removeItem("tc_portfolioCompanies")` (line 92) with `setCompanies(PORTFOLIO_COMPANIES)`.

- [ ] **Step 3: Remove now-unused useState import in both files (if applicable)**

Check if `useState` is still used elsewhere in each file. If `usePersistedState` was the only `useState` call, remove `useState` from the React import line.

- [ ] **Step 4: Verify**

Run `npm run dev`. Edit a Searcher field — confirm the change persists after page refresh. Edit a Portfolio Company field — same. Verify the reset button ("reset" / `localStorage.removeItem`) reverts to defaults.

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchersTab.jsx src/components/PortfolioCompaniesTab.jsx
git commit -m "refactor: migrate SearchersTab and PortfolioCompaniesTab to usePersistedState"
```

---

## Task 6: Error handling verification sweep

**Files:**
- No code changes required — this task is a verification sweep

**Background:** `db.js` uses two return conventions:
- `{ error }` / `{ data, error }` — for deletes and upserts (`deleteCompany`, `deleteSearcher`, `deletePipelineDeal`, `upsertPipelineDeal`, etc.)
- Row or `null` — for inserts and `deleteFund` (`insertPipelineDeal`, `insertSearcher`, `insertCompany`, `deleteFund`)

Each component already uses the correct check for its respective convention. Changing these patterns would introduce regressions. The sweep confirms existing callers are correct.

- [ ] **Step 1: Verify PipelineFY26.jsx**

Open `src/components/PipelineFY26.jsx`. Confirm:
- `deletePipelineDeal` call uses `const { error } = await deletePipelineDeal(id)` ✓
- `upsertPipelineDeal` call uses `const { error } = await upsertPipelineDeal(...)` ✓
- `insertPipelineDeal` call uses `const inserted = await insertPipelineDeal(deal); if (!inserted)` ✓ (returns row or null)

No changes needed.

- [ ] **Step 2: Verify FundsIndex.jsx**

Open `src/components/FundsIndex.jsx`. Confirm:
- `upsertFundMeta` call uses `const { error } = await upsertFundMeta(...)` ✓
- `deleteFund` call uses `const err = await deleteFund(fons); if (err)` ✓ (deleteFund returns raw error or null, not `{ error }`)
- `insertFund` call uses `const row = await insertFund(...); if (!row)` ✓ (returns row or null)

No changes needed.

- [ ] **Step 3: Verify SearchersTab.jsx**

Open `src/components/SearchersTab.jsx`. Confirm:
- `upsertSearcher` call uses `const { error } = await upsertSearcher(...)` ✓
- `insertSearcher` call uses `const inserted = await insertSearcher(...); if (!inserted)` ✓ (returns row or null)
- `deleteSearcher` call uses `const { error } = await deleteSearcher(id)` ✓

No changes needed.

- [ ] **Step 4: Verify PortfolioCompaniesTab.jsx and CompanyDetail.jsx**

Confirm both use `const { error } = await upsertCompany(...)` / `deleteCompany(...)` with `if (error) toast(...)`. No changes needed.

- [ ] **Step 5: Commit verification note**

No files changed. No commit needed. Mark this task complete.

---

## Verification Checklist (after all tasks)

Run `npm run dev` and walk through:

- [ ] Dashboard loads with correct data
- [ ] Capital Calls tab: charts render, filters work
- [ ] Mensual tab: bar charts render
- [ ] Pipeline tab: deals visible, add/delete work
- [ ] Portfolio Companies tab: TVPI badges show correct colors, edit works, persists after refresh
- [ ] Searchers tab: status badges show correct colors, months-active gradient shows, edit works, persists after refresh
- [ ] Funds tab: VCPE/EST badges show correctly, TVPI edit works
- [ ] Fund detail page: category badges on transactions show correctly
- [ ] DataLoader modal: opens, accepts CSV and XLSX, data loads correctly
- [ ] Admin panel: loads without errors
