# Public Markets Holdings Tab — Design Spec

**Goal:** Add a "Posicions" sub-tab to Mercats Públics showing all 59 individual positions (51 RV + 8 RF) extracted from the Excel portfolio sheet, grouped by asset type with cost basis, market value, P&L, and annual cost.

**Architecture:** Extract position data via Node script → static `PM_POSITIONS` array in existing data file → new `HoldingsTable` component → sub-tabs wired in Dashboard.jsx. No closed positions exist yet; toggle reserved for future use.

**Tech Stack:** React 18, existing theme/utils patterns, no new dependencies.

---

## 1. Data Extraction — `src/data/publicMarkets.js`

### Source

Excel: `Mercats Públics/Resum Financer Espai 2026_vClaudeRoberto.xlsx`
- Sheet `ETf's Espai RV` — 51 data rows (row index 1–51; row 52 is totals)
- Sheet `ETf's Espai RF` — 8 data rows (row index 1–8; row 9 is totals)

### Column mapping (0-indexed, RV sheet)

| Index | Excel header | JS field | Notes |
|-------|-------------|----------|-------|
| 0 | Banc | gestor | Populated for Bankinter rows; others inferred (see below) |
| 1 | DIVISA | divisa | "EUR" / "USD" |
| 3 | Nom | nom | ETF/fund name |
| 4 | Data Compra | dataCompra | Excel serial → "YYYY-MM-DD"; RF row 8 is text "DD/MM/YYYY i DD/MM/YYYY" — use first date |
| 5 | Cost anual | costAnual | TER as decimal (e.g. 0.0020 = 0.20%) |
| 6 | ISIN | isin | `.trim()` required — some have leading `\r\n`/`\t` |
| 7 | Volatilitat 3a | vol3a | nullable |
| 8 | Nº titols | unitats | share count |
| 9 | cost inici | costInici | cost per unit |
| 10 | Valor de Cost en EUR | costEur | total acquisition cost in EUR |
| 25 | Valor mercat en eur | valorMercat | current market value in EUR |
| 26 | Pes % | pes | portfolio weight as % (e.g. 1.7 for 1.7%) |
| 28 | Rend. des d'inici viu | rendInici | since-inception % return; nullable |
| 29 | Rend 2026 | rend2026 | nullable |
| 30 | Rend 2025 | rend2025 | nullable |
| 31 | Rend 2024 | rend2024 | nullable |
| 32 | Rend 2023 | rend2023 | nullable |

RF sheet: same column mapping shifted by −1 (no `Banc` col 0; DIVISA is col 0, Nom is col 2, etc.).

### Gestor inference

The `Banc` column (RV col 0) is populated only for Abel/Bankinter rows. For CaixaBank and UBS rows it is `null`. The extraction script must infer the manager by inspecting blank separator rows or sub-totals between manager groups. Concretely: rows with `Nom === null && valorMercat === null` are separator/header rows whose adjacent text indicates the manager group. The script processes rows sequentially, updating a `currentGestor` variable when a separator row is encountered.

### `PM_POSITIONS` schema

```js
{
  id: "ishares-msci-world",   // slugify(nom)
  nom: "iShares MSCI World",
  gestor: "CaixaBank",        // "CaixaBank" | "UBS" | "Abel Font" | "WAM" | "Andbank"
  isin: "IE00B4L5Y983",       // trimmed
  tipus: "RV",                // "RV" | "RF"
  divisa: "EUR",
  dataCompra: "2021-03-12",   // ISO string
  unitats: 1240,
  costInici: 90.65,           // cost per unit
  costEur: 112400,            // total cost in EUR
  valorMercat: 134200,        // current market value in EUR
  pes: 1.7,                   // weight %
  rendInici: 19.4,            // % since inception; null if unavailable
  rend2026: -1.2,             // % YTD 2026; null if unavailable
  rend2025: 9.5,
  rend2024: 17.0,
  rend2023: null,
  costAnual: 0.20,            // TER % (already ×100 for display)
}
```

