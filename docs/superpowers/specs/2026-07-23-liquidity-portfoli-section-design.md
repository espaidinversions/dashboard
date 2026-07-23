# Design — Liquiditat as a global Portfoli section

Date: 2026-07-23
Status: DESIGN (approved 2026-07-23). Implementation plan to follow.
Repo: `01. Dashboard` (turtle-capital-dashboard). Deploy = `git push origin master` → Vercel.
Gate before every deploy: `npm run build` and `npm test` (currently 175 tests must pass).

---

## 1. Goal (from the user)

Add **Liquiditat** as a **section within the Portfoli nav group** (a sibling of Alternatius /
Real Estate / Mercats Públics / Model Caixa). It shows the **cash position of the bank
accounts across all sections**, presented in **several charts** (not just a table).

---

## 2. Decisions (2026-07-23 — FINAL)

1. **Placement:** a new **global** Portfoli top-level view covering **all** sections' accounts
   (not per-section subtabs). It is a single page (a leaf), not a collapsible section.
2. **Charts (all four):** by section (donut), by bank (bar), by currency (donut),
   plus the per-account detail table.
3. **Access:** a **new grantable `"liquidity"` permission**. Admins/superusers always allowed;
   regular users must be granted it explicitly. Same treatment as the existing `"inici"` gate.

---

## 3. Current-state facts (verified 2026-07-23)

- **Data source:** Supabase `liquidity_accounts` → `loadLiquidityAccounts()`
  (`src/db/liquidityAccounts.js`) → `useDashboardData` (`liquidityAccounts` state) → exposed as
  `d.liquidityAccounts` in `Dashboard.jsx`. Already consumed by the shared `LiquiditatSection`
  in several summaries.
- **Account shape:** `{ id, nom, banc, section, saldo, saldo_native, divisa, data }`.
  `section` ∈ `alternatives` | `real-estate` | `mercats-publics`. `saldo` is **EUR**;
  `saldo_native`/`divisa` are for display. Each account is a **single snapshot** (one `data`
  date) — there is **no historical time series**, so no time-trend charts.
- **Existing model:** `buildLiquiditySummary(accounts, { section })` in
  `src/data/liquidityModel.js` → `{ total, byAccount, bySection }`.
  `bySection` = `{ alternatives, "real-estate", "mercats-publics" }`.
- **Existing shared UI:** `src/components/shared/LiquiditatSection.jsx` — total headline +
  per-account table (Banc / Compte / Saldo / Data), native-currency display, empty state.
- **Chart primitives:** `src/ReactECharts.jsx` wrapper; `CHART_PALETTE` from
  `src/chartColors.js`; `fmtM` from `src/utils.js`. Donut/bar pattern established in
  `src/components/SearcherCharts.jsx`.
- **Nav:** `PORTFOLI_SECTIONS` in `src/components/Sidebar.jsx` (alt / re / mp / cm), each
  rendered via the `Section` component (requires `children`). Standalone leaves (e.g. "Inici")
  render via the `Leaf` component gated by `isAdmin || canAccessSection(...)`.
- **Permissions:** `src/permissions.js` — `ALL_SECTION_IDS`, `INICI_SECTION_ID` default-NONE
  pattern; `AdminPermissions.jsx` registers grantable permissions.

---

## 4. Design

### Part A — Model layer (`src/data/liquidityModel.js`, extend)

Add pure builders alongside `buildLiquiditySummary` (no mutation; guard non-array/empty input):

- `buildLiquidityByBank(accounts)` → `[{ banc, total }]`, sorted by `total` desc.
  Accounts with a falsy `banc` group under a stable label (e.g. `"—"`).
