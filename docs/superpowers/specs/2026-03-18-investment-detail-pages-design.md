# Investment Detail Pages — Design Spec
**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Add individual detail pages for each investment in the Turtle Capital Dashboard, covering both capital call funds and portfolio companies. Users can navigate to detail pages from existing tables and from a new unified investments index.

---

## Routing Structure

Add React Router v6 (`react-router-dom`) to the existing React 18.3 + Vite stack.

| Route | Component | Description |
|---|---|---|
| `/` | `Dashboard` | Existing dashboard, unchanged |
| `/investments` | `InvestmentsIndex` | Unified sortable table of all funds + companies |
| `/fund/:id` | `FundDetail` | Fund detail page with J-curve and transaction log |
| `/company/:id` | `CompanyDetail` | Company detail page with KPI cards and chart placeholder |

**Entry points:**
- "Per Fons" table rows → `<Link>` to `/fund/:id`
- Portfolio Companies table rows → `<Link>` to `/company/:id`
- New nav link in Dashboard header → `/investments`
- `/investments` table rows → `/fund/:id` or `/company/:id`

**ID generation:** slugify fund/company name (lowercase, spaces→hyphens, strip accents).

---

## New Files

- `src/components/InvestmentsIndex.jsx`
- `src/components/FundDetail.jsx`
- `src/components/CompanyDetail.jsx`
- `src/router.jsx` — route definitions

---

## Modified Files

- `src/main.jsx` — wrap app in `<BrowserRouter>`
- `src/components/Dashboard.jsx` — add `<Link>` on "Per Fons" rows; add investments nav link
- `src/components/PortfolioCompaniesTab.jsx` — add `<Link>` on company rows
- `vite.config.js` — add `server.historyApiFallback: true` for SPA routing

---

## Investments Index Page (`/investments`)

A single unified sortable table mixing funds and companies.

**Columns:**
| Column | Funds | Companies |
|---|---|---|
| Nom | Fund name | Company name |
| Tipus | Fons PE / Fons VC / Fons RE | Empresa SF / Empresa PE |
| Compromís | Total commitment (EUR) | Ticket (EUR) |
| Utilitzat | Call utilization % | — |
| TVPI | — | TVPI × (color-coded) |

**Features:**
- Sortable by any column
- Text search filtering
- Rows link to respective detail pages
- Default sort: commitment/ticket descending

---

## Fund Detail Page (`/fund/:id`)

### KPI Cards (4)
1. **Compromís** — total commitment (EUR)
2. **Capital Cridat** — total calls + utilization % sub-label
3. **Distribucions** — total distributions + return of capital
4. **Net** — distributions minus calls (net cash position)

### J-Curve Chart
- X-axis: date (by transaction date)
- Two area series:
  - **Capital cridat acumulat** — running sum of capital calls (plotted negative or as cost)
  - **Distribucions acumulades** — running sum of distributions + returns
- Data source: filter `capital-calls.js` by fund name, sort by date, compute running totals
- Uses Recharts `AreaChart` (consistent with existing charts)

### Transaction Log
- Full list of transactions for this fund, sorted newest-first
- Columns: Data, Tipus, Import (EUR), Categoria
- Same badge styling as existing `TransaccionsTab`

---

## Company Detail Page (`/company/:id`)

### KPI Cards (5)
1. **Ticket** — investment amount (EUR)
2. **TVPI** — current multiple, color-coded (red <1×, yellow 1–1.5×, green >1.5×)
3. **RVPI** — residual value (EUR)
4. **DPI** — distributions paid in (EUR)
5. **Mesos operant** — months since acquisition

### Operative Metrics (2 cards)
- **Ingressos LTM** — revenue last twelve months (EUR), with EBITDA margin % if both present
- **EBITDA LTM** — EBITDA last twelve months (EUR)
- Both shown as `—` if null in data

### KPI Evolution Chart (placeholder)
- Tabbed: TVPI / Ingressos / EBITDA
- Displays a clear empty state: *"Afegeix dades històriques per veure l'evolució"*
- No dummy/fake data — placeholder only
- Will be wired to historical time-series data in a future iteration

### Entry Info Section
- Entry date (`dataCompr`)
- Entry multiple (`multEntry`) if available
- Origin (`origen`)
- Entrepreneur(s) (`entrepreneurs`)
- Geography flag + country code

---

## Data Notes

**Fund ID generation:**
```js
const slugify = (name) =>
  name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
```

**Fund data source:** `src/data/capital-calls.js` — group transactions by `fons`, compute KPIs inline in `FundDetail.jsx`.

**Company data source:** `src/data/searchers.js` — `portfolioCompanies` array, find by slugified `nom`.

**Historical data:** Not yet available for companies. The evolution chart renders a placeholder. A future task will extend `portfolioCompanies` entries with a `history: []` array of `{ date, tvpi, rev, ebitda }` snapshots.

---

## Design Consistency

- Match existing light/dark theme (`TC_LIGHT` / `TC_DARK` from `src/theme.js`)
- Use existing `fmt`, `fmtEUR` helpers from `src/utils.js`
- Use existing badge styling from `SharedComponents.jsx`
- Use Recharts for all charts (already a dependency)
- Back navigation: `← Inversions` link in page header

---

## Out of Scope

- Editing fund/company data from detail pages
- Historical time-series data entry UI (future task)
- Pipeline fund detail pages (pipeline funds have no transaction history)
- Authentication / access control
