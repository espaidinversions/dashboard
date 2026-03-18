# Investment Detail Pages — Design Spec
**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Add individual detail pages for each investment in the Turtle Capital Dashboard, covering both capital call funds and portfolio companies. Users can navigate to detail pages from existing tables and from a new unified investments index.

---

## Dependency

Add `react-router-dom` v6 before starting:
```bash
npm install react-router-dom
```

---

## Routing Structure

Use React Router v6 with `<BrowserRouter>` + `<Routes>` (not `createBrowserRouter` / `RouterProvider`).

`src/main.jsx` wraps the app in `<BrowserRouter>` and renders `<AppRoutes>`.
`src/router.jsx` exports `<AppRoutes>` with all route definitions.

| Route | Component |
|---|---|
| `/` | `Dashboard` (unchanged) |
| `/investments` | `InvestmentsIndex` |
| `/fund/:id` | `FundDetail` |
| `/company/:id` | `CompanyDetail` |

### Entry Points

- **"Per Fons" table** in `Dashboard.jsx`: rendered inside the `tab === "fons"` branch (around line 635). Each row currently has `onClick={() => toggleExpand(f.fons)}`. The fund name cell (`<td>`) becomes a `<Link to={/fund/${slugify(f.fons)}}>`  with `e.stopPropagation()` so row expansion is preserved. The row click still toggles the inline transaction sub-row.
- **Portfolio Companies rows** in `PortfolioCompaniesTab.jsx`: company name cell becomes `<Link to={/company/${slugify(c.nom)}>`.
- **Dashboard header**: add a nav link "Inversions" → `/investments`.
- **`/investments` rows**: each row is a `<Link>` to the respective detail page.

---

## Data Sharing Strategy

`Dashboard.jsx` loads `rawCC` from localStorage key `"tc_rawCC"` with a static fallback. Detail pages need the same data without prop-drilling.

**Solution:** each new page inlines the same localStorage read at module or `useMemo` level:
```js
import { RAW_CC as RAW_CC_DEFAULT } from '../config.js';
const rawCC = JSON.parse(localStorage.getItem("tc_rawCC") ?? 'null') ?? RAW_CC_DEFAULT;
```

`loadFromLS` is a private function inside `Dashboard.jsx` — do **not** import or re-export it. Inline the pattern above. No new context or state management needed.

`portfolioCompanies` is always the static import from `src/data/searchers.js` (it is not user-uploadable).

---

## ID / Slug Strategy

```js
// Add to src/utils.js
export const slugify = (str) =>
  String(str).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
```

- **Funds:** `slugify(fons)` — using the `fons` field from `capital-calls.js`
- **Companies:** `slugify(nom)` — using the `nom` field from `portfolioCompanies`
- **Collision check:** add a dev-only `console.warn` in `router.jsx` that logs if any two funds or companies produce the same slug. No runtime disambiguation needed — the dataset is small and collisions are very unlikely. If one occurs, rename the source data entry.

---

## New Files

- `src/components/InvestmentsIndex.jsx`
- `src/components/FundDetail.jsx`
- `src/components/CompanyDetail.jsx`
- `src/router.jsx`

---

## Modified Files

- `package.json` — add `react-router-dom`
- `src/main.jsx` — wrap in `<BrowserRouter>`, render `<AppRoutes>`
- `src/utils.js` — add `slugify` export
- `src/components/Dashboard.jsx` — add `<Link>` on fund name cells; add investments nav link
- `src/components/PortfolioCompaniesTab.jsx` — add `<Link>` on company name cells
- `vite.config.js` — Vite handles SPA fallback natively in dev; **no config change needed**
- `server.js` — SPA catch-all (`app.get("*", ...)`) **already exists** at line 187; no change needed

---

## Investments Index Page (`/investments`)

Unified sortable table of all funds + companies.

**Columns:**

| Column | Funds | Companies |
|---|---|---|
| Nom | `fons` field | `nom` field |
| Tipus | `vcpe` → `"Fons PE"` / `"Fons VC"` / `"Fons RE"` | `tipus` → `"Empresa SF"` / `"Empresa PE"` |
| Compromís | sum of rows where `cat === 'Compromís'` | `ticket` |
| Utilizat | calls / commitment % | `—` |
| TVPI | `—` | `tvpi` × (color-coded: red <1, yellow 1–1.5, green >1.5) |