- `buildLiquidityByCurrency(accounts)` → `[{ divisa, total }]`, sorted by `total` desc.
  Sums the **EUR** `saldo` grouped by `divisa` (so the chart reads "cash held in USD-denominated
  accounts, expressed in EUR"). Missing `divisa` defaults to `"EUR"`.
- Section breakdown reuses the existing `buildLiquiditySummary(accounts).bySection`.

Unit-tested in `test/liquidityModel.test.js`: totals, empty input, ordering, missing-field
defaults.

### Part B — Components (`src/components/liquidity/`)

- **`LiquidityCharts.jsx`** — three charts via `ReactECharts` + `CHART_PALETTE` + `fmtM`:
  1. **Section donut** — share of total across the three sections; center label = total.
  2. **Bank bar** — horizontal bar, banks ranked by total.
  3. **Currency donut** — cash by `divisa` (EUR-equivalent).
  Each chart guards the empty case (renders an empty state instead of a blank canvas).
- **`LiquidityOverview.jsx`** (the page, target < ~200 lines) —
  - Props: `{ accounts, tc, dark }`.
  - KPI row (reuse `KpiCard`): **Total cash**, **# comptes**, **# bancs**.
  - `LiquidityCharts` in a responsive grid.
  - Per-account table by **reusing the existing `LiquiditatSection`** with no `section` prop
    (= all accounts). No duplicate table implementation.
  - Named `LiquidityOverview` (not `LiquiditatSection`) to avoid collision with the existing
    shared block.

### Part C — Nav / routing / render

- **`src/components/Sidebar.jsx`** — render **"Liquiditat"** as a `Leaf` at the end of the
  Portfoli group (icon `Wallet` from lucide-react), shown only when
  `isAdmin || (canAccessSection?.("liquidity") ?? false)`. It is a single page, so a leaf —
  not added to `PORTFOLI_SECTIONS` (which assumes `children`).
- **`src/components/hooks/useTabRouter.js`** —
  - `handleNavigate`: `case "liquidity": setTab("liquidity"); break;`
  - `normalizeNavState`: when `tab === "liquidity"` return nav id `"liquidity"`.
  - No subtab state.
- **`src/components/Dashboard.jsx`** —
  - Add a `tab === "liquidity"` render branch → `<LiquidityOverview accounts={d.liquidityAccounts} tc={tc} dark={dark} />`.
  - Resolve `currentPermissionId` to `"liquidity"` for this tab; set the header title to "Liquiditat".

### Part D — Access control

- **`src/permissions.js`** — add `"liquidity"` to `ALL_SECTION_IDS`; in `buildSectionAccessMap`,
  default it to `ACCESS_NONE` for non-admin/non-superuser (mirror `INICI_SECTION_ID`), grantable
  via `section_roles`.
- **`src/components/admin/AdminPermissions.jsx`** — register `"liquidity"` as a grantable
  permission (label "Liquiditat") so admins can grant it.
- Non-allowed users never see the leaf; the existing home-redirect logic already handles a tab
  a user cannot reach.

### Data flow

`liquidity_accounts` (Supabase) → `loadLiquidityAccounts` → `useDashboardData` →
`d.liquidityAccounts` → `Dashboard` → `LiquidityOverview` → model builders → ECharts + reused
table.

---

## 5. Files to create / touch

Create:
- `src/components/liquidity/LiquidityOverview.jsx`
- `src/components/liquidity/LiquidityCharts.jsx`

Touch:
- `src/data/liquidityModel.js` (`buildLiquidityByBank`, `buildLiquidityByCurrency`)
- `test/liquidityModel.test.js` (new builder tests)
- `src/components/Sidebar.jsx` (Liquiditat leaf in Portfoli group, gated)
- `src/components/hooks/useTabRouter.js` (route + normalizeNavState for `"liquidity"`)
- `test/useTabRouter.test.js` (add `"liquidity"` mapping assertion)
- `src/components/Dashboard.jsx` (render branch, permission id, header title)
- `src/permissions.js` (register `"liquidity"` section, default NONE for non-admins)
- `src/components/admin/AdminPermissions.jsx` (grantable `"liquidity"`)

---

## 6. Testing

- **Unit:** `buildLiquidityByBank` / `buildLiquidityByCurrency` (totals, empty input, ordering,
  missing-field defaults); `normalizeNavState` `"liquidity"` mapping.
- **Regression:** full `npm test` green (175 → higher) before deploy.
- **Manual:** Liquiditat leaf appears in Portfoli for an admin and a granted user, and is hidden
  for a non-granted user; the three charts render with correct proportions; total cash and the
  section breakdown reconcile with the per-section liquidity shown in the summaries; empty-data
  state renders cleanly.

---

## 7. Notes / guardrails

- Respect `CLAUDE.md`: keep edits narrow; no unrelated churn; existing Supabase migrations are
  immutable (this feature needs **no** new migration — the table already exists).
- No new data source: this is a presentation-only feature over `liquidity_accounts`.
- Single-snapshot data → no time-trend charts (YAGNI).
- Attribution disabled globally — no co-author trailer on commits.
