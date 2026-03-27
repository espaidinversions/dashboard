# Public Markets Holdings Tab — Design Spec

**Goal:** Add a "Posicions" sub-tab to Mercats Públics showing all 59 individual positions (51 RV + 8 RF) extracted from the Excel portfolio sheet, grouped by asset type with cost basis, market value, P&L, and annual cost.

**Architecture:** Extract position data via Node script → static `PM_POSITIONS` array in existing data file → new `HoldingsTable` component → sub-tabs wired in Dashboard.jsx. No closed positions exist yet; toggle reserved for future use.

**Tech Stack:** React 18, existing theme/utils patterns, no new dependencies.

---

## 1. Data Extraction — `src/data/publicMarkets.js`

### Source

Excel: `Mercats Públics/Resum Financer Espai 2026_vClaudeRoberto.xlsx`
- Sheet `ETf's Espai RV` — 51 data rows (row index 1–51; row 52 is totals, skip it)
- Sheet `ETf's Espai RF` — 8 data rows (row index 1–8; row 9 is totals, skip it)

Use `XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })` to get raw arrays.

### Column mapping — RV sheet (0-indexed)

| Index | Excel header | JS field | Notes |
|-------|-------------|----------|-------|
| 0 | Banc | gestor | "BANKINTER" for Abel rows; null for others — see Gestor inference |
| 1 | DIVISA | divisa | "EUR" / "USD" |
| 3 | Nom | nom | ETF/fund name |
| 4 | Data Compra | dataCompra | Excel serial integer → ISO date (see Date handling) |
| 5 | Cost anual | costAnual | see costAnual normalisation below |
| 6 | ISIN | isin | `.trim()` required — some rows have leading `\r\n` or `\t` |
| 7 | Volatilitat 3a | vol3a | nullable float — **extracted but not stored in PM_POSITIONS** |
| 8 | Nº titols | unitats | share count |
| 9 | cost inici | costInici | cost per unit |
| 10 | Valor de Cost en EUR | costEur | total acquisition cost in EUR |
| 25 | Valor mercat en eur | valorMercat | current market value in EUR |
| 26 | Pes % | pes | weight % (e.g. 1.7 means 1.7%) |
| 28 | Rend. des d'inici viu | rendInici | since-inception % return; nullable |
| 29 | Rend 2026 | rend2026 | nullable |
| 30 | Rend 2025 | rend2025 | nullable |
| 31 | Rend 2024 | rend2024 | nullable |
| 32 | Rend 2023 | rend2023 | nullable |

### Column mapping — RF sheet (0-indexed)

The RF sheet has no `Banc` column 0; every field is shifted left by one compared to RV. The layout is:

| Index | Excel header | JS field | Notes |
|-------|-------------|----------|-------|
| 0 | DIVISA | divisa | "EUR" / "USD" |
| 1 | Tipus | — | always "RF", used to confirm sheet |
| 2 | Nom | nom | ETF/fund name |
| 3 | Data Compra | dataCompra | Excel serial for rows 1–7; text string for row 8 (see Date handling) |
| 4 | Banc | gestor | "BANKINTER" for Abel rows; null for others |
| 5 | Cost anual | costAnual | see costAnual normalisation below |
| 6 | ISIN | isin | `.trim()` required |
| 7 | Volatilitat 3a | vol3a | nullable — **extracted but not stored in PM_POSITIONS** |
| 8 | Nº titols | unitats | share count |
| 9 | cost inici | costInici | cost per unit |
| 10 | Valor de Cost en EUR | costEur | total acquisition cost in EUR |
| 25 | Valor mercat en eur | valorMercat | current market value in EUR |
| 26 | Pes % | pes | weight % |
| 28 | Rend. des d'inici viu | rendInici | nullable |
| 29 | Rend 2026 | rend2026 | nullable |
| 30 | Rend 2025 | rend2025 | nullable |
| 31 | Rend 2024 | rend2024 | nullable |
| 32 | Rend 2023 | rend2023 | nullable |

Columns 11–24 are intermediate valuation columns (historical year-end values) — skip them.

### Date handling

- **Normal rows (RV all, RF rows 1–7):** `dataCompra` is an Excel serial integer (e.g. `45372`). Convert with:
  ```js
  const d = XLSX.SSF.parse_date_code(serial);
  dataCompra = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  ```
- **RF row 8 only:** `dataCompra` is a text string like `"17/08/2022 i 08/11/2022"`. Extract the first date:
  ```js
  const [day, month, year] = raw.split(' i ')[0].split('/');
  dataCompra = `${year}-${month}-${day}`;
  ```
