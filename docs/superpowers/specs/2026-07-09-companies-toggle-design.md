# Companies Toggle — Design

**Date:** 2026-07-09
**Status:** Approved (design)
**Related:** `2026-07-09-alt-cohort-matrix-design.md`

## Goal

Let the user optionally include **companies** (Search Funds + Participades) in the two
vehicles-only Alternatives surfaces:

1. The **MOIC/IRR cohort matrix** on the *Mercats Privats Resum* tab.
2. The **Portfoli / Fons table** (`FundsIndexInner`) on the *Inversions* tab.

Both are driven by one shared toggle (`Incloure companies`), defaulting **off**.

Companies already have dedicated homes (the *Participades* and *Searchers* tabs); this
feature is about seeing the **whole private-markets book in one place** without losing
the vehicles-only default.

## Definitions

- **Vehicle** = fund with `estSection(est) === "ALT"` (Primari / Secundari / FoF / Coinversió).
- **Company** = `estSection(est) === "SF"` (Search Fund – Cerca / Participada) or `=== "PC"`
  (Participada Altres).
- Companies live in the same `rawCC` (capital_calls) rows as vehicles, classified via
  `estSection`. They carry dated `Compromís` rows → usable vintages.

## Section 1 — Data model (`src/data/altCohortModel.js`)

Generalize the ALT-only summarizer so both matrices share one path.

- Extract `summarizeAltFunds` → **`summarizeFundsBySection(rawCC, fundMeta, { sections, excludeIds })`**.
  - Returns the same per-fund shape: `{ est, vintage, calls, dist, tvpi, flows }`.
  - Keeps existing rules: strategy = earliest-dated `Compromís` row's `est`; vintage =
    earliest `Compromís` year; funds with no dated commitment are skipped.
  - `sections` is the set of `estSection` values to keep (e.g. `["ALT"]` or `["SF","PC"]`).
  - `excludeIds` (optional `Set`) drops matching fund ids before grouping.
- Add company constants next to `ALT_STRATEGIES`:
  ```js
  export const COMPANY_STRATEGIES = [
    "Search Fund - Cerca",
    "Search Fund - Participada",
    "Participada (Altres)",
  ];
  export const COMPANY_STRATEGY_LABELS = {
    "Search Fund - Cerca": "Cerca",
    "Search Fund - Participada": "Participada",
    "Participada (Altres)": "Altres",
  };
  ```
- Add **`buildCompanyCohortMatrix(rawCC, fundMeta, { excludeIds, asOfDate })`** — same
  structure as `buildAltCohortMatrix` but `sections: ["SF","PC"]`,
  `strategies: COMPANY_STRATEGIES`. It **excludes `actualCompanyIds` from the SF set** so an
  acquired search fund is not counted as both a searcher and a participada (mirrors the
  dedup already done in `useDashboardData` via `searcherTx`/`searcherCompr`).
- `buildAltCohortMatrix` becomes a thin wrapper over the generalized builder with
  `sections: ["ALT"]`, `strategies: ALT_STRATEGIES`.
- `computeCohort` is unchanged. Company MOIC reads the provisional `tvpi: 1` (→ 1.0x); IRR is
  still computed from real dated flows + terminal residual value.

## Section 2 — Matrix UI (`AltCohortMatrix.jsx` + `ResumTab.jsx`)

- **`AltCohortMatrix`** gains props `strategies`, `strategyLabels`, `title`, defaulting to the
  current ALT values so the existing render is unchanged. Strategy list/labels become props
  instead of imported constants.
- **`ResumTab`** receives `companyMatrix`, `includeCompanies`, `onToggleCompanies`.
  - Always renders the vehicles matrix.
  - When `includeCompanies` **and** `companyMatrix.vintages.length > 0`, renders a second
    `<AltCohortMatrix title="Companies" strategies={COMPANY_STRATEGIES}
    strategyLabels={COMPANY_STRATEGY_LABELS} matrix={companyMatrix} />` directly below.
- **Toggle control** — a small `Incloure companies` switch in the matrix section header, bound
  to the shared flag via `onToggleCompanies`.
- **Dashboard** computes
  `companyMatrix={buildCompanyCohortMatrix(d.rawCC, fundMeta, { excludeIds: d.actualCompanyIds })}`
  next to the existing `matrix={…}` and passes it down.

## Section 3 — Fund table (`FundsIndexInner`)

- New optional prop **`includeCompanies`**, wired **only** for the Alternatives Portfoli usage
  (`vcpeTypes=["PE","VC"]`). RE and other usages untouched.
- A matching `Incloure companies` switch renders in the **"Vehicles" section header**, only in
  the alternatives context, bound to the shared flag.
- `shouldIncludeRow` for that usage:
  - **OFF** → strictly `estSection(row.est) === "ALT"`.
  - **ON** → ALT **plus** companies (SF + PC), deduped consistently with `excludeIds`.

**Decision (Option A):** OFF is strict ALT-only. This is a small, intentional change from
today's filter (`estSection(est) !== "SF"`, which already leaks non-acquired Participada rows).
Result: OFF = vehicles, ON = vehicles + companies — clean, consistent semantics across both
surfaces.

## Section 4 — Shared state

- `Dashboard`: `const [includeCompanies, setIncludeCompanies] = usePersistedState("ui_alt_include_companies", false)`.
- Passed to both `ResumTab` (matrix) and the Portfoli `FundsIndexInner`. Both render a control
  bound to it; flipping on either tab updates both. Default off.

## Section 5 — Testing (`test/altCohortModel.test.js`)

- `buildCompanyCohortMatrix` groups company rows by `COMPANY_STRATEGIES` × vintage; excludes ALT
  and RE rows.
- Dedup: an SF row whose id is in `excludeIds` is not double-counted (appears only via its PC row).
- A company with no dated `Compromís` is skipped (same rule as vehicles).
- Regression: `buildAltCohortMatrix` output is unchanged by the refactor (existing tests pass).

## Out of scope

- Real Estate TVPI baseline for the 7 null-TVPI RE funds (separate open task).
- Any DataLoader re-import (would rewrite `capital_calls.est` and undo the Matrius
  harmonization).