`costAnual` is stored as a display percentage (0.20 means 0.20%). If the raw Excel value is a decimal (0.0020), multiply by 100 on extraction.

### WAM and Andbank

These managers are not in the ETF sheets. They are excluded from `PM_POSITIONS`. The `HoldingsTable` renders a footnote: *"WAM (€6.1M) i Andbank (€6.1M) gestionats directament pel gestor — posicions individuals no disponibles."*

---

## 2. Navigation — `src/components/Dashboard.jsx`

### New state

```js
const [mercatsPublicsTab, setMercatsPublicsTab] = useState("resum");
```

### Sub-tab bar

When `section === "mercats-publics"`, render a white sub-tab bar (same style as Real Estate sub-tabs) with two items:

```js
[{ id: "resum", label: "Resum" }, { id: "posicions", label: "Posicions" }]
```

### Tab panel render

```jsx
{tab === "mercats-publics" && mercatsPublicsTab === "resum" && (
  <div className="tab-panel"><PublicMarketsTab /></div>
)}
{tab === "mercats-publics" && mercatsPublicsTab === "posicions" && (
  <div className="tab-panel"><HoldingsTable /></div>
)}
```

Add import: `import { HoldingsTable } from "./HoldingsTable.jsx";`

---

## 3. Component — `src/components/HoldingsTable.jsx`

No props. Reads from `PM_POSITIONS` directly. Uses `useTheme()`.

### Layout

```
[Section header: "Renda Variable · 51 posicions · 34.5M€"]
[Table rows — sorted by valorMercat desc]

[Section header: "Renda Fixa · 8 posicions · 5.2M€"]
[Table rows — sorted by valorMercat desc]

[Footnote: WAM i Andbank note]
```

No toggle (no closed positions exist). When closed positions are added in future, a "Actives / Totes" toggle can be added then.

### Columns

| Column | Value | Notes |
|--------|-------|-------|
| Nom | `m.nom` | Primary label; bold |
| Gestor | `m.gestor` | Small, muted |
| ISIN | `m.isin` | Monospace, small |
| Data compra | `m.dataCompra` | Small, muted |
| Unitats | `m.unitats.toLocaleString()` | Right-aligned |
| Cost | `fmtM(m.costEur)` | Right-aligned |
| Valor mercat | `fmtM(m.valorMercat)` | Right-aligned, bold |
| P&L | `rendInici` formatted as `+X.XX%` | Green if >0, red if <0, grey if null |
| Pes % | `m.pes.toFixed(1) + "%"` | Right-aligned, muted |
| Cost anual | `m.costAnual.toFixed(2) + "%"` | Right-aligned, muted |
| ★ | Link to `https://www.morningstar.es/es/search/results.aspx?keyword=${m.isin}` | Opens new tab; only shown if isin non-null |

### Section header style

```jsx
<tr style={{ background: tipus === "RV" ? "#E6EDF3" : "#FFF8E1" }}>
  <td colSpan={11} style={{ fontWeight: 700, color: tipus === "RV" ? tc.navy : "#7A6000" }}>
    {tipus === "RV" ? "Renda Variable" : "Renda Fixa"} · {count} posicions · {fmtM(total)}
  </td>
</tr>
```

### Responsive

Table wrapped in `overflow-x: auto` container. On narrow screens the table scrolls horizontally.

---

## 4. File Map

| File | Action |
|------|--------|
| `src/data/publicMarkets.js` | Modify — append `PM_POSITIONS` array |
| `src/components/HoldingsTable.jsx` | Create — holdings table component |
| `src/components/Dashboard.jsx` | Modify — add `mercatsPublicsTab` state, sub-tab bar, render |

One-time extraction script (not committed): run at implementation time to generate `PM_POSITIONS` data, copy output into `publicMarkets.js`.

---

## 5. Out of Scope (future)

- Closed/liquidated positions toggle (no data yet)
- Live NAV refresh via ISIN scraping
- Column sorting by clicking headers
- Morningstar embedded rating stars (requires Morningstar API)
- WAM/Andbank position-level data (not in Excel sheets)
