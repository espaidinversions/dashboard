# Plan — Real Estate summary page + cross-section Liquidity

Date: 2026-07-22
Status: IMPLEMENTED (2026-07-23). All 5 phases shipped to `master` and deployed.
Commits: Phase 1 `90b7717` (RE Resum page) · Phase 2 `0e8220d` (Inici gating) · Phase 3 `8568dbe` (liquidity foundation) · Phase 4 `368e1a2` (Liquiditat in Alternatius/RE) · Phase 5 `7a99399` (Inici total card) + `a687b68` (PM liquidity migration).
Verified 2026-07-23: `npm test` 175/175 pass · `npm run build` clean.
Repo: `01. Dashboard` (turtle-capital-dashboard). Deploy = `git push origin master` → Vercel.
Gate before every deploy: `npm run build` and `npm test` (now 175 tests must pass).

---

## 1. Goals (from the user)

1. **Create a Real Estate summary page.** For now, populate it with **metrics of the RE vehicles**.
2. **Liquidity as its own section**, appearing in **both the portfoli and the summary**.
   - Definition (user): *"liquidity encompasses all cash positions of the bank accounts, so it also has bank accounts used for each section of the portfolio."*
   - So liquidity is a **cross-section** concept: a set of bank accounts, each **tagged to a portfolio section** (Alternatius / Real Estate / Mercats Públics), each with a cash balance.

---

## 2. Current-state facts (verified this session)

### Real Estate
- **Nav** (`src/components/Sidebar.jsx`, `PORTFOLI_SECTIONS` → `re`): children are
  `re-directe` (Directe), `re-altres` (Vehicles Real Estate), `re-inversions` (Totes les Posicions), `re-cash-model` (Model). **No Resum item today.**
- **Routing** (`src/components/hooks/useTabRouter.js`):
  - `handleNavigate`: `re-directe → real-estate + realEstateTab "directe"`, `re-altres → "altres-vehicles"`, `re-inversions → "inversions"`.
  - `normalizeNavState` (real-estate): `altres-vehicles → re-altres`, else `re-directe`.
  - `realEstateTab` default = `"directe"`.
- **Render** (`src/components/Dashboard.jsx`, `tab === "real-estate"`): subtab bar built from `REAL_ESTATE_NAV` = `[re-directe→directe, re-altres→altres-vehicles, re-inversions→inversions]`. Content: `inversions`/`altres-vehicles` → `<FundsIndexInner vcpeTypes={["RE"]} />`; `directe` → **"Secció en construcció"** placeholder.
- **RE data**: `reTx`, `reCompr` come from `splitRealEstateRows(rawCC)` (`src/components/hooks/useDashboardData.js:348`). Same source the Inici RE card already uses.
- **RE metrics already exist**: `buildSectionSummary({ tx: reTx, compr: reCompr, sectionId: "real-estate", label: "Real Estate" })` in `src/data/landingModel.js` → `{ invertit, compromesPendent, retornat, netCashFlow, nPosicions }`.
- **Section-scoped chart data**: `useTransactionDerivedData` computes `byFy`/`byEst` based on `section`, which is `"real-estate"` when `tab === "real-estate"`. So `ResumTab`-style charts can be fed RE figures directly on the RE tab (same trick used for Alternatius on Inici).

### Liquidity
- **Only Public Markets has liquidity today.** `PM_MODEL.holdings.liquidity` (`PM_LIQUIDITY_POSITIONS`) with `valorMercat` per account, rendered as a "Liquiditat per compte" table in `src/components/publicMarkets/PublicMarketsSummarySection.jsx`.
- **No Alternatius/Real Estate liquidity data exists anywhere.** A new cross-section data source is required.

---

## 3. Resolved decisions (2026-07-22 — FINAL)

This section is authoritative and OVERRIDES any option-lists in Parts A/B/C below.

1. **Liquidity data source = Excel import → Supabase table (single source of truth).**
   - Create a NEW Supabase table (e.g. `liquidity_accounts`) via a NEW migration (existing migrations are immutable). Suggested columns: `id`, `nom`, `banc`, `section` ('alternatives'|'real-estate'|'mercats-publics'), `saldo` (numeric, EUR), `saldo_native`, `divisa`, `data` (ISO date), created/updated timestamps.
   - Add an **Excel import path in the existing `DataLoader` flow** that upserts rows into this table. The Supabase table is the source of truth; the app reads it (in `useDashboardData`).
