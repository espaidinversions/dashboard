# Investments Overhaul — Design Spec
**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Three related improvements to the investment pages:

1. **Investment index split** — `/investments` redirects to `/investments/funds` and `/investments/companies` as two separate pages, each with TVPI/DPI/RVPI columns and color-coded utilization.
2. **Fund detail updates** — J-curve chart changes from AreaChart to grouped BarChart; three new KPI cards (TVPI, DPI, RVPI) added using a new `FUND_META` data structure.
3. **Company quarterly KPIs** — `quarters` array added to each company in `PORTFOLIO_COMPANIES`; CompanyDetail replaces its placeholder chart with a real grouped BarChart (actual vs budget) for Rev / EBITDA / Net Debt per quarter, with auto-calculated LTM.

---

## 1. Routing + Navigation

### Route changes (`src/router.jsx`)

| Route | Component | Notes |
|---|---|---|
| `/investments` | `<Navigate to="/investments/funds" replace />` | Redirect — preserves existing links |
| `/investments/funds` | `FundsIndex` | New component |
| `/investments/companies` | `CompaniesIndex` | New component |
| `/fund/:id` | `FundDetail` | Unchanged route, modified component |
| `/company/:id` | `CompanyDetail` | Unchanged route, modified component |

### Shared nav header (used in FundsIndex + CompaniesIndex)

Both pages share a nav header with:
- `← Dashboard` link on the left
- Two tab-style links in the center: **Fons** (`/investments/funds`) and **Empreses** (`/investments/companies`)
- Active tab highlighted with `tc.green` border/color; inactive tab uses `tc.textLight`
- Search input on the right (each page has its own search state)

### Obsolete component

`src/components/InvestmentsIndex.jsx` is deleted. All links from Dashboard.jsx that pointed to `/investments` now resolve to `/investments/funds` via the redirect.

---

## 2. FUND_META Data Model

### Location: `src/config.js`

Add after `RAW_CC`:

```js
// Fund-level metadata (manual inputs — TVPI set by fund manager reports)
export const FUND_META = [
  { fons: "ACP Secondaries 4",    tvpi: null },
  { fons: "Aldea Ventures III",   tvpi: null },
  // ...one entry per unique fons value in RAW_CC
  // Set tvpi to a number (e.g. 1.23) when known
];
```

### Derived metrics

From `FUND_META.tvpi` (manual) + `RAW_CC` transactions:

| Metric | Formula |
|---|---|
| TVPI | `FUND_META.tvpi` (manual, null = `—`) |
| DPI | `sum(distributions) / sum(calls)` — 0 if no calls |
| RVPI | `TVPI − DPI` — null if TVPI is null |

Where:
- `distributions` = rows where `cat === "Distribució"` or `cat === "Retorn Capital"` (`Math.abs(eur)`)
- `calls` = rows where `cat === "Capital Call"` (`eur`)

### LocalStorage override

`FundsIndex` and `FundDetail` read `FUND_META` from `localStorage.getItem("tc_fundMeta")` if present (same pattern as `RAW_CC`), falling back to the static `FUND_META` export. This enables future editability without a code change.

---

## 3. Company Quarters Data Model

### Location: `src/data/searchers.js`

Add `quarters` array to each company in `PORTFOLIO_COMPANIES`. Field is optional — companies without it show the existing placeholder.

```js
{
  nom: "TTPack",
  // ...existing fields...
  quarters: [
    {
      q: "Q1 2023",
      rev: 1800000,        // actual revenue (native currency)
      ebitda: 210000,      // actual EBITDA (native currency)
      dfn: 1500000,        // actual net debt (native currency)
      revBudget: 1900000,  // budgeted revenue (null = omit budget bar)
      ebitdaBudget: 220000,
      dfnBudget: 1400000,
    },
    // ...ordered oldest → newest
  ]
}
```

### LTM calculation

`LTM = sum of last 4 quarters` for each metric. If fewer than 4 quarters exist, uses all available. Calculated at render time — no separate field.

### Currency convention

All quarter values (`rev`, `ebitda`, `dfn` and their budget variants) are in **company native currency**, matching the existing `rev`/`ebitda`/`dfn` fields.

### Budget bars

If `revBudget` / `ebitdaBudget` / `dfnBudget` is `null` for a quarter, the budget bar for that quarter is omitted. No error or placeholder shown.

---

## 4. FundsIndex Page (`/investments/funds`)

### File: `src/components/FundsIndex.jsx`

### Data sources
- `rawCC` — from `localStorage.getItem("tc_rawCC")` with `RAW_CC_DEFAULT` fallback
- `fundMeta` — from `localStorage.getItem("tc_fundMeta")` with `FUND_META` fallback

### Table columns

| Column | Data | Align | Sort |
|---|---|---|---|
| Nom | `fons` — links to `/fund/:slug` | Left | Alpha |
| Tipus | `vcpe` badge (`PE`/`VC`/`RE`) + `est` badge | Left | Alpha on vcpe |
| Compromís | sum(`cat === "Compromís"`) via `fmtM` | Right | Numeric |
| Cridat | sum(`cat === "Capital Call"`) via `fmtM` | Right | Numeric |
| Utilizat % | calls/commitment × 100 | Right | Numeric |
| TVPI | from `FUND_META` | Right | Numeric |
| DPI | distributions/calls | Right | Numeric |
| RVPI | TVPI − DPI | Right | Numeric |

### Color coding

**Utilizat %:**
- < 50%: `#E53E3E` (red)
- 50–80%: `#D69E2E` (amber)
- > 80%: `tc.green`
- null: `tc.textLight`

