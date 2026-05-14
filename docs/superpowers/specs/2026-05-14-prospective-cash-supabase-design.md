# Prospective Cash Model — Supabase Integration Design

## Goal

Replace the hardcoded `prospectiveCashData.js` forecast inputs with live reads from the `prospective_cash_forecasts` Supabase table. Admin edits in the editor panel persist to Supabase. Actuals continue to come from the existing capital calls log. No data redundancy between the JS file and the DB.

## Context

The `prospective_cash_forecasts` table already exists in the migration (with seed data) but has not been applied to Supabase yet. The frontend tab (`ProspectiveCashTab.jsx`) is fully built but currently reads from `prospectiveCashData.js` (hardcoded) and saves editor state to `localStorage`. The goal is to remove those two intermediate stores and wire everything to Supabase.

## What Is Not Changing

- `deriveProspectiveCashRows(editorData, actualCalls)` — core model function is unchanged.
- `Dashboard.jsx` and `useDashboardData.js` — no changes; the tab stays self-contained.
- RLS policy — writes are superuser-only. Non-admins see a clear error on save (correct behavior).
- Capital calls actuals flow — already read from Supabase via `rawCapitalCalls` prop.

## Single Source of Truth

| Data | Source |
|------|--------|
| Fund manager forecast amounts (calls & dist) | `prospective_cash_forecasts` Supabase table |
| Actual capital calls & distributions | `capital_calls` (already wired) |
| Committed capital per fund | Derived from `capital_calls` (cat = "Compromís") — already works |
| USD-denominated funds list | Inline constant in `prospectiveCashModel.js` (static metadata, not DB) |

`prospectiveCashData.js` is deleted. `localStorage` persistence is removed. No dual-source confusion.

## Architecture

### 1. Migration

Apply `supabase/migrations/20260513000000_prospective_cash_forecasts.sql` to the live database. This creates the table and seeds all fund forecasts.

### 2. `db.js` — Two New Functions

**`fetchProspectiveCashForecasts()`**
```js
SELECT vehicle_id, fons, flow_type, year, amount
FROM prospective_cash_forecasts
ORDER BY fons, flow_type, year
```
Returns `{data: ProspectiveCashRow[], error}`.

**`upsertProspectiveCashForecasts(rows)`**
```js
UPSERT INTO prospective_cash_forecasts (vehicle_id, fons, flow_type, year, amount, updated_at)
ON CONFLICT (vehicle_id, flow_type, year)
```
Takes `{vehicle_id, fons, flow_type, year, amount}[]`. RLS blocks non-admins. Returns `{error}`.

### 3. `prospectiveCashModel.js` — Transformer + Cleanup

**Add `forecastRowsToEditorData(rows)`**

Groups Supabase rows into the `{years, funds}` shape that `deriveProspectiveCashRows` expects:
```js
{
  years: [2022, 2023, ..., maxYear + 3],   // derived from data range
  funds: {
    "Arcano XII": {
      model_calls: { 2024: 500000, 2025: 300000 },
      model_dist:  { 2026: 200000 }
    },
    ...
  }
}
```

**Remove:**
- `PROSPECTIVE_CASH_STORAGE_KEY` export
- `PROSPECTIVE_CASH_DEFAULT_EDITOR_DATA` export
- `cloneProspectiveCashEditorData` export
- `normalizeProspectiveCashEditorData` export (replaced by `forecastRowsToEditorData`)
- Import of `prospectiveCashData.js`

**Keep as inline constant** (extracted from `prospectiveCashData.js`):
```js
export const PROSPECTIVE_CASH_USD_FUNDS = new Set([/* same list as before */]);
```

### 4. `ProspectiveCashTab.jsx` — New Data Lifecycle

**On mount:**
```
fetchProspectiveCashForecasts() → forecastRowsToEditorData(rows) → editorState
```

**Editor save (admin only):**
```
editorState → rows (vehicle_id, fons, flow_type, year, amount) → upsertProspectiveCashForecasts(rows)
```

**Remove:**
- `localStorage` read on init (`getItem(PROSPECTIVE_CASH_STORAGE_KEY)`)
- `localStorage` write on save (`setItem(...)`)
- Imports of `PROSPECTIVE_CASH_STORAGE_KEY`, `PROSPECTIVE_CASH_DEFAULT_EDITOR_DATA`, `cloneProspectiveCashEditorData`, `normalizeProspectiveCashEditorData`

**Add:**
- `useEffect` that fetches on mount, sets loading state
- Error banner if fetch fails
- Import of `fetchProspectiveCashForecasts`, `upsertProspectiveCashForecasts`
- Import of `forecastRowsToEditorData`

The `vehicle_id` for each fund is stored on the raw Supabase rows. The editor state must track it (keyed by `fons`) so that saves produce valid upsert rows with the correct `vehicle_id`.

### 5. `prospectiveCashData.js` — Deleted

File is removed. Nothing imports it after the changes above.

## Data Shape Notes

The `forecastRowsToEditorData` transformer does not reconstruct `committed` or `vintage` — those fields are either derived from `capital_calls` (committed) or unused by the model. The `funds` entries only need `model_calls` and `model_dist`.

`years` is derived as: `[minYear, ..., maxYear + 3]` where min/max come from the actual row data. This avoids any hardcoded year range.

## Error Handling

- Fetch error on load: show inline error message in the tab, do not crash.
- Upsert error on save (non-admin): show the Supabase error message to the user.
- Empty fetch result: show empty state (no forecasts loaded).

## Files Changed

| File | Action |
|------|--------|
| `src/db.js` | Add `fetchProspectiveCashForecasts`, `upsertProspectiveCashForecasts` |
| `src/data/prospectiveCashModel.js` | Add `forecastRowsToEditorData`; remove redundant exports; inline USD funds list |
| `src/components/ProspectiveCashTab.jsx` | Wire fetch/upsert; remove localStorage; track vehicle_id in editor state |
| `src/data/prospectiveCashData.js` | **Deleted** |
| `supabase/schema.sql` | Add `prospective_cash_forecasts` table definition (mirrors migration) |
