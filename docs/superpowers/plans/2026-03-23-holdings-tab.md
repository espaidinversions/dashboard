# Public Markets Holdings Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Posicions" sub-tab to Mercats Públics showing all 59 ETF/fund positions from the Excel portfolio sheet, grouped by RV/RF with cost basis, market value, P&L, and Morningstar links.

**Architecture:** One-time Node extraction script generates `PM_POSITIONS` array → appended to `src/data/publicMarkets.js` → new `HoldingsTable` component renders the table → `Dashboard.jsx` wired with a new sub-tab bar (Resum | Posicions) and split render conditionals.

**Tech Stack:** React 18, `xlsx` (already installed at `node_modules/xlsx`), existing `useTheme`/`fmtM` patterns, no new dependencies.

---

## File Map

| File | Action |
|------|--------|
| `extract-positions.mjs` | Create (temp, not committed) — one-time extraction script |
| `src/data/publicMarkets.js` | Modify — append `export const PM_POSITIONS = [...]` |
| `src/components/HoldingsTable.jsx` | Create — holdings table component |
| `src/components/Dashboard.jsx` | Modify — state (line ~50), import (line ~26), sub-tab bar (before line 533), render (line 590) |

---

## Task 1: Extract PM_POSITIONS data

**Files:**
- Create: `extract-positions.mjs` (temp, not committed — do **not** `git add` this file at any point)
- Modify: `src/data/publicMarkets.js`

### Background

The Excel at `Mercats Públics/Resum Financer Espai 2026_vClaudeRoberto.xlsx` has two sheets:
- `ETf's Espai RV` — 51 data rows (index 1–51; row 52 is totals, skip it)
- `ETf's Espai RF` — 8 data rows (index 1–8; row 9 is totals, skip it)

The `xlsx` package is already installed. The script reads both sheets, identifies manager groups by matching consecutive null-Banc group sums against known PM_MANAGERS totals, and outputs the full `PM_POSITIONS` JS array.

**Column layouts (0-indexed):**

RV sheet: `col[0]=Banc, col[1]=DIVISA, col[3]=Nom, col[4]=DataCompra, col[5]=CostAnual, col[6]=ISIN, col[8]=Unitats, col[9]=CostInici, col[10]=CostEur, col[25]=ValorMercat, col[26]=Pes, col[28]=RendInici, col[29]=Rend2026, col[30]=Rend2025, col[31]=Rend2024, col[32]=Rend2023`

RF sheet: `col[0]=DIVISA, col[2]=Nom, col[3]=DataCompra, col[4]=Banc, col[5]=CostAnual, col[6]=ISIN, col[8]=Unitats, col[9]=CostInici, col[10]=CostEur, col[25]=ValorMercat, col[26]=Pes, col[28]=RendInici, col[29-32]=Rendements`

- [ ] **Step 1: Create `extract-positions.mjs` in the project root**

