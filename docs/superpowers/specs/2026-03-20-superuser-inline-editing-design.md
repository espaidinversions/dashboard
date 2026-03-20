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

**Always-on inline editing** (Approach A). No edit mode toggle.

- Superusers: `EditableCell` is active — hover shows background hint, click opens input
- Regular users: `EditableCell` renders plain text (via `disabled` prop)
- Saves on Enter or blur; cancels on Escape; only calls `onSave` if value actually changed
- Consistent with existing FundsIndex TVPI behavior

---

## Editable Tables

| Table | Component | Add Pattern | Editable Fields |
|---|---|---|---|
| Funds | `FundsIndex` | Inline blank row | TVPI (already done) + all fund metadata |
| Pipeline deals | `PipelineFY26` | Inline blank row | name, amount, currency, geo, strategy, sector, status, canal |
| Portfolio companies | `PortfolioCompaniesTab` | Modal form | All fields: segment, ticket, multiples, operating metrics |
| Searchers | `SearchersTab` | Modal form | All fields: status, ticket, dates, escola, equity stake |
| Quarterly KPIs | `CompanyDetail` | Inline blank column | Rev, EBITDA, DFN, budget, margins per quarter |

All tables get a **delete** button per row (superuser only): trash icon → inline confirmation "Eliminar?" → removes from DB and local state.

---

## Component Changes

### `src/auth.jsx`
- Add `isSuperuser` to the context value: `isSuperuser = session?.user?.user_metadata?.role === "superuser"`

### `src/components/SharedComponents.jsx`
- `EditableCell`: add `disabled` prop — when true, renders plain text (no hover, no click)
- New `DeleteRowButton`: trash icon, superuser-only; shows inline "Eliminar?" confirmation before calling `onDelete()`
- New `AddRowModal`: generic modal form accepting a `fields` config array (`[{ key, label, type, options? }]`) and `onSave(values)` callback; used by PortfolioCompaniesTab and SearchersTab

### `src/components/FundsIndex.jsx`
- TVPI already editable — wire `disabled={!isSuperuser}`
- Add inline "+" row at bottom for superusers to create a new fund entry

### `src/components/PipelineFY26.jsx`
- All deal fields: wrap with `EditableCell` (disabled for non-superusers)
- Inline "+" row at bottom for new deals
- Delete button per row

### `src/components/PortfolioCompaniesTab.jsx`
- All displayed fields: wrap with `EditableCell`
- "Nova participada" button → opens `AddRowModal` with company fields config
- Delete button per row

### `src/components/SearchersTab.jsx`
- Key displayed fields: wrap with `EditableCell`
- "Nou searcher" button → opens `AddRowModal` with searcher fields config
- Delete button per row

### `src/components/CompanyDetail.jsx`
- Quarterly KPI cells: wrap with `EditableCell`
- "Nou trimestre" inline column at end of table
- Saves update the `quarters` JSONB array via `upsertCompany`

---

## Data Layer (`src/db.js`)

### New insert functions
- `insertCompany(company)` → insert into `portfolio_companies`, return inserted row
- `insertSearcher(searcher)` → insert into `searchers`, return inserted row
- `insertPipelineDeal(deal)` → insert into `pipeline`, return inserted row
- `insertFund(fons, vcpe, est)` → insert into `capital_calls` + `fund_meta`

### New delete functions
- `deleteCompany(id)` → delete from `portfolio_companies` by id
- `deleteSearcher(id)` → delete from `searchers` by id
- `deletePipelineDeal(id)` → delete from `pipeline` by id
- `deleteFund(fons)` → delete from `capital_calls` and `fund_meta` by fons

### New upsert functions (field-level saves)
- `upsertSearcher(searcher)` — upsert by nom
- `upsertPipelineDeal(deal)` — upsert by id

---

## No New Files

Everything extends existing components and `db.js`. `isSuperuser` is read directly from `useAuth()` inside each component — no prop drilling required.

---

## Out of Scope

- Audit logs / change history
- Row-level permissions (all superusers can edit all data)
- Bulk edits or import override
- RLS policies (RLS remains disabled for this single-org dashboard)
