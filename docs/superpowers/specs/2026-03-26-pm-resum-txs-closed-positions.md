# Spec: PM Resum — Monthly Transactions & Closed Position Pages
**Date:** 2026-03-26
**Status:** Approved

---

## Overview

Two related improvements to the Public Markets section:

1. **Monthly transactions accordion** — add a new condensed monthly accordion section to the Resum tab (PublicMarketsTab.jsx), below the existing manager table. The dedicated Transaccions tab (PMTransaccionsTab.jsx) is unchanged. This is a new section, not a replacement.
2. **Closed position detail pages** — enrich `PM_CLOSED` with full position data so each closed vehicle gets a proper `PMPositionDetail` page (same fidelity as open positions), including historic price chart. Add clickable navigation to those pages from the closed positions list in `PMTipusTab`.

---

## Feature 1 — Monthly Transactions Accordion

### Current state
The Resum tab (`PublicMarketsTab.jsx`, 695 lines) shows portfolio summary + manager expandable table. It does NOT currently show transactions. The dedicated Transaccions tab (`PMTransaccionsTab.jsx`) already has a full monthly accordion with bar chart, `+ Nova` modal, and all filters — that tab is unchanged.

### Target state
A new condensed transactions section added BELOW the manager table in PublicMarketsTab.jsx. A two-level accordion:

**Level 1 — Month rows** (sorted newest-first):
- Month label (e.g., "Mar 2026")
- Buy count + total value
- Sell count + total value
- Click to expand

**Level 2 — Individual transaction rows** (same columns as today):
- Data · Nom · Tipus · Acció · Units · NAV · Valor · Custodi

**Header bar**:
- Section label + `+ Nova` button — clicking switches `mercatsPublicsTab` state to `'transaccions'`; `PMTransaccionsTab` auto-opens its modal on mount (via lifted state or URL param). No duplicate modal in PublicMarketsTab.
- Action chips: Totes / Compres / Vendes
- Custodian chips

**Edge cases:**
- Transactions with no `date` → grouped into a "Sense data" bucket at the bottom
- Filters apply before grouping (filtering `buy` collapses months that have only sells, etc.)

**Filter mental model note:** Filters now collapse/hide whole months (not individual rows). This is the correct behavior and matches what users expect from a grouped view — if a month has no matching transactions, it disappears. No UX affordance needed for this; it's intuitive.

**Resolved design decisions:**
- **Default expand state:** All months collapsed on mount. `openMonths` state initializes as `new Set()`. Do NOT use `resolvedOpen` pattern from `PMTransaccionsTab` (which auto-opens the first month) — start fully collapsed.
- **Month row content:** "Compres: N · €XK  Vendes: N · €XK" — count + total for each side. Net flow badge optional (shown only if there are both buys and sells in the month).
- **`useMemo` required:** Both `filtered` and `byMonth` must be memoized. `filtered = useMemo(() => ..., [actionFilter, custodianFilter])` (PM_TRANSACTIONS is static); `byMonth = useMemo(() => ..., [filtered])` — `filtered` here is the memoized value from the first useMemo, not an inline-computed array.
- **Field name:** The transaction field is `t.action` (English: `"buy"` / `"sell"`). "Acció" is the display column label only. Do not use `t.accio`.
- **DRY:** Accordion logic (byMonth, openMonths, toggleMonth) is intentionally inline in PublicMarketsTab. Extract to a shared hook if a 3rd accordion is added.

### Design system references

- **Expand icon:** Unicode `▸` / `▾` — same as `PublicMarketsTab` manager row expand (line ~577). No SVG icon needed.
- **Buy/sell pills:** inline `<span>` with background tint — `#E8F8E8` / `#1C6B1D` for buys, `#FDECEA` / `#C62828` for sells (same as `PositionTxHistory` action badge). Not `PctChip`, not `Badge` — new inline span, same colors.
- **Net flow badge:** `PctChip`-style span — green if net > 0, red if net < 0, `tc.textLight` if zero.
- **Row colors:** reuse `MensualTab` theme-aware variables pattern — `greenRow1` for expanded month header, `rowMain`/`rowAlt` zebra for Level 2 tx rows.
- **Font:** DM Mono for all numeric columns (Valor, NAV, Units), inherit for text columns.

### Information hierarchy — Month row (Level 1)

```
[▸/▾]  Mar 2026           [Compres: 3 · €245K]  [Vendes: 1 · €80K]  [Net: +€165K]
```

