# Alternatives MOIC & IRR cohort matrix — design

**Date:** 2026-07-09
**Status:** Approved (placement + MOIC definition confirmed by user)

## Goal

In the Alternatives → Portfoli (`fons`) subtab, show a cross-tab matrix of **MOIC** and
**IRR** broken down by **vintage** (rows) and **strategy** (columns), rendered directly
below the existing "Vehicles" funds table. This gives a cohort view of performance that the
per-fund table can't express.

## Scope

- Renders **only** in the Alternatives scope of `FundsIndexInner`
  (`vcpeTypes` contains `PE` or `VC`). Not shown for Real Estate (`RE`) or the
  company-embedded uses.
- Considers only funds whose resolved `est` is one of the four ALT strategies
  (`estSection(est) === "ALT"`):
  - `Fons Primari` (Primari)
  - `Fons Secundari` (Secundari)
  - `Fons de Fons` (FoF)
  - `Fons de Coinversió` (Coinversió)

## Layout

Single table wrapped in the existing `tableCardStyle`, titled via `SectionHeader`
("MOIC i IRR per Vintage i Estratègia"):

- **Rows** = vintage year, ascending, followed by a `Total` row.
- **Columns** = the four strategies in fixed order (Primari, Secundari, FoF, Coinversió),
  followed by a `Total` column. All four columns are always rendered, even when empty.
- **Each cell** stacks two values:
  - **MOIC** — e.g. `1.8×`, colored via `multipleColor`.
  - **IRR** — e.g. `−12%`, green when ≥ 0, red when < 0.
  - Empty cell (no qualifying funds) → `—`.

## Aggregation math

Pooled, consistent with the fund detail pages. Definitions per cell (the set of funds with
a given vintage × strategy that have a non-null TVPI):

- **MOIC** = capital-weighted average of TVPI
  = `Σ(tvpi_i × calls_i) / Σ(calls_i)`.
- **IRR** = pooled XIRR: concatenate every fund's dated Capital Call / Distribució /
  Retorn Capital cash flows in the cell (`amount = -eur`), then push one terminal residual
  cash flow dated today equal to `Σ max(tvpi_i × calls_i − dist_i, 0)`, and run the existing
  `xirr`. This is a true money-weighted cohort IRR, **not** an average of per-fund IRRs.
- **Totals** (row totals across strategies, column totals across vintages, and the grand
  total) apply the same pooling over the union of funds in scope.

Reuses `xirr` from `formatters` and mirrors the residual-value logic already in
`computeFundIrrFromRows` (`src/data/fundDetailModel.js`).

## Edge cases

- **Fund without a TVPI** is excluded from a cell's MOIC *and* IRR. IRR needs the residual
  value (derived from TVPI); including a fund with NAV treated as 0 would drag the cohort to
  a spurious ~−90% (the same trap fixed for the per-fund IRR display). A cell whose only
  funds lack a TVPI shows `—`.
- **Fund without a Compromís year** (no derivable vintage) is skipped from the matrix.
- **`xirr` returns null** (too few flows / no sign change) → IRR shows `—`.
- A vintage year is only shown as a row if at least one qualifying ALT fund has it.

## Code structure

Isolated and testable:

- **New** `src/data/altCohortModel.js` — pure function
  `buildAltCohortMatrix(rawCC, fundMeta)` returning
  `{ vintages, strategies, cells, totals }` where:
  - `vintages: number[]` (ascending)
  - `strategies: string[]` (the four canonical ALT est labels, fixed order)
  - `cells`: record keyed by `` `${vintage}|${strategy}` `` → `{ moic, irr } | null`
  - `totals: { byVintage, byStrategy, grand }` each `{ moic, irr } | null`
  - Internally reuses `xirr` and the same residual logic as `computeFundIrrFromRows`.
  - Uses `makeFundRouteId` / `normalizeFundDetailRow` conventions so a fund's flows match
    the fund page.
- **New** `test/altCohortModel.test.js` — covers capital-weighted MOIC across ≥2 funds in a
  cell, pooled IRR combining flows, empty cell → null, totals math, exclusion of non-ALT
  funds, exclusion of no-TVPI funds, and skipping no-vintage funds.
- **New** `src/components/funds/AltCohortMatrix.jsx` — presentational component consuming the
  model output; no data fetching of its own.
- **Edit** `src/components/FundsIndex.jsx` — compute the matrix in a `useMemo`
  (`[rawCC, fundMeta]`) and render `<AltCohortMatrix>` below the Vehicles table, gated on
  `isAlternatives = Array.isArray(vcpeTypes) && (vcpeTypes.includes("PE") || vcpeTypes.includes("VC"))`.

## Non-goals

- No changes to the per-fund table columns or the fund detail page.
- No new persisted data — everything is derived at render time from existing
  `capital_calls` + `fund_meta`.
- No RE / Search Fund / company cohort views (only the four ALT strategies).