**TVPI / DPI / RVPI:**
- < 1×: `#E53E3E`
- 1–1.5×: `#D69E2E`
- > 1.5×: `tc.green`
- null: `tc.textLight` (renders `—`)

### Default sort: Compromís descending. Search filter on fund name. All columns sortable.

### ThemeContext

Outer wrapper: `useState(() => localStorage.getItem("tc_dark") === "1")`, passes `{ tc, dark, toggle }` to `ThemeContext.Provider`.

---

## 5. CompaniesIndex Page (`/investments/companies`)

### File: `src/components/CompaniesIndex.jsx`

### Data source
- `PORTFOLIO_COMPANIES` — static import from `src/data/searchers.js`

### Table columns

| Column | Data | Align | Sort |
|---|---|---|---|
| Nom | `nom` — links to `/company/:slug` | Left | Alpha |
| Tipus | `tipus` badge (`SF`/`PE`) + `segment` text | Left | Alpha on tipus |
| Ticket | `ticket` via `fmtM` | Right | Numeric |
| TVPI | `tvpi` — color-coded | Right | Numeric |
| DPI | `dpiEur / ticket` (number, 2 decimal places + ×) | Right | Numeric |
| RVPI | `rvpiEur / ticket` (number, 2 decimal places + ×) | Right | Numeric |

**Note on DPI denominator:** Funds use `calls` (capital deployed) as DPI denominator; companies use `ticket` (invested capital). This asymmetry is intentional — `ticket` equals invested capital for direct company investments.

### Color coding

TVPI / DPI / RVPI: same thresholds as FundsIndex.

### Default sort: Ticket descending. Search filter on company name. All columns sortable.

### ThemeContext

Same outer wrapper pattern as FundsIndex.

---

## 6. FundDetail Updates

### File: `src/components/FundDetail.jsx`

### New KPI cards

Add three cards after the existing four (Compromís, Capital Cridat, Distribucions, Net):

5. **TVPI** — `FUND_META.tvpi ?? "—"`, color-coded
6. **DPI** — `distributions / calls`, formatted as `×` multiple, color-coded
7. **RVPI** — `TVPI − DPI`, formatted as `×` multiple, color-coded

`fundMeta` loaded via same localStorage pattern (`tc_fundMeta` → `FUND_META` fallback), looked up by `slugify(r.fons) === id`.

### J-curve chart change

Replace `AreaChart` with `BarChart` from Recharts.

**Chart config:**
- Type: `BarChart` (grouped, not stacked)
- Two `Bar` components:
  - `cumCalls` — blue (`#2B4C7E`), label "Capital Cridat"
  - `cumDist` — green (`#276749`), label "Distribucions"
- X-axis: `dataKey="data"`, same tick style
- Y-axis: `tickFormatter={v => fmtM(v)}`, same width
- `CartesianGrid` and `Tooltip` unchanged
- `barCategoryGap="20%"`, `barGap={4}`
- Same empty state for no data

### Back navigation

Unchanged: `← Inversions` → `/investments` (resolves via redirect to `/investments/funds`).

---

## 7. CompanyDetail Quarterly Chart

### File: `src/components/CompanyDetail.jsx`

### Removed

The "Ingressos LTM" and "EBITDA LTM" operative metrics section (the two cards) is **removed**. LTM values are shown inline in the chart section instead.

### New chart section

Replaces the existing tabbed placeholder section entirely.

**Three tabs:** Ingressos | EBITDA | Deute Net

**Above the chart:** A single LTM value card showing:
- Label: `"Ingressos LTM"` / `"EBITDA LTM"` / `"Deute Net LTM"`
- Value: sum of last 4 quarters' actual, via `fmtM`
- If < 4 quarters: shows whatever is available with a sub-label `"(N trimestres)"` if N < 4

**Chart:** `BarChart` (grouped) with:
- Actual bar: solid color (Ingressos: `#276749` green, EBITDA: `#2B4C7E` blue, Deute Net: `#6B2E7E` purple)
- Budget bar: same color at 35% opacity, rendered only if budget field is non-null
- X-axis: `q` field (e.g. `"Q1 2023"`)
- Y-axis: `tickFormatter={v => fmtM(v)}`
- Tooltip: shows both actual and budget values (budget omitted if null)
- Legend: "Real" + "Pressupost" (only shown if any budget data exists)

**Empty state:** If `quarters` is missing or empty, show existing placeholder: `"Afegeix dades històriques per veure l'evolució"`

### Deute Net note

Net Debt (`dfn`) is currently shown in KPI cards section as not displayed. The existing KPI cards (Ticket, TVPI, RVPI, DPI, Mesos operant) are unchanged. Deute Net only appears in the quarterly chart tab.

---

## Files Created / Modified

| File | Action |
|---|---|
| `src/components/FundsIndex.jsx` | Create |
| `src/components/CompaniesIndex.jsx` | Create |
| `src/components/InvestmentsIndex.jsx` | Delete |
| `src/components/FundDetail.jsx` | Modify — add TVPI/DPI/RVPI cards, change J-curve to BarChart |
| `src/components/CompanyDetail.jsx` | Modify — remove LTM cards, add quarterly BarChart |
| `src/router.jsx` | Modify — add 2 new routes, redirect /investments |
| `src/config.js` | Modify — add FUND_META export |
| `src/data/searchers.js` | Modify — add quarters field to PORTFOLIO_COMPANIES entries |

---

## Out of Scope

- Editing FUND_META or quarters data from within the dashboard UI (future task)
- CSV/JSON upload for quarterly data (deferred to future task per design decision)
- Uploading FUND_META via the existing capital calls upload mechanism
- Pipeline fund detail pages
- Authentication / access control