2. **PM = Public Markets (Mercats Públics).** The question was only whether PM's existing "Liquiditat per compte" (derived from the generated PM model) should fold into the new liquidity model. FINAL: **the Supabase liquidity table is the source of truth for ALL sections, including Mercats Públics.** Keep PM's current liquidity display working; once PM bank accounts exist in the Excel/table, migrate PM's display to read from the new table. This migration is a LATER optional step — do NOT block Phase 1 (RE summary) or the core liquidity work on it.
3. **RE default subtab = Resum (for now).** Set `realEstateTab` default to `"resum"` until "Directe" exists; revert to `"directe"` once Directe is built.
4. **RE vehicle detail = mirror the Alternatius Resum.** Alternatius Resum = `TxSection summaryOnly` + `AltCohortSection` (cohort matrix). RE summary gets the same shape: `TxSection summaryOnly` fed `reTx`/`reCompr`, plus a **vehicles cohort matrix** built from RE rows — reuse the `altCohortModel` builders (`buildAltCohortMatrix` / `buildCompanyCohortMatrix`) scoped to RE vehicles, and reuse `AltCohortSection` if the matrix shape matches (otherwise a RE-specific builder).
5. **Access control:**
   - RE summary reuses the existing `"real-estate"` permission (no new `re-resum` permission).
   - **NEW REQUIREMENT — Inici gating:** the Inici (home/landing) page must be accessible **only to admins and users explicitly granted access.** See Part C.

---

## 4. Design

### Part A — Real Estate summary page (vehicle metrics)

New nav + route + render, mirroring `mp-resum` / `alt-resum`:

- **Sidebar** (`PORTFOLI_SECTIONS` → `re.children`): prepend `{ id: "re-resum", label: "Resum", icon: LineChart }`.
- **Router** (`useTabRouter.js`):
  - `handleNavigate`: add `case "re-resum": setTab("real-estate"); setRealEstateTab("resum"); break;`
  - `normalizeNavState` (real-estate branch): add `if (realEstateTab === "resum") return "re-resum";` (before the `altres-vehicles`/default lines).
  - If decision 3 = yes, change `useState("directe")` → `useState("resum")` for `realEstateTab`.
- **Dashboard** `REAL_ESTATE_NAV`: prepend `{ id: "re-resum", tab: "resum" }`; extend the subtab label map so `resum → "Resum"`.
- **Dashboard** render (`tab === "real-estate"`): add a `realEstateTab === "resum"` branch that renders a new `RealEstateSummarySection`. Keep `directe` as the construcció placeholder.
- **New component** `src/components/realEstate/RealEstateSummarySection.jsx`:
  - Props: `{ tc, reTx, reCompr, fundMeta, byFy, byEst, estCfg }` (all already available in Dashboard scope).
  - Content (Phase 1, vehicle metrics):
    - Headline KPI row via `buildSectionSummary({ tx: reTx, compr: reCompr, sectionId: "real-estate" })` → Invertit / Compromès pendent / Retornat / # vehicles (reuse `KpiCard`).
    - Charts: reuse `<ResumTab tc byFy byEst estCfg />` (RE-scoped `byFy`/`byEst`), OR a per-vehicle table aggregating `reTx` by `fons` (committed/called/distributed, + `tvpi` from `fundMeta`). Depth per decision 4.
  - Keep the file focused (< ~250 lines); extract a small `reVehicleMetrics` helper into `src/data/` if aggregation grows.
- **`section` / `currentPermissionId`** in Dashboard: `tab === "real-estate"` already maps to section `"real-estate"`; `re-resum` should resolve permission to `"real-estate"` (decision 5).

### Part B — Cross-section Liquidity

- **Data model** (`src/data/liquidity.js` or Supabase per decision 1): array of accounts
  `{ id, nom, banc, section, saldo, divisa, data }`.
- **Utility** `buildLiquiditySummary(accounts, { section } = {})` in `src/data/liquidityModel.js`:
  - Returns `{ total, byAccount: [...], bySection: { alternatives, "real-estate", "mercats-publics" } }`, filtered to `section` when provided. Handle currency (assume EUR `saldo`, keep `saldo_native`/`divisa` for display).
  - Unit-tested (mirror `test/landingModel.test.js` style).
- **Shared UI** `src/components/shared/LiquiditatSection.jsx`:
  - Props `{ accounts, section, tc }`. Renders a titled "Liquiditat" block: total + per-account table (bank, account, saldo, data). Reused by every summary and portfoli.