```js
import XLSX from './node_modules/xlsx/xlsx.mjs';

const EXCEL_PATH = "Mercats Públics/Resum Financer Espai 2026_vClaudeRoberto.xlsx";
const TOLERANCE  = 1_000;

// Known manager valorMercat totals (from PM_MANAGERS in publicMarkets.js)
const RV_KNOWN = { rvCaixa: 8_037_347, rvUbs: 10_704_128 };
const RF_KNOWN = { rfCaixa: 3_990_758, rfUbs: 2_220_845 };

function slugify(nom) {
  return nom.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseSerial(n) {
  const d = XLSX.SSF.parse_date_code(n);
  return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
}

function parseTextDate(raw) {
  const [day, month, year] = raw.split(' i ')[0].split('/');
  return `${year}-${month}-${day}`;
}

function normaliseCa(raw) {
  if (raw == null) return null;
  return raw < 0.10 ? parseFloat((raw * 100).toFixed(4)) : raw;
}

function fmt(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v);
}

// Splits rows into consecutive null-Banc groups and BANKINTER groups,
// matches each null group's valorMercat sum against knownTotals,
// assigns gestor ("CaixaBank", "UBS", or "Abel Font"), and returns
// final position objects.
function assignGestors(rows, knownTotals, label) {
  // Build groups of consecutive null-Banc rows; BANKINTER rows are their own group
  let nullBuf = [];
  const groups = [];
  for (const r of rows) {
    if (r.bancRaw === "BANKINTER") {
      if (nullBuf.length > 0) { groups.push({ type: "null", rows: nullBuf }); nullBuf = []; }
      groups.push({ type: "bankinter", rows: [r] });
    } else {
      nullBuf.push(r);
    }
  }
  if (nullBuf.length > 0) groups.push({ type: "null", rows: nullBuf });

  // Match null groups against known totals (single pass; deletes matched keys to avoid reuse)
  const remaining = { ...knownTotals };
  process.stderr.write(`\n=== ${label} gestor matching ===\n`);

  for (const g of groups) {
    if (g.type === "bankinter") {
      for (const r of g.rows) r._gestor = "Abel Font";
      process.stderr.write(`  BANKINTER group: ${g.rows.length} rows → Abel Font\n`);
      continue;
    }
    const sum = g.rows.reduce((s, r) => s + (r.valorMercat || 0), 0);
    let gestor = "UNKNOWN";
    for (const [key, target] of Object.entries(remaining)) {
      if (Math.abs(sum - target) <= TOLERANCE) {
        gestor = key.includes("Caixa") ? "CaixaBank" : "UBS";
        delete remaining[key];
        break;
      }
    }
    process.stderr.write(`  null-Banc group: ${g.rows.length} rows, sum=${Math.round(sum).toLocaleString()} → ${gestor}\n`);
    for (const r of g.rows) r._gestor = gestor;
  }

  // Convert raw rows to final position objects
  return groups.flatMap(g => g.rows.map(r => {
    const dataCompra = typeof r.dataRaw === 'number' ? parseSerial(r.dataRaw)
      : typeof r.dataRaw === 'string' ? parseTextDate(r.dataRaw) : null;
    return {
      id:          slugify(r.nom),
      nom:         r.nom,
      gestor:      r._gestor,
      isin:        r.isin,
      tipus:       r.tipus,
      divisa:      r.divisa,
      dataCompra,
      unitats:     r.unitats,
      costInici:   r.costInici,
      costEur:     r.costEur,
      valorMercat: r.valorMercat,
      pes:         r.pes,
      rendInici:   r.rendInici,
      rend2026:    r.rend2026,
      rend2025:    r.rend2025,
      rend2024:    r.rend2024,
      rend2023:    r.rend2023,
      costAnual:   normaliseCa(r.caRaw),
    };
  }));
}

// ── Read workbook ─────────────────────────────────────────────────────────────
const wb = XLSX.readFile(EXCEL_PATH);

// ── RV sheet ──────────────────────────────────────────────────────────────────
const rvSheet = wb.Sheets["ETf's Espai RV"];
const rvRows  = XLSX.utils.sheet_to_json(rvSheet, { header: 1, defval: null });
const rvRaw   = [];
for (let i = 1; i <= 51; i++) {
  const r = rvRows[i];
  if (!r || r[3] == null) continue;  // skip blank rows; col[3] = Nom
  rvRaw.push({
    bancRaw:    r[0],
    divisa:     r[1],
    nom:        r[3],
    dataRaw:    r[4],
    caRaw:      r[5],
    isin:       r[6] ? String(r[6]).trim() : null,
    unitats:    r[8],
    costInici:  r[9],
    costEur:    r[10],
    valorMercat:r[25],
    pes:        r[26],
    rendInici:  r[28],
    rend2026:   r[29],
    rend2025:   r[30],
    rend2024:   r[31],
    rend2023:   r[32],
    tipus:      "RV",
  });
}

// ── RF sheet ──────────────────────────────────────────────────────────────────
const rfSheet = wb.Sheets["ETf's Espai RF"];
const rfRows  = XLSX.utils.sheet_to_json(rfSheet, { header: 1, defval: null });
const rfRaw   = [];
for (let i = 1; i <= 8; i++) {
  const r = rfRows[i];
  if (!r || r[2] == null) continue;  // skip blank rows; col[2] = Nom
  rfRaw.push({
    bancRaw:    r[4],   // RF: Banc is col[4], not col[0]
    divisa:     r[0],
    nom:        r[2],
    dataRaw:    r[3],   // serial integer for rows 1–7; text string for row 8
    caRaw:      r[5],
    isin:       r[6] ? String(r[6]).trim() : null,
    unitats:    r[8],
    costInici:  r[9],
    costEur:    r[10],
    valorMercat:r[25],
    pes:        r[26],
    rendInici:  r[28],
    rend2026:   r[29],
    rend2025:   r[30],
    rend2024:   r[31],
    rend2023:   r[32],
    tipus:      "RF",
  });
}

// ── Assign gestors and build PM_POSITIONS ──────────────────────────────────────
const rvPositions = assignGestors(rvRaw, RV_KNOWN, "RV");
const rfPositions = assignGestors(rfRaw, RF_KNOWN, "RF");
const all = [...rvPositions, ...rfPositions];

process.stderr.write(`\nTotal: ${all.length} positions (${rvPositions.length} RV + ${rfPositions.length} RF)\n`);

// ── Output JS array to stdout ─────────────────────────────────────────────────
const lines = all.map(p => `  {
    id: ${fmt(p.id)},
    nom: ${fmt(p.nom)},
    gestor: ${fmt(p.gestor)},
    isin: ${fmt(p.isin)},
    tipus: ${fmt(p.tipus)},
    divisa: ${fmt(p.divisa)},
    dataCompra: ${fmt(p.dataCompra)},
    unitats: ${fmt(p.unitats)},
    costInici: ${fmt(p.costInici)},
    costEur: ${fmt(p.costEur)},
    valorMercat: ${fmt(p.valorMercat)},
    pes: ${fmt(p.pes)},
    rendInici: ${fmt(p.rendInici)},
    rend2026: ${fmt(p.rend2026)},
    rend2025: ${fmt(p.rend2025)},
    rend2024: ${fmt(p.rend2024)},
    rend2023: ${fmt(p.rend2023)},
    costAnual: ${fmt(p.costAnual)},
  }`);

console.log(`export const PM_POSITIONS = [\n${lines.join(",\n")}\n];`);
```