- Detect which case applies by checking `typeof raw === 'number'`.

### `costAnual` normalisation

The Excel stores TER values inconsistently — sometimes as a fraction (0.0020 = 0.20%) and sometimes as a percentage already (0.20). Normalise rule: **if `raw < 0.10`, multiply by 100; otherwise use as-is.** The threshold 0.10 cleanly separates fractions (max realistic TER as fraction ≈ 0.02) from percentages (min realistic TER as % ≈ 0.06).

### Gestor inference

There are **no separator rows** between manager groups. Gestor is inferred in two steps:

1. **Direct:** If `Banc` column is non-null and equals `"BANKINTER"` → `gestor = "Abel Font"`.
2. **By sum matching:** For null-Banc rows, the extraction script accumulates running `valorMercat` sums. After extracting all rows, compare each candidate group's sum against the known manager totals from `PM_MANAGERS`:
   - CaixaBank RV: `8_037_347`
   - UBS RV: `10_704_128`
   - CaixaBank RF: `3_990_758`
   - UBS RF: `2_220_845`

   **Expected row ordering (consecutive null-Banc groups):**
   - RV sheet: CaixaBank block first, then UBS block, then Abel Font (BANKINTER) rows at the end.
   - RF sheet: CaixaBank block first, then UBS block, then Abel Font (BANKINTER) rows at the end.

   A ±1 000 EUR tolerance on sum matching is acceptable (rounding from Excel display values). The script should print subtotals by consecutive null-Banc groups so the implementer can manually verify the assignment and hardcode `gestor` in the output array. This is a one-time extraction — manual verification is acceptable.

### `PM_POSITIONS` schema

```js
// Append to src/data/publicMarkets.js
export const PM_POSITIONS = [
  {
    id: "ishares-msci-world",   // slugify(nom): nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")
    nom: "iShares MSCI World",
    gestor: "CaixaBank",        // "CaixaBank" | "UBS" | "Abel Font"
    isin: "IE00B4L5Y983",       // trimmed
    tipus: "RV",                // "RV" | "RF" (from sheet name, not column)
    divisa: "EUR",
    dataCompra: "2021-03-12",   // ISO date string
    unitats: 1240,
    costInici: 90.65,           // cost per unit in EUR
    costEur: 112400,            // total acquisition cost in EUR
    valorMercat: 134200,        // current market value in EUR
    pes: 1.7,                   // portfolio weight %
    rendInici: 19.4,            // % since inception; null if unavailable
    rend2026: -1.2,             // null if unavailable
    rend2025: 9.5,
    rend2024: 17.0,
    rend2023: null,
    costAnual: 0.20,            // TER % (normalised — 0.20 means 0.20%)
  },
  // ... 58 more entries
];
```

### WAM and Andbank

Not present in the ETF sheets. Excluded from `PM_POSITIONS`. `HoldingsTable` renders a footnote explaining this.

---

## 2. Navigation — `src/components/Dashboard.jsx`

### New state (add near `inversionsSubTab` — skip if already present)

```js
const [mercatsPublicsTab, setMercatsPublicsTab] = useState("resum");
```

> This state may already exist from prior navigation work. Search for `mercatsPublicsTab` before adding.

### New import (add after PublicMarketsTab import)

```js
import { HoldingsTable } from "./HoldingsTable.jsx";
```

### Sub-tab bar

`section === "mercats-publics"` is equivalent to `tab === "mercats-publics"` (see `section` derivation on line 407). Add this sub-tab bar immediately before the Real Estate sub-tab bar block (look for the comment `{/* ── Sub-tabs (Real Estate) ── */}`):

```jsx
{/* ── Sub-tabs (Mercats Públics) ── */}
{section === "mercats-publics" && (
  <div className="tab-bar no-print" style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "0 32px", display: "flex", gap: 0 }}>
    {[{ id: "resum", label: "Resum" }, { id: "posicions", label: "Posicions" }].map(t => (
      <button key={t.id} onClick={() => setMercatsPublicsTab(t.id)}
        style={{ background: "none", border: "none", borderBottom: `2px solid ${mercatsPublicsTab === t.id ? tc.green : "transparent"}`, padding: "11px 20px", cursor: "pointer", fontSize: 12, fontWeight: mercatsPublicsTab === t.id ? 600 : 400, color: mercatsPublicsTab === t.id ? tc.navy : tc.textMid, fontFamily: "inherit", transition: "color 0.15s, border-color 0.15s", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
        {t.label}
      </button>
    ))}
  </div>
)}
```

### Tab panel render

