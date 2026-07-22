# Landing Page ("Inici") — Section-Agnostic Overview

**Date:** 2026-07-20
**Status:** Approved design, pending implementation plan
**Author:** Roberto + Claude

## Problem

The dashboard opens on the `resum` tab, which is the **Mercats Privats** (Alternatius) overview — a section-specific view. A user who lands there sees only private-markets numbers, even if their real interest is Real Estate or Mercats Públics, and even if their permissions span multiple sections. There is no single place that answers "how is the whole portfolio doing?" across Alternatius, Real Estate, and Mercats Públics.

## Goal

Add a section-agnostic landing page, **"Inici"**, that:

1. Is the default view on open (new default tab).
2. Shows a portfolio-wide headline strip (KPIs aggregated across all sections the user can see).
3. Shows one summary card per top-level section the user has access to (Alternatius / Real Estate / Mercats Públics), each click-through to that section.
4. Respects permissions: sections the user cannot access are hidden entirely — from the KPIs and from the cards.

Non-goals: no new charts beyond the summary cards, no new API endpoints, no changes to how each section computes its own detail views.

## Approach (chosen: A — client-side aggregation)

All the private-markets data the landing needs already flows through `useDashboardData()` in `Dashboard.jsx` (`TRANSACTIONS`, `COMPROMISOS`, `reTx`, `reCompr`, `sfTx`, `pcTx`, etc.). Real Estate is derivable from the same rows via `splitRealEstateRows`. So the Alternatius and Real Estate cards need **no new data source** — just a pure aggregation function.

Mercats Públics data does **not** flow through `useDashboardData` — it loads separately (`usePmMonthly` / PM loaders). To keep the landing cheap on first paint and avoid a data-layer refactor, the PM card is **lazy-loaded in its own Suspense boundary** and pulls PM totals through the existing PM hook. If the user has no PM access, the card and its data fetch never mount.

Rejected: Approach B (a new aggregate API endpoint) — more moving parts, another deploy surface, and the data is already client-side. YAGNI.

## Architecture

### New files

- **`src/data/landingModel.js`** — pure functions, unit-tested. No React, no I/O.
  - `buildSectionSummary({ tx, compr, label, sectionId })` → `{ sectionId, label, invertit, compromesPendent, retornat, netCashFlow, nPosicions }`.
  - `buildLandingModel({ altTx, altCompr, reTx, reCompr, pmSummary, accessMap })` → `{ headline, cards }` where `cards` is the ordered, permission-filtered list of section summaries and `headline` is the roll-up across only the included cards.
  - Aggregation rules (match existing section conventions):
    - `invertit` = sum of Capital Call outflows (signed, as already normalized in `capital_calls`).
    - `retornat` = sum of Distribució + Retorn Capital inflows.
    - `compromesPendent` = committed − called (from `COMPROMISOS` vs `TRANSACTIONS`), floored at 0.
    - `nPosicions` = distinct active vehicle/position count for the section.
  - Money is in EUR (rows already carry `eur`). No FX work in this module.

- **`src/components/tabs/LandingTab.jsx`** — presentational.
  - Props: `model` (from `buildLandingModel`), `tc` (theme), `onNavigate` (the existing `handleNavigate`), `pmCard` (the lazy PM card node or `null`).
  - Renders the headline strip (reusing `KpiCard`) + a responsive grid of section cards. Each card: label, its KPIs, and a click target that calls `onNavigate(<sectionId>)` routing to that section's default nav item (`alt-resum`, `re-directe`, `mp-resum`).
  - No data fetching inside the component. Pure render from props.

### Edited files

- **`src/components/hooks/useTabRouter.js`** — default `tab` becomes `"home"` (was `"resum"`); add `home` handling in `normalizeNavState`/`handleNavigate` so the sidebar highlights "Inici".
- **`src/components/Dashboard.jsx`** —
  - Compute `landingModel` with `useMemo` from `d.*` slices + `accessMap` (derived from `canAccessSection`).
  - Render `{tab === "home" && <LandingTab ... />}` as the first branch in `<main>`.
  - Lazy PM card: `const PmLandingCard = lazy(...)`, mounted inside `<Suspense>` only when `canAccessSection("mercats-publics")`.
- **`src/components/Sidebar.jsx`** — add an "Inici" nav item at the top, always visible (it self-filters its cards), active when `tab === "home"`.
- **`src/components/tabs/index.js`** — export `LandingTab`.

### Data flow

```
useDashboardData ──► TRANSACTIONS / COMPROMISOS / reTx / reCompr ─┐
                                                                  ├─► buildLandingModel ─► LandingTab
canAccessSection ──► accessMap ───────────────────────────────────┤
usePmMonthly (lazy, PM-access only) ──► pmSummary ────────────────┘
```

## Permissions

The landing filters at the model layer: `buildLandingModel` receives the access map and only includes a section's card and its contribution to the headline if `canAccessSection(sectionId)` is true. This means:

- A user with only Alternatius sees one card and headline KPIs = Alternatius only.
- The PM card (and its lazy data fetch) never mounts without `mercats-publics` access.
- No section totals leak into the headline for sections the user can't open.

## Error handling

- Empty/loading: while `d.isLoading` and no rows, the headline shows the existing "Carregant dades..." affordance; cards render with `—` placeholders rather than `0`.
- PM card fetch failure: the Suspense fallback resolves to a small "No s'han pogut carregar les dades de Mercats Públics" card; the rest of the landing is unaffected.
- `buildLandingModel` is defensive: missing arrays default to `[]`, non-finite sums coerce to `0`.

## Testing

- **Unit (`test/landingModel.test.js`)** — AAA style:
  - Aggregates invertit/retornat/compromesPendent correctly for a mixed row set.
  - Excludes sections not in the access map (card absent AND not counted in headline).
  - Handles empty input → all zeros, no throw.
  - Headline roll-up equals the sum of included cards only.
- **Component** — light render test that `LandingTab` calls `onNavigate("alt-resum")` on Alternatius card click; visual regression is lower priority here (cards reuse existing `KpiCard`).
- Existing `altCohortModel` / `privateCompanyModel` tests remain green (no changes to those modules).

## Rollout

- New default tab is `home`; deep links to other tabs (`?tab=...`) still work unchanged.
- Ship through the existing CI → Vercel production pipeline (master branch).
