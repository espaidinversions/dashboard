# Superuser Inline Editing — Design Spec

**Date:** 2026-03-20
**Status:** Approved

---

## Goal

Allow superusers to edit all data in the dashboard inline (click-to-edit) and create or delete entries, while regular logged-in users remain read-only viewers.

---

## Role System

Superuser status is stored in **Supabase user metadata**: `user_metadata.role = "superuser"`.

- Set via Supabase dashboard → Authentication → Users → Edit user → User Metadata field
- No redeploy required to promote/demote users
- `auth.jsx` computes `isSuperuser = session?.user?.user_metadata?.role === "superuser"` and exposes it via `useAuth()`
- Regular users see the full dashboard read-only; superusers see the same UI plus edit affordances on hover

---

## Edit Pattern

**Always-on inline editing** (no toggle). Superusers: `EditableCell` is active. Regular users: `EditableCell` renders plain text via a `disabled` prop. Saves on Enter or blur; cancels on Escape; only calls `onSave` if value actually changed. **Fix in scope: add `onKeyDown` Escape handler to the `<select>` branch of `EditableCell`** — currently only implemented for `<input>`.

---

## Editable Tables

| Table | Component | Add Pattern | Scope |
|---|---|---|---|
| Funds | `FundsIndex` | Inline form below table | TVPI (existing) + new fund creation |
| Pipeline deals | `PipelineFY26` | Existing modal (gated) | Gate existing edit controls behind `isSuperuser` |
| Portfolio companies | `PortfolioCompaniesTab` | Modal form | All displayed fields |
| Searchers (historic) | `SearchersTab` | Modal form | `historicData` table only (Historial de Searchers) |
| Quarterly KPIs | `CompanyDetail` | Small inline form | Rev, EBITDA, DFN + budget fields per quarter |

All tables: **delete** per row (superuser only). `DeleteRowButton` UX: trash icon → click shows "Eliminar?" label + "Confirmar" `<button>` element inline. Cancel by Escape or clicking away. Blur-cancel: attach `onBlur` to a container `<div tabIndex={-1}>` and check `event.relatedTarget` — if `relatedTarget` is the "Confirmar" `<button>`, do not cancel; otherwise cancel. Confirmar must be a native `<button>` so it appears as `relatedTarget`.

---

## Component Changes

### `src/auth.jsx`
- Add `isSuperuser` to context:
  ```js
  const isSuperuser = session?.user?.user_metadata?.role === "superuser";
  // <AuthContext.Provider value={{ session, signIn, signOut, isSuperuser }}>
  ```

### `src/components/SharedComponents.jsx`
- `EditableCell`:
  - Add `disabled` prop — when true, renders plain text, no hover, no click
  - Add `onKeyDown` Escape handler on the `<select>` branch (same cancel logic as `<input>`)
- New `DeleteRowButton`: container `<div tabIndex={-1}>` with `onBlur` (relatedTarget guard); shows trash icon; on click shows "Eliminar?" text + `<button>Confirmar</button>`; Escape resets to icon; Confirmar calls `onDelete()`
- New `AddRowModal`: modal accepting `fields: [{ key, label, type, options? }]` and `onSave(values: Record<string, string>)`. Renders plain `<input type="text">` or `<select>` — **does not reuse `EditableCell`**. Delivers raw string values; calling component maps to camelCase before calling db functions.

### `src/components/FundsIndex.jsx`
- Wire `disabled={!isSuperuser}` on existing TVPI `EditableCell`
- **Convert `rawCC` from `useMemo` to `useState`** in `FundsIndexInner`. Initialize from `localStorage.getItem("tc_rawCC")` with `RAW_CC_DEFAULT` fallback. On any mutation, update both state and `localStorage.setItem("tc_rawCC", ...)`.
- Add `DeleteRowButton` per row (superuser only); calls `deleteFund(r.fons)`; then:
  - Filter all `rawCC` entries with matching `fons` from state + update `localStorage.setItem("tc_rawCC", ...)`
  - Also filter matching entry from `fundMeta` state + update `localStorage.setItem("tc_fundMeta", ...)`
  - **Note: deleting a fund removes all its capital call and distribution history app-wide, including the main Dashboard. This is intentional.**
- Add "+ Nou fons" button (superuser only): reveals inline form with `fons` (text), `vcpe` (select: PE/VC/RE), `est` (select: Fons Primari/Fons de Fons/SOCIMI), `compromis` (number — user must always enter the **EUR-equivalent** amount regardless of currency; no conversion is performed), `divisa` (select: EUR/USD)
- On submit: calls `insertFund(...)`; receives rawCC-shaped row (key `any`, not `year`); appends to `rawCC` state + updates `localStorage.setItem("tc_rawCC", ...)`

