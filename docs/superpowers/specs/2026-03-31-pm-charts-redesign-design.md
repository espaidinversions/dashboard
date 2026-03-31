# PM Charts Redesign — Design Spec
**Date:** 2026-03-31
**Branch:** feat/pm-resum-txs-accordion-closed-positions
**Status:** Approved, pending implementation

---

## Overview

Six changes to the Public Markets tab:

1. New shared `CumulativeFlowsChart` component used in three places
2. Summary tab: 3-toggle cumulative inflows bar + portfolio value line
3. RV and RF tabs: replace top-12 chart with per-position cumulative inflows + portfolio value line
4. RV and RF tabs: merge active + discontinued vehicle tables into one sorted table
5. Transaction pages: remove links to vehicle detail pages
6. Coverage report: markdown file listing vehicles without price data

---

## 1. Shared Component — `CumulativeFlowsChart`

**File:** `src/components/CumulativeFlowsChart.jsx`
**Estimated size:** ~180 lines

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `transactions` | array | required | PM_TRANSACTIONS already filtered to scope |
| `valuesSeries` | array | required | `[{date, value}]` portfolio value time series |
| `groupBy` | string | `'total'` | `'total'` \| `'assetType'` \| `'manager'` \| `'position'` |
| `topN` | number | `5` | Top N positions to name; rest → "Altres" (only used when `groupBy='position'`) |
| `height` | number | `260` | Chart height in px |
| `showToggle` | bool | `false` | Render toggle buttons above chart (parent owns groupBy state) |

### Computation (all via `useMemo`)

**Step 1 — Month buckets from transactions:**
- Iterate `transactions` where `action === 'buy'`
- Group by month string (`YYYY-MM`)
- Accumulate running total per group key:
  - `total`: single key `"total"`
  - `assetType`: key = `tipus` (`"RV"` or `"RF"`)
  - `manager`: key = custodian-to-manager mapping (same routing as PublicMarketsTab `mvData`): Bankinter/Abel Font → `"abel"`, CaixaBank → `"caixa"`, UBS/Credit Suisse → `"ubs"`, Andbank → `"andbank"`
  - `position`: key = `isin`; after computing all ISINs, rank by total invested, keep top `topN` by name, merge remainder into `"Altres"`

**Step 2 — Merge with portfolio value:**
- Align `valuesSeries` to same month buckets (forward-fill missing months)
- Each data point: `{ month, ...groupAmounts, portfolioValue }`

**Step 3 — Color map:**
- `total`: `tc.navy`
- `assetType`: RV → `tc.green`, RF → `tc.navy`
- `manager`: use existing manager color palette from PublicMarketsTab
- `position`: top-5 get sequential colors from palette; `"Altres"` → `tc.border` (grey)

### Rendered Output

Recharts `ComposedChart`:
- `Bar` elements stacked when `groupBy !== 'total'`; single bar when `'total'`
- `Line` for `portfolioValue` on a right Y-axis (`yAxisId="right"`), dashed, `tc.green` or `tc.orange`
- Custom `Tooltip` showing month label, each group's cumulative amount (€), and portfolio value
- `Legend` at bottom when stacked

---

## 2. Summary Tab — New "Fluxos acumulats" Section

**File:** `src/components/PublicMarketsTab.jsx`

### Placement
New section titled **"Fluxos acumulats"** added below the existing portfolio evolution chart.

### Toggle
3-button toggle above chart (parent owns state, passed as `groupBy` to `CumulativeFlowsChart`):
- **Total** — single unstacked bar
- **Per Actiu** — stacked by RV/RF
- **Per Gestor** — stacked by manager (caixa, ubs, abel, andbank)

Default: `'total'`

### Data wiring
- `transactions`: all `PM_TRANSACTIONS`
- `valuesSeries`: derived from `PM_MONTHLY` — for each month entry, total = `caixaRV + caixaRF + ubsRV + ubsRF + (abelBK ?? 0) + andbank`

### What is removed
- The existing "Inflow Overlay" reference lines and area on the evolution chart are **removed** (replaced by this dedicated section)

---

## 3. RV Tab — Chart Replacement

**File:** `src/components/PMTipusTab.jsx`, when `tipus === 'RV'`

