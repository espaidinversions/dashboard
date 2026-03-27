# Public Markets RV/RF Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Renda Variable and Renda Fixa sub-tabs to Mercats Públics, each with a McKinsey-style stacked attribution chart (returns by year, broken down by position), All/Directe/Bankinter toggle, position list with links, and a standalone per-tranche detail page at `/mercats-publics/:id`.

**Architecture:** `PMTipusTab` (shared for RV/RF) + `PMPositionDetail` (standalone route) + `yearsHeld` helper added to `src/utils.js`. Dashboard gains two new sub-tab entries; router gains one new protected route.

**Tech Stack:** React 18, Recharts (`BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ReferenceLine`, `ResponsiveContainer`), React Router v6 (`Link`, `useParams`, `useNavigate`), `usePersistedState`/`fmtM` from `src/utils.js`.

---

## File Map

| File | Action |
|------|--------|
| `src/utils.js` | Modify — append `yearsHeld` helper |
| `src/components/PMTipusTab.jsx` | Create — attribution chart + toggle + position list |
| `src/components/PMPositionDetail.jsx` | Create — per-tranche detail page |
| `src/components/Dashboard.jsx` | Modify — sub-tab list, render conditionals, import |
| `src/router.jsx` | Modify — add `/mercats-publics/:id` route |

---

## Task 1: Add `yearsHeld` to utils.js

**Files:**
- Modify: `src/utils.js`

- [ ] **Step 1: Append `yearsHeld` helper to `src/utils.js`**

Open `src/utils.js` and add at the bottom:

```js
/** Returns the number of years between an ISO date string and now. */
export function yearsHeld(dataCompra) {
  if (!dataCompra) return 0;
  return (Date.now() - new Date(dataCompra).getTime()) / (365.25 * 24 * 3600 * 1000);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils.js
git commit -m "feat: add yearsHeld utility helper"
```

---

## Task 2: Create `PMTipusTab` component

**Files:**
- Create: `src/components/PMTipusTab.jsx`

### Background

This component renders for both the "Renda Variable" and "Renda Fixa" sub-tabs. The `tipus` prop (`"RV"` or `"RF"`) determines which positions to show.

The **attribution chart** is a Recharts stacked `BarChart`:
- X-axis = years: 2023, 2024, 2025, 2026
- Each column = one stacked bar
- Each segment = one position's weighted contribution to that year's portfolio return
- Contribution formula: `netRend * (p.valorMercat / totalMV)` where:
  - `netRend = rend_year - costAnual` for Abel Font positions (TER subtracted)
  - `netRend = rend_year` for CaixaBank/UBS (TER already in NAV)
- Positions with null return for a given year contribute 0 for that year (excluded from stack)
- `totalMV` = sum of `valorMercat` across ALL visible positions (not just those with data for that year)
- Positions sorted by `valorMercat` descending — largest rendered first (bottom of stack)

The **toggle** (Tots / Directe / Bankinter) filters positions. State is persisted per-tipus.

The **position list** below the chart links each row to `/mercats-publics/:id`.

- [ ] **Step 1: Create `src/components/PMTipusTab.jsx`**

```jsx
import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { Link } from "react-router-dom";
import { PM_POSITIONS } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM, usePersistedState, yearsHeld } from "../utils.js";

const PM_COLORS = [
  "#4E79A7","#F28E2B","#E15759","#76B7B2","#59A14F",
  "#EDC948","#B07AA1","#FF9DA7","#9C755F","#BAB0AC",
  "#D37295","#A0CBE8",
];

const YEAR_DEFS = [
  { field: "rend2023", label: "2023" },
  { field: "rend2024", label: "2024" },
  { field: "rend2025", label: "2025" },
  { field: "rend2026", label: "2026" },
];

const TOGGLES = [
  { id: "all",       label: "Tots" },
  { id: "directe",   label: "Directe" },
  { id: "bankinter", label: "Bankinter" },
];

function netRend(p, rendField) {
  const gross = p[rendField];
  if (gross == null) return null;
  return p.gestor === "Abel Font" ? gross - (p.costAnual ?? 0) : gross;
}

function netRendInici(p) {
  if (p.rendInici == null) return null;
  return p.gestor === "Abel Font"
    ? p.rendInici - (p.costAnual ?? 0) * yearsHeld(p.dataCompra)
    : p.rendInici;
}

// Custom tooltip — only show positions with non-zero contribution for this year
function AttribTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const items = payload
    .filter(e => e.value !== 0 && e.value != null)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 12); // cap at 12 to avoid overflow
  return (
    <div style={{
      background: "#fff", border: "1px solid #ddd", borderRadius: 8,
      padding: "10px 14px", fontSize: 11, maxWidth: 280,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {items.map(e => (
        <div key={e.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ color: e.fill }}>■</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
          <span style={{ fontWeight: 600, color: e.value >= 0 ? "#22a050" : "#c0392b" }}>
            {(e.value >= 0 ? "+" : "") + e.value.toFixed(2) + "%"}
          </span>
        </div>
      ))}
      {payload.filter(e => e.value !== 0).length > 12 && (
        <div style={{ color: "#999", marginTop: 4 }}>+{payload.filter(e => e.value !== 0).length - 12} més…</div>
      )}
    </div>
  );
}

export function PMTipusTab({ tipus }) {
  const { tc } = useTheme();
  const [toggle, setToggle] = usePersistedState(`pm_toggle_${tipus}`, "all");

  const positions = useMemo(
    () => PM_POSITIONS.filter(p => p.tipus === tipus),
    [tipus]
  );

  const visible = useMemo(() => {
    const base = toggle === "directe"   ? positions.filter(p => p.gestor === "CaixaBank / UBS")
               : toggle === "bankinter" ? positions.filter(p => p.gestor === "Abel Font")
               : positions;
    return [...base].sort((a, b) => b.valorMercat - a.valorMercat);
  }, [positions, toggle]);

  const totalMV = useMemo(
    () => visible.reduce((s, p) => s + (p.valorMercat || 0), 0),
    [visible]
  );

  const chartData = useMemo(() => {
    if (totalMV === 0) return [];
    return YEAR_DEFS.map(({ field, label }) => {
      const point = { year: label };
      visible.forEach(p => {
        const net = netRend(p, field);
        if (net == null) return;
        point[p.id] = parseFloat((net * (p.valorMercat / totalMV)).toFixed(4));
      });
      return point;
    });
  }, [visible, totalMV]);

  const totalReturn = useMemo(() => {
    if (totalMV === 0) return null;
    let sum = 0, weight = 0;
    visible.forEach(p => {
      const net = netRendInici(p);
      if (net == null) return;
      sum    += net * p.valorMercat;
      weight += p.valorMercat;
    });
    return weight > 0 ? sum / weight : null;
  }, [visible, totalMV]);

  const returnColor = totalReturn == null ? tc.textLight
    : totalReturn > 0 ? "#22a050" : "#c0392b";

  return (
    <div>
      {/* ── Header row: toggle + return label ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {TOGGLES.map(t => (
            <button key={t.id} onClick={() => setToggle(t.id)}
              style={{
                background: toggle === t.id ? tc.navy : "transparent",
                color: toggle === t.id ? "#fff" : tc.textMid,
                border: `1.5px solid ${toggle === t.id ? tc.navy : tc.border}`,
                borderRadius: 20, padding: "5px 14px", fontSize: 11,
                cursor: "pointer", fontFamily: "inherit",
              }}>
              {t.label}
            </button>
          ))}
        </div>
        {totalReturn != null && (
          <div style={{ fontSize: 12, color: tc.textLight }}>
            Rend. Inici:&nbsp;
            <span style={{ fontWeight: 700, color: returnColor }}>
              {(totalReturn >= 0 ? "+" : "") + totalReturn.toFixed(2) + "%"}
            </span>
            <span style={{ fontSize: 10, marginLeft: 4 }}>(ponderat, net TER Abel Font)</span>
          </div>
        )}
      </div>

      {/* ── Attribution chart ── */}
      <div style={{
        background: tc.card, borderRadius: 12, border: `1px solid ${tc.border}`,
        padding: "20px 24px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: tc.navy, marginBottom: 12 }}>
          Contribució per posició · rendiments {toggle === "bankinter" ? "nets TER" : "bruts (Directe) / nets TER (Bankinter)"}
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 8, right: 32, bottom: 8, left: 8 }}>
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => v.toFixed(1) + "%"} tick={{ fontSize: 11 }} width={42} />
            <ReferenceLine y={0} stroke="#ccc" />
            <Tooltip content={<AttribTooltip />} />
            {visible.map((p, i) => (
              <Bar key={p.id} dataKey={p.id} stackId="a"
                   fill={PM_COLORS[i % PM_COLORS.length]} name={p.nom} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Position list ── */}
      <div style={{
        background: tc.card, borderRadius: 12, border: `1px solid ${tc.border}`,
        padding: "20px 24px",
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: tc.navy, marginBottom: 12 }}>
          Posicions · ordenades per valor de mercat
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${tc.border}` }}>
              <th style={{ textAlign: "left",  padding: "5px 8px", fontWeight: 600, color: tc.textLight, fontSize: 11 }}></th>
              <th style={{ textAlign: "left",  padding: "5px 8px", fontWeight: 600, color: tc.textLight, fontSize: 11 }}>Nom</th>
              <th style={{ textAlign: "left",  padding: "5px 8px", fontWeight: 600, color: tc.textLight, fontSize: 11 }}>Gestor</th>
              <th style={{ textAlign: "right", padding: "5px 8px", fontWeight: 600, color: tc.textLight, fontSize: 11 }}>Rend. Inici</th>
              <th style={{ textAlign: "right", padding: "5px 8px", fontWeight: 600, color: tc.textLight, fontSize: 11 }}>Valor mercat</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => {
              const net = netRendInici(p);
              const rendColor = net == null ? tc.textLight : net > 0 ? "#22a050" : "#c0392b";
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${tc.border}` }}>
                  <td style={{ padding: "6px 8px", width: 16 }}>
                    <span style={{
                      display: "inline-block", width: 10, height: 10, borderRadius: 2,
                      background: PM_COLORS[i % PM_COLORS.length],
                    }} />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <Link to={`/mercats-publics/${p.id}`}
                      style={{ color: tc.navy, textDecoration: "none", fontWeight: 500 }}>
                      {p.nom}
                    </Link>
                  </td>
                  <td style={{ padding: "6px 8px", color: tc.textLight, fontSize: 11 }}>{p.gestor}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: rendColor }}>
                    {net != null ? (net >= 0 ? "+" : "") + net.toFixed(2) + "%" : "—"}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtM(p.valorMercat)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no import errors by starting dev server**

```bash
npm run dev
```

Navigate to Mercats Públics → Renda Variable (tab doesn't exist yet — will be wired in Task 4). Confirm no build errors in the Vite terminal output.

- [ ] **Step 3: Commit**

```bash
git add src/components/PMTipusTab.jsx
git commit -m "feat: add PMTipusTab attribution chart component"
```

---

## Task 3: Create `PMPositionDetail` page

**Files:**
- Create: `src/components/PMPositionDetail.jsx`

### Background

One page per tranche — no aggregation. `useParams()` gives the `id`; `PM_POSITIONS.find(p => p.id === id)` retrieves the single entry.

Return history chart shows years 2023–2026 + "Inici" (rendInici). For Abel Font positions, each year has two bars: gross (rend_year) and net (rend_year − costAnual). For CaixaBank/UBS, one bar per year.

Back navigation: `useNavigate(-1)`.

- [ ] **Step 1: Create `src/components/PMPositionDetail.jsx`**

```jsx
import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";
import { useParams, useNavigate } from "react-router-dom";
import { PM_POSITIONS } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM, yearsHeld } from "../utils.js";

function KpiCard({ label, value, color, tc }) {
  return (
    <div style={{
      background: tc.card, border: `1px solid ${tc.border}`,
      borderRadius: 10, padding: "14px 18px", flex: 1,
    }}>
      <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? tc.navy }}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value, tc }) {
  return (
    <tr>
      <td style={{ padding: "6px 0", color: tc.textLight, fontSize: 12, paddingRight: 24 }}>{label}</td>
      <td style={{ padding: "6px 0", fontWeight: 500, fontSize: 12 }}>{value ?? "—"}</td>
    </tr>
  );
}

export function PMPositionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tc } = useTheme();

  const p = PM_POSITIONS.find(pos => pos.id === id);

  if (!p) {
    return (
      <div style={{ padding: "60px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: tc.textLight, marginBottom: 16 }}>Posició no trobada</div>
        <button onClick={() => navigate(-1)}
          style={{ background: tc.navy, color: "#fff", border: "none", borderRadius: 8,
                   padding: "8px 20px", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
          ← Tornar
        </button>
      </div>
    );
  }

  const isAbelFont  = p.gestor === "Abel Font";
  const pnl         = (p.valorMercat ?? 0) - (p.costEur ?? 0);
  const pnlColor    = pnl > 0 ? "#22a050" : pnl < 0 ? "#c0392b" : tc.textLight;
  const msUrl       = p.isin ? `https://www.morningstar.es/es/search/results.aspx?keyword=${p.isin}` : null;
  const yh          = yearsHeld(p.dataCompra);
  const netInici    = p.rendInici != null
    ? (isAbelFont ? p.rendInici - (p.costAnual ?? 0) * yh : p.rendInici)
    : null;

  // Return history chart data
  const returnData = useMemo(() => {
    const YEARS = [
      { label: "2023", field: "rend2023" },
      { label: "2024", field: "rend2024" },
      { label: "2025", field: "rend2025" },
      { label: "2026", field: "rend2026" },
      { label: "Inici", field: "rendInici" },
    ];
    return YEARS
      .filter(y => p[y.field] != null)
      .map(y => ({
        year:  y.label,
        brut:  p[y.field],
        net:   isAbelFont ? p[y.field] - (p.costAnual ?? 0) : null,
      }));
  }, [p, isAbelFont]);

  const rendIniciColor = p.rendInici == null ? tc.textLight
    : p.rendInici > 0 ? "#22a050" : "#c0392b";
  const netIniciColor  = netInici == null ? tc.textLight
    : netInici > 0 ? "#22a050" : "#c0392b";

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 900, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <button onClick={() => navigate(-1)}
            style={{ background: "none", border: "none", cursor: "pointer", color: tc.textMid,
                     fontFamily: "inherit", fontSize: 12, padding: 0, marginBottom: 8 }}>
            ← Mercats Públics
          </button>
          <div style={{ fontSize: 22, fontWeight: 700, color: tc.navy, marginBottom: 8 }}>{p.nom}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {p.isin && (
              <span style={{ fontFamily: "monospace", fontSize: 11, background: tc.border,
                             padding: "3px 8px", borderRadius: 4, color: tc.text }}>
                {p.isin}
              </span>
            )}
            <span style={{ fontSize: 11, background: tc.navy + "22", color: tc.navy,
                           padding: "3px 8px", borderRadius: 4, fontWeight: 600 }}>
              {p.gestor}
            </span>
            {p.divisa && (
              <span style={{ fontSize: 11, background: tc.border, padding: "3px 8px", borderRadius: 4, color: tc.textMid }}>
                {p.divisa}
              </span>
            )}
            <span style={{ fontSize: 11, background: tc.border, padding: "3px 8px", borderRadius: 4, color: tc.textMid }}>
              {p.tipus}
            </span>
          </div>
        </div>
        {msUrl && (
          <a href={msUrl} target="_blank" rel="noreferrer"
            style={{ color: "#E8A020", fontSize: 22, textDecoration: "none" }} title="Morningstar">★</a>
        )}
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Valor mercat" value={p.valorMercat != null ? fmtM(p.valorMercat) : "—"} tc={tc} />
        <KpiCard label="Cost total" value={p.costEur != null ? fmtM(p.costEur) : "—"} tc={tc} color={tc.textMid} />
        <KpiCard label="P&L" value={`${pnl >= 0 ? "+" : ""}${fmtM(pnl)}`} tc={tc} color={pnlColor} />
        <KpiCard label="Pes cartera" value={p.pes != null ? p.pes.toFixed(1) + "%" : "—"} tc={tc} color={tc.textMid} />
      </div>

      {/* ── Return history chart ── */}
      <div style={{
        background: tc.card, borderRadius: 12, border: `1px solid ${tc.border}`,
        padding: "20px 24px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: tc.navy, marginBottom: 12 }}>
          Rendiments anuals {isAbelFont ? "· brut vs net TER" : ""}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={returnData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => v.toFixed(1) + "%"} tick={{ fontSize: 11 }} width={42} />
            <ReferenceLine y={0} stroke="#ccc" />
            <Tooltip formatter={(v, name) => [
              (v >= 0 ? "+" : "") + v.toFixed(2) + "%",
              name === "brut" ? "Brut" : "Net TER",
            ]} />
            {isAbelFont && <Legend formatter={n => n === "brut" ? "Brut" : "Net TER"} />}
            <Bar dataKey="brut" name="brut" fill="#4E79A7" />
            {isAbelFont && <Bar dataKey="net" name="net" fill="#59A14F" />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Two-column: cost breakdown + since-inception ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>

        {/* Cost breakdown */}
        <div style={{
          background: tc.card, borderRadius: 12, border: `1px solid ${tc.border}`,
          padding: "20px 24px", flex: "1 1 320px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: tc.navy, marginBottom: 12 }}>
            Detall de cost
          </div>
          <table>
            <tbody>
              <InfoRow label="Unitats" value={p.unitats != null ? p.unitats.toLocaleString("ca-ES") : null} tc={tc} />
              <InfoRow label="Preu d'entrada" value={p.costInici != null ? p.costInici.toFixed(4) : null} tc={tc} />
              <InfoRow label="Cost total" value={p.costEur != null ? fmtM(p.costEur) : null} tc={tc} />
              <InfoRow label="TER anual" value={p.costAnual != null ? p.costAnual.toFixed(2) + "%" : null} tc={tc} />
              <InfoRow label="Cost anual implícit"
                value={p.costAnual != null && p.costEur != null
                  ? fmtM(p.costEur * p.costAnual / 100) + "/any" : null}
                tc={tc} />
              <InfoRow label="Data compra" value={p.dataCompra} tc={tc} />
            </tbody>
          </table>
          {isAbelFont && (
            <div style={{ fontSize: 10, color: tc.textLight, marginTop: 12, fontStyle: "italic" }}>
              Gestió externa — el TER reflecteix el cost de gestió del vehicle.
            </div>
          )}
        </div>

        {/* Since-inception summary */}
        <div style={{
          background: tc.card, borderRadius: 12, border: `1px solid ${tc.border}`,
          padding: "20px 24px", flex: "1 1 220px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: tc.navy, marginBottom: 16 }}>
            Des d'inici
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 4 }}>Rendiment brut</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: rendIniciColor }}>
              {p.rendInici != null
                ? (p.rendInici >= 0 ? "+" : "") + p.rendInici.toFixed(2) + "%"
                : "—"}
            </div>
          </div>
          {isAbelFont && netInici != null && (
            <div>
              <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 4 }}>Net estimat</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: netIniciColor }}>
                {(netInici >= 0 ? "+" : "") + netInici.toFixed(2) + "%"}
              </div>
              <div style={{ fontSize: 10, color: tc.textLight, marginTop: 4 }}>
                Rendiment brut − TER × {yh.toFixed(1)} anys
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PMPositionDetail.jsx
git commit -m "feat: add PMPositionDetail standalone page"
```

---

## Task 4: Wire Dashboard.jsx and router.jsx

**Files:**
- Modify: `src/components/Dashboard.jsx`
- Modify: `src/router.jsx`

- [ ] **Step 1: Add `PMTipusTab` import to Dashboard.jsx**

Find line ~27 (after `HoldingsTable` import):
```js
import { HoldingsTable } from "./HoldingsTable.jsx";
```

Add immediately after:
```js
import { PMTipusTab } from "./PMTipusTab.jsx";
```

- [ ] **Step 2: Update the Mercats Públics sub-tab list in Dashboard.jsx**

Find (around line 538):
```jsx
        {[{id:"resum",label:"Resum"},{id:"posicions",label:"Posicions"}].map(t=>(
```

Replace with:
```jsx
        {[{id:"resum",label:"Resum"},{id:"rv",label:"Renda Variable"},{id:"rf",label:"Renda Fixa"},{id:"posicions",label:"Posicions"}].map(t=>(
```

- [ ] **Step 3: Add RV and RF render conditionals in Dashboard.jsx**

Find (around line 604):
```jsx
        {tab==="mercats-publics"&&mercatsPublicsTab==="resum"&&(
          <div className="tab-panel"><PublicMarketsTab/></div>
        )}
```

Add immediately after the closing `)}` of the resum block (before the posicions block):
```jsx
        {tab==="mercats-publics"&&mercatsPublicsTab==="rv"&&(
          <div className="tab-panel"><PMTipusTab tipus="RV"/></div>
        )}
        {tab==="mercats-publics"&&mercatsPublicsTab==="rf"&&(
          <div className="tab-panel"><PMTipusTab tipus="RF"/></div>
        )}
```

- [ ] **Step 4: Add import to router.jsx**

Find line ~9 (after existing imports):
```js
import { useAuth } from "./auth.jsx";
```

Add import immediately before it (or after the last component import):
```js
import { PMPositionDetail } from "./components/PMPositionDetail.jsx";
```

- [ ] **Step 5: Add route to router.jsx**

Find (around line 44):
```jsx
      <Route path="/company/:id" element={<RequireAuth><CompanyDetail /></RequireAuth>} />
```

Add immediately after it:
```jsx
      <Route path="/mercats-publics/:id" element={<RequireAuth><PMPositionDetail /></RequireAuth>} />
```

- [ ] **Step 6: Start dev server and verify**

```bash
npm run dev
```

**Checklist:**
1. Navigate to Mercats Públics → "Renda Variable" tab appears in the sub-tab bar
2. Clicking "Renda Variable" shows the attribution chart (stacked bars for 2023–2026) and position list
3. Toggle "Tots" / "Directe" / "Bankinter" filters the positions and updates the chart
4. "Rend. Inici" chip shows a percentage (green or red)
5. Clicking any position name in the list navigates to `/mercats-publics/<id>`
6. Detail page shows: header with back button, 4 KPI cards, return history chart, cost breakdown, since-inception section
7. For Abel Font positions, detail page shows both "Brut" and "Net TER" bars, plus "Net estimat" in the since-inception panel
8. Back button (← Mercats Públics) returns to the previous page
9. "Renda Fixa" tab shows only 8 RF positions
10. "Posicions" tab still works (HoldingsTable unchanged)
11. "Resum" tab still works (PublicMarketsTab unchanged)
12. Alternatives section (Fons, Searchers, etc.) no longer shows capital cridat / distribucions data under Mercats Públics

- [ ] **Step 7: Commit**

```bash
git add src/components/Dashboard.jsx src/router.jsx
git commit -m "feat: wire RV/RF sub-tabs and PMPositionDetail route in Dashboard"
```