Note: `est` (Fons Primari / Fons de Fons) is not shown in this table.

**Features:**
- Sortable by any column (click header)
- Text search filter on name
- Default sort: Compromís/ticket descending
- Each row is a `<Link>` to the detail page
- Empty search result: "Cap resultat" empty state

**Data source:** `rawCC` via `loadFromLS` for funds; `portfolioCompanies` static import for companies.

---

## Fund Detail Page (`/fund/:id`)

### Data Source
Filter `rawCC` (loaded via `loadFromLS`) by `slugify(r.fons) === id`.

### Edge Cases
- **Fund not found:** render "Fons no trobat" + `← Inversions` link. Do not crash.
- **No calls yet:** J-curve renders empty state: *"Encara no hi ha aportacions registrades."*

### KPI Cards (4)
1. **Compromís** — `sum(rows where cat === 'Compromís')`
2. **Capital Cridat** — `sum(rows where cat === 'Capital Call')` + utilization % sub-label
3. **Distribucions** — `sum(rows where cat === 'Distribució' || cat === 'Retorn Capital')`
4. **Net** — Distribucions − Capital Cridat

Use `fmtM()` from `src/utils.js`. Render `—` if zero.

### J-Curve Chart

**Inclusion rules:**
- Capital Cridat series: `cat === 'Capital Call'`
- Distribucions series: `cat === 'Distribució'` or `cat === 'Retorn Capital'`
- Excluded: `cat === 'Compromís'`, `cat === 'Altres'`

Sort included rows by `data` ascending, compute running sums for each series. Use Recharts `AreaChart`.

### Transaction Log
All transactions for this fund, sorted newest-first.
Columns: Data, Tipus, Import (EUR), Categoria.
Use `Badge` component from `SharedComponents.jsx` for Categoria badges.

### Back Navigation
`← Inversions` → `<Link to="/investments">`. **Do not use** `useNavigate(-1)` — users may arrive directly via URL, in which case there is no history to go back to.

---

## Company Detail Page (`/company/:id`)

### Data Source
`portfolioCompanies.find(c => slugify(c.nom) === id)` (static import from `src/data/searchers.js`).

### Edge Cases
- **Company not found:** render "Empresa no trobada" + `← Inversions` link.

### KPI Cards (5)
1. **Ticket** — `ticket` via `fmtM()`
2. **TVPI** — `tvpi` ×, color-coded
3. **RVPI** — `rvpiEur ?? 0` via `fmtM()` (field can be null — default to 0)
4. **DPI** — `dpiEur ?? 0` via `fmtM()` (field can be null — default to 0)
5. **Mesos operant** — `mesosOperant`

### Operative Metrics
- **Ingressos LTM** — `rev` via `fmtM()`; if `null` show `—`
- **EBITDA LTM** — `ebitda` via `fmtM()`; if `null` show `—`
- If both non-null: show EBITDA margin as sub-label: `(ebitda / rev * 100).toFixed(1)%`

### KPI Evolution Chart (placeholder)
- Tabbed switcher: TVPI / Ingressos / EBITDA
- All tabs show empty state: *"Afegeix dades històriques per veure l'evolució"*
- Styled placeholder `<div>` with dashed border + centered message
- No dummy data
- Future: add `history: [{ date, tvpi, rev, ebitda }]` to company data and replace placeholder with `LineChart`

### Entry Info
- `dataCompr` — entry date
- `multEntry ?? '—'` — shown as `4.2×`
- `origen`
- `entrepreneurs`
- `geo` — use `FlagImg` from `SharedComponents.jsx`

### Back Navigation
`← Inversions` → `<Link to="/investments">` (same reasoning as funds).

---

## Design Consistency

- Light/dark theme: `TC_LIGHT` / `TC_DARK` from `src/theme.js` via `useTheme()`
- EUR formatting: `fmtM()` from `src/utils.js`
- Badges: `Badge` from `SharedComponents.jsx`
- Country flags: `FlagImg` from `SharedComponents.jsx`
- Charts: Recharts `AreaChart` (already a dependency)

---

## Out of Scope

- Editing fund/company data from detail pages
- Historical time-series data entry UI for companies (future task)
- Pipeline fund detail pages (no transaction history)
- Authentication / access control
- SSR or SEO optimization