### `src/components/PipelineFY26.jsx`
- **Step 1 — Remove the debounced `useEffect` that calls `fetch("/api/pipeline")`** entirely, before adding any `upsertPipelineDeal` calls. Both paths must never coexist.
- Gate all existing edit controls (`EditCell`, `EditableSelect`, delete `×`, "Afegir Fons" modal button) by **conditional rendering**: `isSuperuser ? <EditCell .../> : <span>{value}</span>`. Do not replace local components with `SharedComponents.EditableCell`.
- Field-level saves call `upsertPipelineDeal(deal)` (via `dealToRow` in db.js)
- **Replace the existing `add()` function** with an async function that: calls `insertPipelineDeal(deal)` (without client-side `Date.now()` id), awaits the returned row (which has the DB-assigned integer `id`), prepends it to `funds` state. The `Date.now()` id generation is removed entirely.
- Deleted deals call `deletePipelineDeal(id)` and remove from `funds` state

### `src/components/PortfolioCompaniesTab.jsx`
- Wrap all displayed fields with `EditableCell` (disabled when `!isSuperuser`); `onSave` calls `upsertCompany`
- "Nova participada" button (superuser only) → `AddRowModal`; `onSave`: parse → camelCase → client-side check if `nom` exists → show "Ja existeix una empresa amb aquest nom" if so → else call `insertCompany`
- On success: prepend returned row (with `id`) to local state + update `localStorage.setItem("tc_portfolioCompanies", ...)`
- `DeleteRowButton` per row; calls `deleteCompany(r.id)`; removes from local state + localStorage

### `src/components/SearchersTab.jsx`
- **Editable table: "Historial de Searchers" only** — driven by `historicData` state (loaded from `localStorage.getItem("tc_allSearchers")`, fallback `ALL_SEARCHERS`). The "Searchers Actius" table uses static `ACTIVE_SEARCHERS` and is **not** editable.
- Wrap displayed fields in the historic table with `EditableCell` (disabled when `!isSuperuser`); `onSave` calls `upsertSearcher`
- "Nou searcher" button (superuser only) → `AddRowModal`; `onSave`: parse → camelCase → client-side check if `nom` exists in `historicData` → show "Ja existeix un searcher amb aquest nom" if so → else call `insertSearcher`
- On success: prepend returned row (with `id`) to `historicData` state + update `localStorage.setItem("tc_allSearchers", ...)`
- `DeleteRowButton` per row; calls `deleteSearcher(r.id)`; removes from `historicData` + updates `localStorage.setItem("tc_allSearchers", ...)`
- Sankey / `scAcq` still derives from static `PORTFOLIO_COMPANIES` — **explicitly out of scope**

### `src/components/CompanyDetail.jsx`
- **Data loading**: change from static `PORTFOLIO_COMPANIES` import to `localStorage.getItem("tc_portfolioCompanies")` with `PORTFOLIO_COMPANIES` fallback. Hold in local `useState`.
- **Session sync**: `CompanyDetail` and `PortfolioCompaniesTab` hold independent state from localStorage. Edits in `CompanyDetail` are visible in `PortfolioCompaniesTab` only after re-mount. This is accepted.
- Quarterly KPI cells: wrap with `EditableCell` (disabled when `!isSuperuser`); `onSave` updates `quarters` in local state + `localStorage.setItem("tc_portfolioCompanies", ...)` + calls `upsertCompany`
- "Nou trimestre" (superuser only): small inline form with `q` (select with integer option values: `1`, `2`, `3`, `4` — displayed as "Q1"/"Q2"/"Q3"/"Q4") and `year` (number). On confirm, appends:
  ```js
  { q: `Q${q} ${year}`, rev: null, ebitda: null, dfn: null, revBudget: null, ebitdaBudget: null, dfnBudget: null }
  ```

---

## Data Layer (`src/db.js`)

### Mapping fixes (apply first)
- `rowToCompany`: add `id: r.id`
- `rowToSearcher`: add `id: r.id`
- `companyToRow`: already omits `id` — no change
- `loadAll()` line 73: add `estimatedClosing: r.estimated_closing ?? null` to pipeline mapping
- New `dealToRow(d)` / `rowToDeal(r)`:
  ```js
  // dealToRow (omit id on insert — pass undefined or exclude it)
  { name: d.name, amount: d.amount, currency: d.currency,
    geography: d.geography, strategy: d.strategy, sector: d.sector,
    status: d.status, canal: d.canal, active: d.active ?? true,
    estimated_closing: d.estimatedClosing ?? null }
  // rowToDeal
  { id: r.id, name: r.name, amount: r.amount, currency: r.currency,
    geography: r.geography, strategy: r.strategy, sector: r.sector,
    status: r.status, canal: r.canal, active: r.active,
    estimatedClosing: r.estimated_closing ?? null }
  ```

### Existing with logic change
- `upsertFundMeta` ✓ — no change
- `upsertCompany` ✓ — no change
- `upsertSearcher` — **update to use `searcher.id` directly** when present (since `rowToSearcher` now includes `id`): `supabase.from("searchers").update(searcherToRow(searcher)).eq("id", searcher.id)`. Remove the prior `SELECT id WHERE nom = ?` lookup step. This fixes `nom` edits which previously silently failed because the lookup found no match after the field changed.