- **Wire into SUMMARY pages** (each section's summary shows its own liquidity slice):
  - Alternatius Resum (`inversionsSubTab === "resum"` block), RE Resum (`RealEstateSummarySection`), Mercats Públics (`PublicMarketsSummarySection` — replace/augment its existing "Liquiditat per compte" table with the shared component if unified per decision 2).
- **Wire into PORTFOLI views** (liquidity as a distinct section alongside positions):
  - Add a "Liquiditat" block/subtab to each section's portfolio: RE portfoli (`FundsIndexInner vcpeTypes RE` area), Alternatius portfoli (`inversionsSubTab === "fons"`), and PM. Decide block-appended vs. dedicated subtab (recommend appended block for Phase 3 simplicity).
- **Inici (optional, Phase 4)**: add total liquidity to the headline strip and/or a Liquiditat card.

### Part C — Inici access gating (NEW requirement)

Inici must be visible only to admins and explicitly-granted users.

- **Permission catalog:** add a grantable permission id `"inici"` wherever sections/permissions are defined (AdminPanel UI + `auth`/`canAccessSection` source, and any Supabase-side permission storage). Admins are implicitly allowed.
- **Sidebar** (`src/components/Sidebar.jsx`): render the "Inici" leaf only when `isAdmin || canAccessSection("inici")`.
- **Routing / default tab** (`src/components/Dashboard.jsx` + `useTabRouter.js`): if `tab === "home"` and the user is not allowed, redirect (via `handleNavigate`/`setTab`) to their first accessible section — order alternatives → real-estate → mercats-publics (or the first entry of `SECTIONS`/`SUPRA`). For non-allowed users the initial default tab must NOT be `"home"`.
- **Edge cases:** header title logic, export (PDF/PNG), and `PmLandingCard` lazy load must behave when `home` is unreachable. A user with zero section access should see an explicit "no access" state, not a blank Inici.

> NOTE: Section 3 (Resolved decisions) is FINAL and overrides any option-lists above.

---

## 5. Phased execution (each phase: build + `npm test` + manual check, then deploy)

- **Phase 1 — RE summary page (vehicle metrics).** Nav (`re-resum`) + route + default `realEstateTab="resum"` + `RealEstateSummarySection` mirroring the Alternatius Resum (`TxSection summaryOnly` + RE cohort matrix). No liquidity. Low risk. Shippable on its own.
- **Phase 2 — Inici access gating (Part C).** Add `"inici"` permission, gate the sidebar leaf, redirect non-allowed users off `home`. Independent of liquidity; can ship alongside Phase 1.
- **Phase 3 — Liquidity foundation.** New Supabase table + migration; Excel import path in `DataLoader` upserting to it; load in `useDashboardData`; `buildLiquiditySummary` util + tests; shared `LiquiditatSection`.
- **Phase 4 — Wire Liquiditat into summaries and portfolis** (Alternatius, Real Estate, and — reading from the Supabase table — Mercats Públics).
- **Phase 5 — (optional) Inici total liquidity** in headline/cards; migrate PM's liquidity display to read from the Supabase table.

---

## 6. Files to create / touch

Create:
- `src/components/realEstate/RealEstateSummarySection.jsx`
- Supabase migration for the `liquidity_accounts` table (new migration file)
- `src/data/liquidityModel.js` (+ `test/liquidityModel.test.js`)
- `src/components/shared/LiquiditatSection.jsx`

Touch:
- `src/components/Sidebar.jsx` (RE nav: add `re-resum`; gate "Inici" leaf)
- `src/components/hooks/useTabRouter.js` (route `re-resum`; normalizeNavState; `realEstateTab` default `"resum"`; home redirect for non-allowed users)
- `src/components/Dashboard.jsx` (`REAL_ESTATE_NAV`, RE render branch, Inici gating/redirect, summary + liquidity wiring)
- `src/components/DataLoader.jsx` (Excel import → upsert into `liquidity_accounts`)
- `src/components/hooks/useDashboardData.js` (load liquidity accounts from Supabase)
- AdminPanel + `auth` (`canAccessSection`) — register the new grantable `"inici"` permission
- `src/components/publicMarkets/PublicMarketsSummarySection.jsx` (later: read PM liquidity from the Supabase table)
- `src/data/landingModel.js` (reuse `buildSectionSummary`; optional Inici liquidity in Phase 5)
- `test/useTabRouter.test.js` (add `re-resum` mapping assertions)

---

## 7. Testing

- Unit: `buildLiquiditySummary` (totals, section filter, empty input); `normalizeNavState` `re-resum` mapping; any `reVehicleMetrics` helper.
- Regression: full `npm test` (163 → higher) green before each deploy.
- Manual: Real Estate → Resum renders vehicle metrics; Liquiditat appears as a distinct section in each summary and portfoli; per-section cash matches source.

---

## 8. Notes / guardrails

- Respect `CLAUDE.md`: plan before multi-step change; keep edits narrow; existing Supabase migrations are immutable (new migration only).
- Keep the 412 KB PM generated dataset lazy — do not import PM data into the main/Dashboard bundle.
- Attribution disabled globally — no co-author trailer on commits.
