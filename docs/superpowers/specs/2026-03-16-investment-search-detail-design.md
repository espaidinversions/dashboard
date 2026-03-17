# Investment Search & Detail Pages — Design Spec

**Date:** 2026-03-16
**Status:** Approved (v2)
**Scope:** Global ⌘K search palette + per-entity detail pages for Portfolio Companies, Searchers, and Pipeline Funds

---

## 1. Overview

Add two features to the Turtle Capital Dashboard:

1. **Global search palette** — a ⌘K command palette accessible from anywhere in the app, searching across all three entity types simultaneously.
2. **Detail pages** — full-page views for individual Portfolio Companies, Active Searchers, and Pipeline Funds, navigated to from search results or from existing tab tables.

No routing library is introduced. Navigation uses a `detailView` state object alongside the existing `tab` state.

---

## 2. Search Palette

### Trigger

A button in the app header (right side, between the upload button area and the dark mode toggle):

```
[ ⌕  Cerca inversions…  ⌘K ]
```

- Styled as a subtle input-like button (`background: tc.bgAlt`, `border: 1px solid tc.border`, `borderRadius: 8px`)
- Clicking it OR pressing `⌘K` / `Ctrl+K` opens the palette
- Always visible regardless of which section is active

### Palette Overlay

- Full-screen dim overlay (`rgba(15,25,35,0.45)` + `backdrop-filter: blur(2px)`)
- Palette card centred horizontally, anchored near the top (`padding-top: 80px`)
- Width: 580px, max-height: 480px, `borderRadius: 14px`
- Closes on ESC or clicking outside

### Input

- Autofocused on open
- Placeholder: `"Cerca per nom, segment, searcher…"`
- Searches as the user types (no submit button)
- ESC badge shown on the right of the input row

### Results

Results are grouped into three labelled sections rendered in this fixed order:

1. **Portfolio Companies** — searches `nom`, `segment`, `entrepreneurs`
2. **Searchers Actius** — searches `nom`, `searchers` (person names)
3. **Pipeline de Fons** — searches `name`, `strategy`, `sector`

Each result item shows:

| Column | Company | Searcher | Fund |
|--------|---------|----------|------|
| Icon | 2-letter initials, green bg | 2-letter initials, navy bg | 2-letter initials, purple bg |
| Name | `nom` | `nom` | `name` |
| Meta line | `segment · geo · tipus` | `searchers · geo · modalitat` | `strategy · geography` |
| Right value | ticket (DM Mono) | ticket (DM Mono) | amount + currency (DM Mono) |
| Right badge | TVPI (green/orange/red) | `mesosCercant + " mesos"` (static field) | `status` string |

- Maximum 5 results per group shown (top matches by string match relevance)
- If a group has no matches it is hidden entirely
- Focused item has `background: tc.bgAlt` and `borderLeft: 3px solid tc.green`
- Keyboard: `↑↓` move focus, `↵` opens detail page, `ESC` closes

### Footer

Keyboard shortcut hints: `↑↓ navegar · ↵ obrir · ESC tancar` — and a match count on the right (`N resultats per "query"`).

### Initial state (empty query)

When the palette opens before the user types, show a prompt message: "Escriu per cercar empreses, searchers o fons…" centred in the results area. No results are rendered for an empty query.

### Empty state (no matches)

If the query returns no matches: centred message "Cap resultat per «query»" with a muted subtitle.

---

## 3. Detail Pages

### Navigation model

Dashboard.jsx holds a new piece of state:

```js
const [detailView, setDetailView] = useState(null);
// null = normal tab view
// { type: 'company', id: 'Adinor' }
// { type: 'searcher', id: 'Audaz Capital, SL' }
// { type: 'fund', id: 1 }
```

`id` is the entity's `nom` (string) for companies and searchers, numeric `id` for funds.

When `detailView` is non-null, the main content area renders the appropriate detail page component instead of the tab content. The `tab` state is not changed — returning from the detail page restores the previous tab view.

The search palette calls `setDetailView(...)` and `setShowPalette(false)` on selection. Existing tab tables can also navigate to detail pages by calling `setDetailView(...)` on row click.

### Breadcrumb

All three detail pages share the same breadcrumb pattern:

```
[ ← Tornar ]  /  [Section name]  /  [Entity name]
```

"← Tornar" calls `setDetailView(null)`.

---

### 3a. Portfolio Company Detail Page

**Hero band**
- Initials avatar (2 letters, `background: tc.bgAlt`, `borderRadius: 12px`)
- Company name (26px, weight 700, `letterSpacing: -0.03em`)
- Tag row: `SF` or `PE` badge + segment + country (flag image) + origin
- Entrepreneur names + acquisition date + months operating (12px muted)
- Right side: TVPI value (36px DM Mono, colour-coded green/orange/red) + label + mini progress bar (0× → 3×); bar fill = `clamp(0, tvpi/3, 1) * 100%` — negative or null TVPI renders 0% fill
- PE Direct companies: entrepreneurs field shows "—" (the data already contains `entrepreneurs:"—"` literally — no special-casing needed, just render the field as-is)

**KPI cards row (5 cards)**

