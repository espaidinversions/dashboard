---
name: update-capital-calls
description: SOP for recording a new transaction in RAW_CC (capital calls, distributions, commitments)
type: project
---

# Update Capital Calls

**Trigger:** Use when recording any new fund transaction: capital call, distribution, commitment, return of capital.

## Steps

1. Open `src/data/capital-calls.js`
2. Add a row to the `RAW_CC` array:

```js
{
  fons: "Fund Name",      // string — exact fund name (slug derived from this)
  tipus: "Aportació",     // string — free-text label from source document
  cat: "Capital Call",    // enum — see allowed values below
  data: "2025-03-15",     // string "YYYY-MM-DD"
  mes: 3,                 // number — month (1–12), derived from data
  any: 2025,              // number — year, derived from data
  fy: "FY 2025",          // string — fiscal year, derived from data
  vcpe: "PE",             // enum — see allowed values below
  est: "Fons Primari",    // enum — see allowed values below
  eur: 100000.0,          // number — positive = outflow, negative = inflow
}
```

**`cat` values:** `"Capital Call"` | `"Distribució"` | `"Retorn Capital"` | `"Compromís"` | `"Altres"`

**`vcpe` values:** `"PE"` | `"VC"` | `"RE"`

**`est` values:** `"Fons Primari"` | `"Fons de Fons"` | `"SOCIMI"`

3. Navigate to `/fund/<slug>` in dev server — KPI cards and J-curve should reflect the new row

## Sign Convention

| Transaction | `eur` sign |
|---|---|
| Capital Call | **positive** (money out) |
| Compromís | **positive** |
| Distribució | **negative** (money in) |
| Retorn Capital | **negative** (money in) |

## Gotchas

- Distributions **must be negative** — `FundDetail.jsx` uses `Math.abs(r.eur)`, so sign drives KPI math
- `fons` must match exactly — a typo creates a ghost fund in `/investments`
- New fund: add a `Compromís` row first, or the Compromís KPI card shows `—`
- `mes`, `any`, `fy` must be derived from `data` explicitly — they drive fiscal year charts