- **Primary (left):** expand icon + month label — largest, navy, bold
- **Secondary (center):** buy pill (green tint) + sell pill (red tint) — compact, 10px
- **Tertiary (right):** net flow badge — green if positive, red if negative
- Row background: neutral (not colored). Color lives in the pills/badge, not the row bg.
- Expand icon: `▸` collapsed → `▾` expanded (same pattern as MensualTab + PublicMarketsTab manager rows)

### Responsive behavior

- **Month rows (Level 1):** always full-width, no horizontal scroll. Month label truncates if too long.
- **Transaction rows (Level 2):** wrapped in `overflowX: auto` container — same pattern as `PMTransaccionsTab` and the manager table in `PublicMarketsTab`. Month rows stay pinned above the scroll area.
- **Touch targets:** month row click target = full row height, minimum 44px (matches existing hoverable rows).
- **Accessibility:** month rows have `role="button"` and `aria-expanded` toggled on click/Enter/Space. Level 2 table has standard table semantics.

### Information hierarchy — Transaction row (Level 2)

Same columns as existing flat table, visually subordinated:
- Left indent: 28px padding-left to signal hierarchy
- Row background: alternate light/dark zebra (matches `rowMain`/`rowAlt` in MensualTab)
- Column alignment: Data (right), Nom (left), Acció (center badge), Units/NAV/Valor (right mono), Custodi (left)

### Interaction states

| State | What user sees |
|---|---|
| **All filters match → months exist** | Month accordion rows, newest-first |
| **Filter hides all months** (e.g. "Compres" with no buys) | "Sense transaccions amb aquest filtre." in italic — same style as PositionTxHistory empty state |
| **No transactions at all** (`PM_TRANSACTIONS` empty) | "Sense moviments registrats." — same style |
| **Month expanded** | Level 2 rows slide in below the month row; expand icon flips to ▾ |
| **Month collapsed** | Level 2 rows hidden; expand icon shows ▸ |
| **"Sense data" bucket** | Shown at bottom if any tx lacks a date; label "Sense data" in textLight italic |

No async/loading state — `PM_TRANSACTIONS` is static imported data.

### Files changed
- `src/components/PublicMarketsTab.jsx` — add new accordion section below manager table; no new file needed

---

## Feature 2 — Closed Positions with Full Data

### Current state
`PM_CLOSED` entries have only `{ any, nom, isin, tipus }`. The detail page at `/mercats-publics/:isin` renders but shows all KPIs as "—" and no charts.

### Target state
Each closed position has the same data fidelity as an open position, including a historic price chart for its holding period.

---

### 2a. Script — `scripts/enrich_closed_positions.py`

**Inputs:**
- `src/data/pmTransactions.js` (parsed)
- `src/data/publicMarkets.js` — existing `PM_CLOSED` array

**Per-ISIN computed fields (from transactions):**

| Field | Derivation |
|---|---|
| `gestor` | gestor from the first (oldest) buy transaction for this ISIN |
| `custodian` | custodian from the first (oldest) buy transaction for this ISIN |
| `divisa` | default `"EUR"` |
| `dataCompra` | min date of buy transactions |
| `costEur` | sum of buy `valueEur` |
| `unitats` | sum of buy `units` |
| `costInici` | `costEur / unitats` |
| `valorMercat` | sum of sell `valueEur` (realized); fallback 0 if no sell found |
| `rendInici` | `(valorMercat − costEur) / costEur × 100` |

**Per-ISIN price history:**
- Attempt price fetch for each closed ISIN using the same yfinance/API sources as `etf_fetch_prices.py` / `fund_fetch_prices.py`
- Fetch period: `dataCompra` → Dec 31 of `any` (year closed)
- Multiply daily/monthly price by `unitats` to get market-value series
- For ISINs with no price feed: skip silently; the chart is hidden by existing `valueData = null` guard
- **Coverage note:** Most `PM_CLOSED` entries are UCITS mutual funds — yfinance covers ETFs and equities well but has low coverage for SICAV/UCITS funds. Expect price charts for a minority of closed positions. This is acceptable; the detail page degrades gracefully.

**Duplicate ISIN script caveat:** For ISINs that appear in `PM_CLOSED` multiple times (position reopened and closed in different years), the script sums all transactions across years — producing a blended figure. The script should emit a warning line for these ISINs so they can be reviewed manually before merging.