### Replaces
"Top 12 holdings price evolution" multi-line area chart

### New chart
```jsx
<CumulativeFlowsChart
  groupBy="position"
  topN={5}
  transactions={PM_TRANSACTIONS.filter(t => t.tipus === 'RV')}
  valuesSeries={rvMonthly}
  height={260}
/>
```

Where `rvMonthly` = `PM_MONTHLY` mapped to `{ date, value: caixaRV + ubsRV + rvShareOfAbel }`.

Note: Abel Font RV share is not broken out in PM_MONTHLY. Use `caixaRV + ubsRV` as the RF tab approximation and note the limitation in a code comment. Alternatively, sum PM_POSITIONS RV values for a point-in-time reference — use whichever is simpler.

### Stacking
Top 5 ISINs by cumulative invested amount, named in legend. Remaining ISINs → "Altres" (grey, `tc.border`).

---

## 4. RF Tab — Chart Replacement

Same pattern as RV tab, `tipus === 'RF'`, `valuesSeries` uses `caixaRF + ubsRF`.

---

## 5. Merged Vehicle Table (RV and RF tabs)

**File:** `src/components/PMTipusTab.jsx`

### Replaces
Current dual-section layout: "Posicions actives" table + "Posicions tancades" table

### New single table

**Data source:**
```js
const allVehicles = [
  ...PM_POSITIONS.filter(p => p.tipus === tipus).map(p => ({ ...p, status: 'active' })),
  ...PM_CLOSED.filter(p => p.tipus === tipus).map(p => ({ ...p, status: 'closed' })),
]
```

**Sort order:** Active positions sorted by `pes` descending → then closed positions sorted by `nom`

**Columns:**

| Column | Active rows | Closed rows |
|--------|-------------|-------------|
| Nom | Full name | Full name |
| ISIN | ISIN code | ISIN code |
| Pes (%) | `pes` value | `—` |
| Rend. Inici | `rendInici` | `—` |
| 2026 YTD | `rend2026` | `—` |
| 2025 | `rend2025` | `—` |
| 2024 | `rend2024` | `—` |
| Estat | Green badge `En cartera` | Grey badge `Discontinuat` |

Closed rows render return columns as `—` (no data available).

---

## 6. Remove Transaction Links

**Files:** `src/components/PMTransaccionsTab.jsx`, `src/components/PublicMarketsTab.jsx` (accordion section)

In both files, fund name cells and ISIN cells that currently render `<Link to="/mercats-publics/...">` are changed to plain `<span>`. No other changes.

---

## 7. Coverage Report

**File:** `docs/pm-coverage-report.md`

Content:
- Summary: 30 active ISINs, 3 without price data; 139 closed ISINs, 11 without price data
- Active positions missing data (with explanation):
  - `IE00B3ZW0K19` — iShares S&P 500 EUR Hedged (Acc) — purchased 2026-03-19, too new for Morningstar coverage
  - `LU1681043600` — Amundi MSCI World UCITS ETF — Morningstar coverage gap
  - `LU1834988519` — Amundi Stoxx Europe 600 Technology ETF — Morningstar coverage gap
- Closed positions missing data: list of 11 ISINs with names
- Fix path: add ISINs to the Python script's fetch list; re-run to populate `fund_prices_combined.csv`

---

## Implementation Order

1. `docs/pm-coverage-report.md` — no code, quick win
2. Remove transaction links (2 files, surgical change)
3. `CumulativeFlowsChart.jsx` — new component, no existing code touched
4. Wire into `PMTipusTab.jsx` — chart replacement + merged table
5. Wire into `PublicMarketsTab.jsx` — new section + remove old inflow overlay
6. Wire into `PMPositionDetail.jsx` — replace price evolution chart

---

## Files Touched

| File | Change |
|------|--------|
| `src/components/CumulativeFlowsChart.jsx` | **New file** |
| `src/components/PMTipusTab.jsx` | Chart replacement + merged table |
| `src/components/PublicMarketsTab.jsx` | New "Fluxos acumulats" section, remove inflow overlay |
| `src/components/PMPositionDetail.jsx` | Replace price evolution chart |
| `src/components/PMTransaccionsTab.jsx` | Remove fund name links |
| `docs/pm-coverage-report.md` | **New file** |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET
