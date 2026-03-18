---
name: add-portfolio-company
description: SOP for adding a new acquired company to PORTFOLIO_COMPANIES in src/data/searchers.js
type: project
---

# Add Portfolio Company

**Trigger:** Use this skill when adding a new company to the portfolio (post-acquisition).

## Steps

1. Open `src/data/searchers.js`
2. Add an entry to the `PORTFOLIO_COMPANIES` array with all required fields:

```js
{
  nom: "Company Name",     // string — display name and URL slug source
  tipus: "SF",             // "SF" (Search Fund) or "PE" (Private Equity)
  segment: "Software",     // industry segment string
  ticket: 400000,          // number — investment in EUR
  tvpi: 1.23,              // number or null
  rvpiEur: 400000,         // number or null — residual value in EUR
  dpiEur: 0,               // number or null — distributed value in EUR
  mesosOperant: 24,        // number or null — months since acquisition
  dataCompr: "2023-01-15", // string "YYYY-MM-DD" or null
  multEntry: 5.0,          // number or null — entry EV/EBITDA multiple
  origen: "Equity Gap",    // string or null — deal source
  entrepreneurs: "Name",   // string or null — founder(s)
  geo: "ES",               // ISO-2 country code or null
  rev: 5000000,            // number or null — LTM revenue (company native currency)
  ebitda: 800000,          // number or null — LTM EBITDA (company native currency)
  dfn: 1000000,            // number or null — net debt (company native currency)
  grossEV: 10000000,       // number or null — gross EV (company native currency)
}
```

3. Check for slug collision: `slugify(nom)` must not match any existing company slug. `slugify` is in `src/utils.js`: lowercase, remove accents, replace non-alphanumeric with `-`.
4. Start dev server: `npm run dev`
5. Navigate to `/investments` — new company should appear in the table
6. Navigate to `/company/<slug>` — verify KPI cards, operative metrics, and entry info

## Gotchas

- `rvpiEur` and `dpiEur` display as `0` if null — set explicitly to avoid misleading KPI cards
- `geo` drives `FlagImg` — ISO-2 codes: `"ES"`, `"US"`, `"EN"` (UK), `"DE"`, `"IT"`, `"FR"`, `"PT"`
- Slug collision: rename `nom` in source data if two companies produce the same slug
- `rev`, `ebitda`, `dfn`, `grossEV` are in **company native currency**, not EUR