**Outputs (two separate files for review before merging):**
1. `scripts/out/pm_closed_enriched.js` — enriched `PM_CLOSED` array (drop-in replacement for the block in `publicMarkets.js`); Excel-sourced fields (`rend20XX`, `costAnual`) left as `null` for manual fill-in
2. `scripts/out/pm_closed_values.js` — `PM_CLOSED_VALUES` export (same shape as `PM_VALUES`): `{ [isin]: { [custodian]: [{date, value}] } }`

**Why separate output files:** avoids auto-overwriting `publicMarkets.js` (80+ entries) or `portfolioValues.js` before review. The `scripts/out/` directory should be in `.gitignore`.

---

### 2b. `PM_CLOSED` schema additions

```js
{
  // existing
  any: 2022,
  nom: "...",
  isin: "...",
  tipus: "RV",
  // new — script-derived
  gestor: "CaixaBank",
  custodian: "CaixaBank",
  divisa: "EUR",
  dataCompra: "2020-01-15",
  costEur: 150000,
  unitats: 1500,
  costInici: 100.0,
  valorMercat: 142000,   // total proceeds = sum of ALL sell valueEur (includes partial redemptions). Correct: represents total economic return on capital.
  rendInici: -5.33,
  // new — manual from Excel (null until filled)
  costAnual: null,
  rend2019: null,
  rend2020: null,
  rend2021: null,
  rend2022: null,
}
```

No `pes` field (not meaningful for closed positions).

---

### 2c. `PMPositionDetail` changes

Four adjustments when `isClosed === true`:

1. "Valor mercat" KPI label → "Valor tancament"
2. Hide "Pes cartera" KPI card
3. Add `dataCompra` and "Any tancament" rows to the metadata info table (already shows `isClosed` badge)
4. **Navigation entry point** — in `PMTipusTab.jsx`, make closed position rows clickable: `onClick={() => navigate('/mercats-publics/' + p.isin)}` with `cursor: pointer`. Without this, the enriched detail pages are orphaned (no navigation path to them).

**Historic price chart:** `PMPositionDetail` already reads `PM_VALUES[isin]` in the `valueData` useMemo. Extend the lookup to fall back to `PM_CLOSED_VALUES[isin]` when `isClosed`:
```js
const custodianData = PM_VALUES[isin] ?? (isClosed ? PM_CLOSED_VALUES[isin] : null);
```
The rest of the chart logic is unchanged.

---

### 2d. New data export — `src/data/pmClosedValues.js`

After user review and merge of `scripts/out/pm_closed_values.js`:
```js
// Auto-generated by scripts/enrich_closed_positions.py
export const PM_CLOSED_VALUES = {
  "LU0113258742": {
    "UBS": [{ date: "2020-01-31", value: 631000 }, ...]
  },
  ...
};
```

Imported in `PMPositionDetail.jsx` alongside `PM_VALUES`.

---

## Routing

Closed positions already route via `/mercats-publics/:isin`. `PMPositionDetail` does ISIN-based lookup: `PM_POSITIONS.find(p => p.id === id)`, falling back to `PM_CLOSED.find(p => p.isin === id)`. No new routes needed.

Navigation entry point is added in `PMTipusTab.jsx` (see 2c item 4).

**Duplicate ISIN caveat:** some ISINs appear in `PM_CLOSED` for multiple years (position reopened and closed again). `PM_CLOSED.find()` returns the first match. Pre-existing limitation; acceptable.

---

## File map

| File | Change |
|---|---|
| `src/components/PublicMarketsTab.jsx` | Add condensed accordion section below manager table |
| `src/components/PMPositionDetail.jsx` | 4 tweaks for `isClosed`; import `PM_CLOSED_VALUES` |
| `src/components/PMTipusTab.jsx` | Make closed position rows clickable → `/mercats-publics/:isin` |
| `src/data/publicMarkets.js` | Replace `PM_CLOSED` block with enriched version (post-script) |
| `src/data/pmClosedValues.js` | New file — price series for closed positions |
| `scripts/enrich_closed_positions.py` | New script |
| `scripts/out/pm_closed_enriched.js` | Script output (review artifact, not committed) |
| `scripts/out/pm_closed_values.js` | Script output (review artifact, not committed) |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found | 10 findings, 3 critical resolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAN | 5 issues found, 0 unresolved, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAN | score: 5/10 → 8/10, 5 decisions |

**VERDICT:** ENG + DESIGN CLEARED — ready to implement.