- [ ] **Step 2: Run the script (stderr to diagnostic file, stdout to output file)**

```bash
node extract-positions.mjs > pm_positions_output.js 2> pm_positions_diag.txt
cat pm_positions_diag.txt
```

Expected diagnostic output:
```
=== RV gestor matching ===
  null-Banc group: ~28 rows, sum=8,037,XXX → CaixaBank
  null-Banc group: ~17 rows, sum=10,704,XXX → UBS
  BANKINTER group: ~6 rows → Abel Font

=== RF gestor matching ===
  null-Banc group: ~5 rows, sum=3,990,XXX → CaixaBank
  null-Banc group: ~2 rows, sum=2,220,XXX → UBS
  BANKINTER group: ~1 rows → Abel Font

Total: 59 positions (51 RV + 8 RF)
```

**If any group shows `UNKNOWN`:** The Excel row ordering differs from the expected pattern (CaixaBank block → UBS block → BANKINTER rows). Print `JSON.stringify(rvRows[1])` to check column indices, or inspect the Excel file directly to find which rows belong to which manager.

**If total is not 59:** Some rows have null `nom` values. Remove the null-guard (`if (!r || r[3] == null) continue`) temporarily, print `r[3]` for each row, and identify which rows need special handling.

- [ ] **Step 3: Verify the output file**