**Replace** the existing single line (currently around line 590):
```jsx
{tab === "mercats-publics" && <div className="tab-panel"><PublicMarketsTab /></div>}
```

**With** these two conditional blocks:
```jsx
{tab === "mercats-publics" && mercatsPublicsTab === "resum" && (
  <div className="tab-panel"><PublicMarketsTab /></div>
)}
{tab === "mercats-publics" && mercatsPublicsTab === "posicions" && (
  <div className="tab-panel"><HoldingsTable /></div>
)}
```

---

## 3. Component — `src/components/HoldingsTable.jsx`

```js
import { PM_POSITIONS } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM } from "../utils.js";
```

No props. Uses `useTheme()` for colors.

### Layout

```
Card container (same card style as other tab sections)
  [Section header row: "Renda Variable · 51 posicions · 34.5M€"]
  [Data rows — sorted by valorMercat desc]
  [Section header row: "Renda Fixa · 8 posicions · 5.2M€"]
  [Data rows — sorted by valorMercat desc]
  [Footnote: WAM i Andbank note]
```

### Columns (11 total)

| # | Header | Value | Align | Style |
|---|--------|-------|-------|-------|
| 1 | Nom | `m.nom` | left | bold, `tc.text` |
| 2 | Gestor | `m.gestor` | left | small (11px), `tc.textLight` |
| 3 | ISIN | `m.isin` | left | monospace, 10px, `tc.textLight` |
| 4 | Data compra | `m.dataCompra` | right | 10px, `tc.textLight` |
| 5 | Unitats | `m.unitats.toLocaleString("ca-ES")` | right | `unitats` is always an integer (whole shares); no fractional units in this portfolio |
| 6 | Cost | `fmtM(m.costEur)` | right | — |
| 7 | Valor mercat | `fmtM(m.valorMercat)` | right | bold, `tc.navy` |
| 8 | P&L | `m.rendInici != null ? (m.rendInici >= 0 ? "+" : "") + m.rendInici.toFixed(2) + "%" : "—"` | right | green if >0, red if <0, `tc.textLight` if null/zero |
| 9 | Pes % | `m.pes.toFixed(1) + "%"` | right | `tc.textLight` |
| 10 | Cost anual | `m.costAnual != null ? m.costAnual.toFixed(2) + "%" : "—"` | right | `tc.textLight` |
| 11 | ★ | `<a href={morningstar_url} target="_blank">★</a>` | center | `#E8A020`; hidden if isin null |

Morningstar URL: `https://www.morningstar.es/es/search/results.aspx?keyword=${m.isin}`

### Section header row

`useTheme()` also returns `dark` (boolean). Use it to select dark-mode-safe backgrounds:

```jsx
<tr style={{ background: t === "RV"
  ? (dark ? "#1E2E3D" : "#E6EDF3")
  : (dark ? "#2E2800" : "#FFF8E1") }}>
  <td colSpan={11} style={{ padding: "6px 10px", fontWeight: 700, fontSize: 12,
    color: t === "RV" ? tc.navy : "#7A6000" }}>
    {t === "RV" ? "Renda Variable" : "Renda Fixa"} · {count} posicions · {fmtM(total)}  {/* fmtM produces e.g. "34.52M€" — two decimal places */}
  </td>
</tr>
```

### Footnote

```jsx
<div style={{ fontSize: 10, color: tc.textLight, marginTop: 12, fontStyle: "italic" }}>
  WAM (€6.1M) i Andbank (€6.1M) gestionats directament pel gestor — posicions individuals no disponibles.
</div>
```

### Responsive

Outer wrapper: `<div style={{ overflowX: "auto" }}>`. Table uses `border-collapse: collapse`, `font-size: 12px`, `width: 100%`, `min-width: 900px`.

---

## 4. File Map

| File | Action |
|------|--------|
| `src/data/publicMarkets.js` | Modify — append `export const PM_POSITIONS = [...]` |
| `src/components/HoldingsTable.jsx` | Create — holdings table component |
| `src/components/Dashboard.jsx` | Modify — state, import, sub-tab bar, replace render line |

One-time extraction script (not committed to repo): save as `extract-positions.mjs`, requires `xlsx` (`npm install xlsx` if not already present), run with `node extract-positions.mjs`. Copy console output into `publicMarkets.js`.

---

## 5. Out of Scope (future)

- Closed/liquidated positions toggle (no data yet)
- Live NAV refresh via ISIN scraping
- Column sorting by clicking headers
- Morningstar embedded rating stars (requires Morningstar API)
- WAM/Andbank position-level data (not in Excel sheets)