### New insert functions
- `insertCompany(company)` → `companyToRow` → `.insert(...).select().single()`; returns `rowToCompany(data)`
- `insertSearcher(searcher)` → `searcherToRow` → `.insert(...).select().single()`; returns `rowToSearcher(data)`
- `insertPipelineDeal(deal)` → `dealToRow` (no `id` field) → `.insert(...).select().single()`; returns `rowToDeal(data)` with DB-assigned `id`
- `insertFund(fons, vcpe, est, compromisEur, divisa)`:
  - Derives `mes` using `MESOS[new Date().getMonth() + 1]` (MESOS is 1-indexed: index 0 is `""`, index 1 is `"Gen"` — use `getMonth() + 1` to avoid empty string for January)
  - Derives `year = new Date().getFullYear()` (integer), `fy = "FY " + year`
  - `capital_calls.id` is `BIGSERIAL PRIMARY KEY` — do not include `id` in the insert payload; DB assigns it automatically
  - Inserts into `capital_calls`: `{ fons, vcpe, est, cat:"Compromís", eur:compromisEur, divisa, mes, year, fy, tipus:vcpe, data: today ISO }`
  - Upserts into `fund_meta`: `.upsert({ fons, tvpi:null }, { onConflict:"fons" })`
  - Returns rawCC-shaped object with key `any` (not `year`): `{ fons, vcpe, est, cat:"Compromís", eur:compromisEur, divisa, mes, any:year, fy, tipus:vcpe, data:... }`

### New delete functions
- `deleteCompany(id)` → `.delete().eq("id", id)`
- `deleteSearcher(id)` → `.delete().eq("id", id)`
- `deletePipelineDeal(id)` → `.delete().eq("id", id)`
- `deleteFund(fons)` → two sequential `.delete()` calls: `capital_calls` first, then `fund_meta`. Supabase JS does not support client-side transactions. If the second delete fails, the fund's TVPI row will be orphaned in `fund_meta`. On any error, return the error to the caller; the caller (FundsIndex) should show an error toast and call `loadAll()` to re-sync state from the DB.

### New upsert
- `upsertPipelineDeal(deal)` → `dealToRow` (include `id`) → `.upsert(..., { onConflict:"id" })` on `pipeline`. Only call this on deals that have a DB-assigned integer `id` (never on deals with a `Date.now()` id — those no longer exist after the `add()` function is replaced).

---

## Schema Changes

Run in Supabase SQL editor:

```sql
-- 1. Make pipeline.id auto-increment
ALTER TABLE pipeline ALTER COLUMN id SET DATA TYPE BIGINT;
CREATE SEQUENCE IF NOT EXISTS pipeline_id_seq;
ALTER TABLE pipeline ALTER COLUMN id SET DEFAULT nextval('pipeline_id_seq');
ALTER SEQUENCE pipeline_id_seq OWNED BY pipeline.id;
SELECT setval('pipeline_id_seq', COALESCE((SELECT MAX(id) FROM pipeline), 0) + 1);

-- 2. Add estimatedClosing column to pipeline
ALTER TABLE pipeline ADD COLUMN IF NOT EXISTS estimated_closing TEXT;

-- 3. Add UNIQUE constraint to searchers.nom
ALTER TABLE searchers ADD CONSTRAINT searchers_nom_unique UNIQUE (nom);
```

**Existing constraints confirmed (no migration needed):**
- `fund_meta.fons TEXT PRIMARY KEY`
- `portfolio_companies.nom TEXT UNIQUE NOT NULL`
- `capital_calls.id BIGSERIAL PRIMARY KEY` — auto-increments; never pass `id` in insert payloads
- `pipeline.id INTEGER PRIMARY KEY` — the PRIMARY KEY constraint already exists; the migration above only changes the type and adds a sequence default

### Cache invalidation after `rowToCompany` / `rowToSearcher` fix

The existing `tc_portfolioCompanies` and `tc_allSearchers` localStorage values were serialized before the `id` field was added to `rowToCompany`/`rowToSearcher`. They contain objects without `id`. After applying the mapping fix, any data loaded from stale localStorage will have `id: undefined`, causing `deleteCompany(r.id)` to silently fail.

**Fix**: after deploying the mapping fix, the app's Supabase `loadAll()` on mount will overwrite both localStorage keys with correctly shaped data (including `id`). To ensure this happens immediately in the current session, `Dashboard.jsx`'s `loadAll()` effect must call `localStorage.setItem("tc_portfolioCompanies", ...)` and `localStorage.setItem("tc_allSearchers", ...)` after a successful load — which it already does. No extra action needed if `loadAll()` runs before any delete is attempted.

---

## Out of Scope

- Audit logs / change history
- Row-level permissions (all superusers can edit all data)
- Bulk edits or import override
- RLS policies (RLS remains disabled)
- Syncing `scAcq` / Sankey in `SearchersTab` with dynamically added companies
- Currency conversion for fund `compromis` input (user enters EUR-equivalent)