| Card | Value | Accent colour |
|------|-------|---------------|
| Ticket Invertit | `fmtM(ticket)` | `tc.navy` |
| RVPI | `fmtM(rvpiEur)` or "Pendent" | `tc.green` |
| DPI | `fmtM(dpiEur)` | `tc.navyLight` |
| Ingressos LTM | `fmtM(rev)` or "—" | `tc.greenDark` |
| EBITDA LTM | `fmtM(ebitda)` or "—" | `tc.green` |

**Two-column section**

Left — Financial summary table:
- Ingressos LTM, EBITDA LTM, Marge EBITDA (computed), DFN, EV brut, Múltiple d'entrada, TVPI actual
- Null fields show "—"

Right (stacked):
- Investment details table: Tipus, Origen, País, Data adquisició, Mesos operant, Equity Stake (if available)
- Entrepreneur person cards: initials avatar + full name + role ("Co-searcher" / "Empresari")

---

### 3b. Active Searcher Detail Page

**Hero band**
- Initials avatar (navy background)
- Fund name (e.g. "Audaz Capital, SL")
- Tag row: modalitat + country flag + a static "Actiu" badge (all records in `ACTIVE_SEARCHERS` are by definition active; there is no `statusScreening` field on this type)
- `formEntrada` is not available on `ACTIVE_SEARCHERS` — omit it from the hero tag row

**KPI cards row (3 cards)**

| Card | Value | Accent |
|------|-------|--------|
| Ticket TC | `fmtM(ticket)` | `tc.navy` |
| Equity Stake | `equityStake.toFixed(1) + "%"` or "—" if null/undefined | `tc.green` |
| Mesos Cercant | `mesosCercant` (static field from `ACTIVE_SEARCHERS`, not recalculated) | `tc.orange` |

**Detail sections (stacked)**

- Investment details table: Data compromís, Modalitat, País
  - `formEntrada` is not on `ACTIVE_SEARCHERS` — omit this row
- Search progress bar: filled `mesosCercant / 24` (capped at 100%), labelled 0–24m
- Searcher person card(s): one card per `searchers` name (split on " / "), showing initials avatar + name + role

---

### 3c. Pipeline Fund Detail Page

**Hero band**
- Initials avatar (purple background)
- Fund name
- Tag row: strategy + geography + sector
- Status badge (En estudi / Compromès / Descartat)

**KPI cards row (3 cards)**

| Card | Value | Accent |
|------|-------|--------|
| Mida | `amount + " " + currency` | `tc.purple` |
| Geografia | geography string | `tc.navy` |
| Estat | status string | dynamic (orange=En estudi, green=Compromès, red=Descartat) |

**Detail section**

- Fund details table: Estratègia, Sector, Moneda, Canal, Geografia, Estat

---

## 4. New Components

| Component | File | Description |
|-----------|------|-------------|
| `SearchPalette` | `src/components/SearchPalette.jsx` | Overlay + input + grouped results |
| `CompanyDetailPage` | `src/components/CompanyDetailPage.jsx` | Portfolio company detail |
| `SearcherDetailPage` | `src/components/SearcherDetailPage.jsx` | Active searcher detail |
| `FundDetailPage` | `src/components/FundDetailPage.jsx` | Pipeline fund detail |

### Dashboard.jsx changes

- Add `detailView` / `setDetailView` state
- Add `showPalette` / `setShowPalette` state
- Add global `keydown` listener for `⌘K` / `Ctrl+K` → `setShowPalette(true)`
- Render `<SearchPalette>` conditionally as an inline overlay (`position: fixed`, full-screen) — no portal infrastructure needed
- Wrap main content: if `detailView !== null`, render detail page; else render tab content
- Pass `setDetailView` as a prop to `PortfolioCompaniesTab`, `SearchersTab`, and `PipelineFY26` — all three receive it the same way via props

### PortfolioCompaniesTab.jsx changes

- `PortRow` becomes clickable: `onClick={() => setDetailView({type:'company', id: r.nom})}`
- Cursor pointer on rows

### SearchersTab.jsx changes

- Active searcher table rows: `onClick={() => setDetailView({type:'searcher', id: r.nom})}`

### PipelineFY26.jsx changes

- Fund rows/cards: `onClick={() => setDetailView({type:'fund', id: f.id})}`

---

## 5. Data & Search Logic

Search is purely client-side, filtering in-memory arrays. No new data files needed.

```js
// Normalised search helper
const norm = s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'') ?? '';

// Company match
const matchCompany = (q, r) =>
  norm(r.nom).includes(q) ||
  norm(r.segment).includes(q) ||
  norm(r.entrepreneurs).includes(q);

// Searcher match
const matchSearcher = (q, r) =>
  norm(r.nom).includes(q) ||
  norm(r.searchers).includes(q);

// Fund match
const matchFund = (q, f) =>
  norm(f.name).includes(q) ||
  norm(f.strategy).includes(q) ||
  norm(f.sector).includes(q);
```

Accent-insensitive normalisation ensures "Adinor", "adinor", and "àdinor" all match.

---

## 6. Out of Scope

- Edit / annotation functionality (read-only)
- Routing library (React Router etc.) — pure state navigation
- ALL_SEARCHERS (183 discarded searchers) — not included in search results
- Fund process status tracker — the step checklist in the mockup is aspirational; not implemented in this version
- Pagination of search results — 5 results per group is sufficient given dataset size
