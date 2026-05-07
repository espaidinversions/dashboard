# Recallable Capital — Design Spec

**Date:** 2026-04-24  
**Status:** Approved

---

## Overview

Distributions can have a recallable portion that goes back into a per-fund pool. Capital calls can optionally draw from that pool. This spec covers schema, form changes, and display.

---

## Schema

Three new nullable `NUMERIC` columns on the `capital_calls` table:

| Column | Used by | Description |
|---|---|---|
| `recallable` | Distributions | Recallable portion of the distribution |
| `non_recallable` | Distributions | Non-recallable portion of the distribution |
| `from_recallable` | Capital Calls | Amount drawn from the recallable pool |

**Migration:**
```sql
ALTER TABLE capital_calls ADD COLUMN recallable NUMERIC;
ALTER TABLE capital_calls ADD COLUMN non_recallable NUMERIC;
ALTER TABLE capital_calls ADD COLUMN from_recallable NUMERIC;
```

**Invariants (enforced in UI only):**
- Distributions: `recallable + non_recallable = eur`
- Capital calls: `from_recallable ≤ available pool at time of entry` (soft warning, not hard block)

**Pool balance per fund (computed, not stored):**
```
pool = SUM(recallable WHERE cat='Distribució') − SUM(from_recallable WHERE cat='Capital Call')
```

Existing rows default to NULL for all three columns — treated as 0 in aggregations.

---

## Distribution Form

When `cat = "Distribució"`, two new fields appear below the Import EUR field:

- **Recallable (€)** — numeric input
- **Non-recallable (€)** — numeric input; auto-fills as `eur − recallable` on blur, but remains editable

Live validation line beneath both fields:  
`€X recallable + €Y non-recallable = €Z total` — renders in red if they don't sum to `eur`.

Both fields are optional (default empty / NULL). If only `recallable` is entered, `non_recallable` auto-fills. If neither is entered, no validation error — fields are informational.

---

## Capital Call Form

A new optional "Capital Origin" section appears on every capital call entry form, below the existing fields.

**Fields:**
- **Committed (not called)** — read-only display of current uncalled commitment for the fund
- **From recallable pool** — optional numeric input; hint text shows `available: €X` (current pool balance); defaults to 0/empty

**Behaviour:**
- `from_recallable` is stored on the row.
- `from_committed` is NOT stored — it is always derived as `eur − from_recallable` where needed for display.
- No hard validation that `from_committed + from_recallable = eur`. The origin fields are informational tags on the capital call.
- If pool balance is 0, the "From recallable pool" input is shown but disabled with hint `no recallable capital available`.

---

## Display

### Fund Detail — Transactions Table

New **"Recallable"** column added to the transactions table:

| Row type | Display |
|---|---|
| Distribution with recallable set | `€X rec / €Y non-rec` |
| Capital call with `from_recallable > 0` | `€X from pool` |
| All other rows | — (empty) |

### Fund Detail — Summary / Header

A **"Recallable pool"** KPI chip added to the fund summary row:
- Label: `Recallable pool`
- Value: `€X` (current pool balance)
- Hidden (or shown as `€0`) when pool is zero.

---

## Out of Scope

- No DB-level constraint enforcing the recallable + non-recallable sum.
- No automatic linking between a specific capital call and specific prior distributions (pool is aggregate per fund).
- No effect on uncalled commitment calculations — recallable draws are a separate track.
- No historical backfill of `recallable`/`non_recallable` on existing distribution rows.