Open `pm_positions_output.js`. Confirm:
- Exactly 59 entries
- All `gestor` values are `"CaixaBank"`, `"UBS"`, or `"Abel Font"` (no `"UNKNOWN"`)
- `isin` fields are clean (no leading `\r\n` or `\t`)
- `costAnual` values look like percentages (0.07–2.00 range), not fractions (0.0007)

- [ ] **Step 4: Append to publicMarkets.js**

```bash
printf "\n" >> "src/data/publicMarkets.js"
cat pm_positions_output.js >> "src/data/publicMarkets.js"
```

- [ ] **Step 5: Delete temp files and commit**

```bash
rm extract-positions.mjs pm_positions_output.js pm_positions_diag.txt
git add src/data/publicMarkets.js
git commit -m "feat: add PM_POSITIONS static data (59 positions, RV + RF)"
```

---

## Task 2: Create HoldingsTable component

**Files:**
- Create: `src/components/HoldingsTable.jsx`

`SectionHeader` and `DataRow` are defined at module level (outside `HoldingsTable`) to avoid unnecessary remounts on each render.

- [ ] **Step 1: Create `src/components/HoldingsTable.jsx`**

```jsx
import { PM_POSITIONS } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM } from "../utils.js";

// ── Sub-components (defined outside HoldingsTable to avoid remounts) ──────────

function SectionHeader({ tipus, count, total, tc, dark }) {
  const isRV  = tipus === "RV";
  const bg    = isRV ? (dark ? "#1E2E3D" : "#E6EDF3") : (dark ? "#2E2800" : "#FFF8E1");
  const color = isRV ? tc.navy : "#7A6000";
  const label = isRV ? "Renda Variable" : "Renda Fixa";
  return (
    <tr style={{ background: bg }}>
      <td colSpan={11} style={{ padding: "6px 10px", fontWeight: 700, fontSize: 12, color }}>
        {label} · {count} posicions · {fmtM(total)}
      </td>
    </tr>
  );
}

function PnlCell({ v, tc }) {
  if (v == null) {
    return <td style={{ padding: "5px 8px", textAlign: "right", color: tc.textLight }}>—</td>;
  }
  const color = v > 0 ? "#22a050" : v < 0 ? "#c0392b" : tc.textLight;
  const label = (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  return <td style={{ padding: "5px 8px", textAlign: "right", color, fontWeight: 700 }}>{label}</td>;
}

function DataRow({ p, zebra, tc, dark }) {
  const bg     = zebra ? (dark ? "#1a1a2e" : "#f8f8f8") : (dark ? tc.card : "#fff");
  const msUrl  = `https://www.morningstar.es/es/search/results.aspx?keyword=${p.isin}`;
  return (
    <tr style={{ background: bg }}>
      <td style={{ padding: "5px 8px", fontWeight: 500, color: tc.text }}>{p.nom}</td>
      <td style={{ padding: "5px 8px", fontSize: 11, color: tc.textLight }}>{p.gestor}</td>
      <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: 10, color: tc.textLight }}>{p.isin}</td>
      <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 10, color: tc.textLight }}>{p.dataCompra}</td>
      <td style={{ padding: "5px 8px", textAlign: "right" }}>
        {p.unitats != null ? p.unitats.toLocaleString("ca-ES") : "—"}
      </td>
      <td style={{ padding: "5px 8px", textAlign: "right" }}>
        {p.costEur != null ? fmtM(p.costEur) : "—"}
      </td>
      <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600, color: tc.navy }}>
        {p.valorMercat != null ? fmtM(p.valorMercat) : "—"}
      </td>
      <PnlCell v={p.rendInici} tc={tc} />
      <td style={{ padding: "5px 8px", textAlign: "right", color: tc.textLight }}>
        {p.pes != null ? p.pes.toFixed(1) + "%" : "—"}
      </td>
      <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 10, color: tc.textLight }}>
        {p.costAnual != null ? p.costAnual.toFixed(2) + "%" : "—"}
      </td>
      <td style={{ padding: "5px 8px", textAlign: "center" }}>
        {p.isin ? (
          <a href={msUrl} target="_blank" rel="noreferrer"
             style={{ color: "#E8A020", fontSize: 11, textDecoration: "none" }} title="Morningstar">★</a>
        ) : null}
      </td>
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function HoldingsTable() {
  const { tc, dark } = useTheme();

  const rvRows = PM_POSITIONS
    .filter(p => p.tipus === "RV")
    .sort((a, b) => b.valorMercat - a.valorMercat);
  const rfRows = PM_POSITIONS
    .filter(p => p.tipus === "RF")
    .sort((a, b) => b.valorMercat - a.valorMercat);

  const rvTotal = rvRows.reduce((s, p) => s + p.valorMercat, 0);
  const rfTotal = rfRows.reduce((s, p) => s + p.valorMercat, 0);

  const thStyle = (align = "left") => ({
    padding: "7px 8px",
    fontWeight: 600,
    fontSize: 11,
    whiteSpace: "nowrap",
    textAlign: align,
    background: tc.navy,
    color: "#fff",
  });

  return (
    <div style={{
      background: tc.card,
      borderRadius: 12,
      border: `1px solid ${tc.border}`,
      padding: "20px 24px",
    }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={thStyle("left")}>Nom</th>
              <th style={thStyle("left")}>Gestor</th>
              <th style={thStyle("left")}>ISIN</th>
              <th style={thStyle("right")}>Data compra</th>
              <th style={thStyle("right")}>Unitats</th>
              <th style={thStyle("right")}>Cost</th>
              <th style={thStyle("right")}>Valor mercat</th>
              <th style={thStyle("right")}>P&amp;L</th>
              <th style={thStyle("right")}>Pes %</th>
              <th style={thStyle("right")}>Cost anual</th>
              <th style={thStyle("center")}>MS</th>
            </tr>
          </thead>
          <tbody>
            <SectionHeader tipus="RV" count={rvRows.length} total={rvTotal} tc={tc} dark={dark} />
            {rvRows.map((p, i) => <DataRow key={p.id} p={p} zebra={i % 2 === 1} tc={tc} dark={dark} />)}
            <SectionHeader tipus="RF" count={rfRows.length} total={rfTotal} tc={tc} dark={dark} />
            {rfRows.map((p, i) => <DataRow key={p.id} p={p} zebra={i % 2 === 1} tc={tc} dark={dark} />)}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: tc.textLight, marginTop: 12, fontStyle: "italic" }}>
        WAM (€6.1M) i Andbank (€6.1M) gestionats directament pel gestor — posicions individuals no disponibles.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HoldingsTable.jsx
git commit -m "feat: add HoldingsTable component for Posicions sub-tab"
```

---

## Task 3: Wire Dashboard.jsx

**Files:**
- Modify: `src/components/Dashboard.jsx`

Four surgical changes. Read the current file before making any edit to confirm line numbers.

**Current state (verify):**
- Line ~26: `import { PublicMarketsTab } from "./PublicMarketsTab.jsx";`
- Line ~49–50: `inversionsSubTab` and `realEstateTab` useState lines (no `mercatsPublicsTab` yet)
- Line ~531–532: closing `)}` of Inversions sub-tab block, then blank line
- Line ~533: `{/* ── Sub-tabs (Real Estate) ── */}`
- Line ~590: `{tab==="mercats-publics"&&<div className="tab-panel"><PublicMarketsTab/></div>}`

- [ ] **Step 1: Add `mercatsPublicsTab` state**

Find lines 49–50:
```js
  const [inversionsSubTab, setInversionsSubTab] = useState("fons");
  const [realEstateTab, setRealEstateTab] = useState("directe");
```

Add immediately after:
```js
  const [mercatsPublicsTab, setMercatsPublicsTab] = useState("resum");
```

- [ ] **Step 2: Add `HoldingsTable` import**

Find line 26:
```js
import { PublicMarketsTab } from "./PublicMarketsTab.jsx";
```

Add immediately after:
```js
import { HoldingsTable } from "./HoldingsTable.jsx";
```

- [ ] **Step 3: Add Mercats Públics sub-tab bar**

> Note: `section` is a derived variable already in this file (`const section = (tab==="mercats-publics"||tab==="real-estate") ? tab : "alternatives"` around line 407). Do not replace `section` with `tab`.

Find the Real Estate sub-tab block (around line 533):
```jsx
      {/* ── Sub-tabs (Real Estate) ── */}
      {section==="real-estate"&&(
```

Insert immediately before it (including the blank line after):
```jsx
      {/* ── Sub-tabs (Mercats Públics) ── */}
      {section==="mercats-publics"&&(
      <div className="tab-bar no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"0 32px",display:"flex",gap:0}}>
        {[{id:"resum",label:"Resum"},{id:"posicions",label:"Posicions"}].map(t=>(
          <button key={t.id} onClick={()=>setMercatsPublicsTab(t.id)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${mercatsPublicsTab===t.id?tc.green:"transparent"}`,padding:"11px 20px",cursor:"pointer",fontSize:12,fontWeight:mercatsPublicsTab===t.id?600:400,color:mercatsPublicsTab===t.id?tc.navy:tc.textMid,fontFamily:"inherit",transition:"color 0.15s, border-color 0.15s",whiteSpace:"nowrap",letterSpacing:"0.01em"}}>
            {t.label}
          </button>
        ))}
      </div>
      )}

```

- [ ] **Step 4: Replace the single mercats-publics render line**

> Note: The actual file uses compact JSX (no spaces around `&&`). Use the exact string below as the search target — do not use the spaced version from the spec.

Find (around line 590):
```jsx
        {tab==="mercats-publics"&&<div className="tab-panel"><PublicMarketsTab/></div>}
```

Replace with:
```jsx
        {tab==="mercats-publics"&&mercatsPublicsTab==="resum"&&(
          <div className="tab-panel"><PublicMarketsTab/></div>
        )}
        {tab==="mercats-publics"&&mercatsPublicsTab==="posicions"&&(
          <div className="tab-panel"><HoldingsTable/></div>
        )}
```

- [ ] **Step 5: Start dev server and verify visually**

```bash
npm run dev
```

Open the browser. Verify all of these:

1. **Sub-tab bar appears** — Navigate to Mercats Públics. A white sub-tab bar with "Resum" and "Posicions" appears below the dark section nav.
2. **Resum is default** — "Resum" tab is active (green underline) and shows the existing PublicMarketsTab content.
3. **Posicions tab works** — Click "Posicions". The HoldingsTable renders with 51 RV rows and 8 RF rows.
4. **Section headers** — Blue header row for "Renda Variable · 51 posicions", yellow header row for "Renda Fixa · 8 posicions".
5. **Morningstar links** — Orange ★ in the last column; clicking opens Morningstar search in a new tab.
6. **Footnote** — "WAM (€6.1M) i Andbank (€6.1M)..." appears at the bottom.
7. **Dark mode** — Toggle the moon button. Section header backgrounds change (dark blue for RV, dark amber for RF). No white backgrounds are visible.
8. **No sub-bar leak** — Navigate to Fons, Searchers, Participades — no Mercats Públics sub-tab bar appears.
9. **Tab reset** — Switch from "Posicions" to Fons and back to Mercats Públics. The sub-tab resets to "Resum" (expected — `mercatsPublicsTab` uses `useState`, not `usePersistedState`).

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.jsx
git commit -m "feat: wire Posicions sub-tab for Mercats Públics in Dashboard"
```
