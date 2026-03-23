# Public Markets RV/RF Tabs — Design Spec

**Goal:** Add Renda Variable and Renda Fixa sub-tabs to Mercats Públics, each with a McKinsey-style performance attribution chart, All/Directe/Bankinter toggle, and navigation to per-position detail pages. Fix the capital cridat section leaking from Alternatives.

**Architecture:** One shared `PMTipusTab` component (parameterised by `tipus`), a new `PMPositionDetail` route page, and a new React Router route at `/mercats-publics/:id`. Dashboard sub-tab bar gains two new tabs. Capital cridat gate already patched.

**Tech Stack:** React 18, Recharts (`BarChart`, `ResponsiveContainer`), React Router v6, existing `useTheme`/`fmtM`/`usePersistedState` utilities. No new dependencies.

**Tranche model:** Every entry in `PM_POSITIONS` has a unique `id` (suffixed `-2`, `-3` for repeated ETF purchases). The detail page shows one tranche at a time — no aggregation. The route param is the tranche `id`. Links in `PMTipusTab` navigate to the individual tranche page.

---

## 1. Navigation — `src/components/Dashboard.jsx`

### Sub-tab bar

The Mercats Públics sub-tab bar gains two new tabs between "Resum" and "Posicions":

```
Resum | Renda Variable | Renda Fixa | Posicions
```

Tab IDs: `"resum"`, `"rv"`, `"rf"`, `"posicions"`.

`mercatsPublicsTab` state is already present — no change to `useState("resum")`.

Update the sub-tab list array in the existing `{section==="mercats-publics"&&...}` block:

```jsx
[
  { id: "resum",     label: "Resum" },
  { id: "rv",        label: "Renda Variable" },
  { id: "rf",        label: "Renda Fixa" },
  { id: "posicions", label: "Posicions" },
]
```

### Render conditionals

Add two new render conditionals immediately after the existing `mercatsPublicsTab==="resum"` block and before `mercatsPublicsTab==="posicions"`:

```jsx
{tab==="mercats-publics"&&mercatsPublicsTab==="rv"&&(
  <div className="tab-panel"><PMTipusTab tipus="RV"/></div>
)}
{tab==="mercats-publics"&&mercatsPublicsTab==="rf"&&(
  <div className="tab-panel"><PMTipusTab tipus="RF"/></div>
)}
```

### Import

```js
import { PMTipusTab } from "./PMTipusTab.jsx";
```

### Capital cridat gate (already patched in commit a3a7448)

The `{/* ── CAPITAL CALLS: KPIs ── */}` block condition was changed from:
```js
{supra==="fons"&&tab!=="pipeline"&&(
```
to:
```js
{section==="alternatives"&&supra==="fons"&&tab!=="pipeline"&&(
```

---

## 2. Component — `src/components/PMTipusTab.jsx`

Single component used for both RV and RF tabs.

### Props

```js
PMTipusTab({ tipus })  // "RV" | "RF"
```

### State

```js
const [toggle, setToggle] = usePersistedState(`pm_toggle_${tipus}`, "all");
// "all" | "directe" | "bankinter"
```

Persisted per-tipus so switching RV↔RF remembers each tab's toggle independently.

### Data derivation

```js
const positions = PM_POSITIONS.filter(p => p.tipus === tipus);

const visible = toggle === "all"        ? positions
              : toggle === "directe"    ? positions.filter(p => p.gestor === "CaixaBank / UBS")
              : /* bankinter */           positions.filter(p => p.gestor === "Abel Font");

const totalMV = visible.reduce((s, p) => s + (p.valorMercat || 0), 0);
```

### Attribution chart data

Years: `[["rend2023","2023"],["rend2024","2024"],["rend2025","2025"],["rend2026","2026"]]`.

For each year, build one Recharts data point `{ year: "2023", [p.id]: contribution, ... }`:

```js
const chartData = yearDefs.map(([field, label]) => {
  const point = { year: label };
  visibleSorted.forEach(p => {
    if (p[field] == null) return;
    const grossRend = p[field];
    const netRend   = p.gestor === "Abel Font"
                      ? grossRend - (p.costAnual ?? 0)   // subtract annual TER (both in percentage points)
                      : grossRend;
    point[p.id] = netRend * (p.valorMercat / totalMV);   // weighted contribution in percentage points
  });
  return point;
});
```

`visibleSorted` = `visible` sorted by `valorMercat` descending. In Recharts stacked bars the first `<Bar>` renders at the bottom — largest first gives largest-at-bottom layout.

### Total return label

Displayed as a chip above or beside the chart title. This is a **weighted-average total return since inception** (not annualised IRR — the data does not support true IRR computation):

```js
const totalReturn = totalMV > 0
  ? visible.reduce((sum, p) => {
      if (p.rendInici == null) return sum;
      const net = p.gestor === "Abel Font"
        ? p.rendInici - (p.costAnual ?? 0) * yearsHeld(p.dataCompra)
        : p.rendInici;
      return sum + net * (p.valorMercat / totalMV);
    }, 0)
  : null;

function yearsHeld(dataCompra) {
  return (Date.now() - new Date(dataCompra).getTime()) / (365.25 * 24 * 3600 * 1000);
}
```

Display label: `"Rend. Inici: +X.XX%"` (green if positive, red if negative, `tc.textLight` if null). Not labeled "IRR".

### Toggle UI

Three pill buttons above the chart:

```jsx
{[
  { id: "all",       label: "Tots" },
  { id: "directe",   label: "Directe" },
  { id: "bankinter", label: "Bankinter" },
].map(t => (
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
```

### Recharts BarChart

Wrap in `<ResponsiveContainer width="100%" height={420}>`:

```jsx
<ResponsiveContainer width="100%" height={420}>
  <BarChart data={chartData} margin={{ top: 8, right: 48, bottom: 8, left: 8 }}>
    <XAxis dataKey="year" />
    <YAxis tickFormatter={v => v.toFixed(1) + "%"} />
    <ReferenceLine y={0} stroke="#ccc" />
    <Tooltip formatter={(v, name) => [v.toFixed(2) + "%", name]} />
    {visibleSorted.map((p, i) => (
      <Bar key={p.id} dataKey={p.id} stackId="a"
           fill={PM_COLORS[i % PM_COLORS.length]} name={p.nom} />
    ))}
  </BarChart>
</ResponsiveContainer>
```

`ReferenceLine` from recharts at `y={0}` for the zero baseline.

### Color palette

Define at module level in `PMTipusTab.jsx`:

```js
const PM_COLORS = [
  "#4E79A7","#F28E2B","#E15759","#76B7B2","#59A14F",
  "#EDC948","#B07AA1","#FF9DA7","#9C755F","#BAB0AC",
  "#D37295","#A0CBE8",
];
```

### Position list below chart

Scrollable list of `visibleSorted` (largest valorMercat first). Each row:

```
[colored dot]  Nom (linked)          Gestor          Rend. Inici     Valor mercat
```

`nom` cell: `<Link to={`/mercats-publics/${p.id}`}>{p.nom}</Link>`. React Router `Link` from `react-router-dom`.

Rend. Inici cell: net for Abel Font (`p.rendInici - p.costAnual * yearsHeld(p.dataCompra)`), gross for CaixaBank/UBS. Show `—` if null. Green/red coloring.

Valor mercat: `fmtM(p.valorMercat)`.

Colored dot: same `PM_COLORS[i % PM_COLORS.length]` as the chart bar.

---

## 3. Detail page — `src/components/PMPositionDetail.jsx`

### Routing and data loading

```js
const { id } = useParams();
const position = PM_POSITIONS.find(p => p.id === id);
if (!position) return <NotFound />;  // simple "not found" message with back link
```

**One page per tranche** — no aggregation. Each unique `id` maps to exactly one `PM_POSITIONS` entry.

### Back navigation

```js
const navigate = useNavigate();
// Back button:
<button onClick={() => navigate(-1)}>← Mercats Públics</button>
```

`useNavigate(-1)` works for all in-app navigation (user clicks a link from `PMTipusTab`). Limitation: if the user opens the URL directly (bookmark), `-1` exits the app — acceptable for this internal tool.

### Layout

**Header**
```
[← Mercats Públics button]                    [★ Morningstar]
[p.nom — large title]
[p.isin monospace badge]  [p.gestor badge]  [p.divisa badge]
```

Morningstar link: `https://www.morningstar.es/es/search/results.aspx?keyword=${p.isin}` — hidden if `p.isin` is null.

**KPI row** — 4 cards:
| Card | Value |
|------|-------|
| Valor mercat | `fmtM(p.valorMercat)` |
| Cost total | `fmtM(p.costEur)` |
| P&L | `fmtM(p.valorMercat - p.costEur)` — green if positive, red if negative |
| Pes cartera | `p.pes != null ? p.pes.toFixed(1) + "%" : "—"` |

**Return history chart**

`<ResponsiveContainer width="100%" height={260}>` wrapping a `<BarChart>`. Not stacked — grouped.

Data array (one object per year group):
```js
const years = [
  { label: "2023", field: "rend2023" },
  { label: "2024", field: "rend2024" },
  { label: "2025", field: "rend2025" },
  { label: "2026", field: "rend2026" },
  { label: "Inici", field: "rendInici" },
];

const returnData = years
  .filter(y => p[y.field] != null)
  .map(y => ({
    year: y.label,
    brut:  p[y.field],
    net:   p.gestor === "Abel Font" ? p[y.field] - (p.costAnual ?? 0) : null,
  }));
```

Two `<Bar>` components:
- `dataKey="brut"` fill `"#4E79A7"` name `"Brut"` — always shown
- `dataKey="net"` fill `"#59A14F"` name `"Net TER"` — only rendered if `p.gestor === "Abel Font"` (omit the `<Bar>` entirely otherwise)

`<ReferenceLine y={0} stroke="#ccc" />`. `<YAxis tickFormatter={v => v.toFixed(1) + "%"} />`.

**Cost breakdown panel** — card with table:
| Label | Value |
|-------|-------|
| Unitats | `p.unitats != null ? p.unitats.toLocaleString("ca-ES") : "—"` |
| Preu d'entrada | `p.costInici != null ? p.costInici.toFixed(4) : "—"` |
| Cost total | `p.costEur != null ? fmtM(p.costEur) : "—"` |
| TER anual | `p.costAnual != null ? p.costAnual.toFixed(2) + "%" : "—"` |
| Cost anual implícit | `p.costAnual != null && p.costEur != null ? fmtM(p.costEur * p.costAnual / 100) + "/any" : "—"` |
| Data compra | `p.dataCompra ?? "—"` |

For Abel Font positions (`p.gestor === "Abel Font"`), append a note row: *"Gestió externa — el TER reflecteix el cost de gestió del vehicle."*

**Since-inception summary** — large display:

```jsx
<div>Rendiment des d'inici:  {p.rendInici != null ? sign + p.rendInici.toFixed(2) + "%" : "—"}</div>
{p.gestor === "Abel Font" && p.rendInici != null && p.costAnual != null && (
  <div>Net estimat: {sign + (p.rendInici - p.costAnual * yearsHeld(p.dataCompra)).toFixed(2) + "%"}
       <span style={{fontSize:10}}> (rendiment brut − TER × {yearsHeld(p.dataCompra).toFixed(1)} anys)</span>
  </div>
)}
```

`yearsHeld` same helper as in `PMTipusTab` — define in a shared location or duplicate.

---

## 4. Router — `src/router.jsx`

Check existing router structure — all existing routes are wrapped with `<RequireAuth>`. Add the new route with the same wrapper:

```jsx
import { PMPositionDetail } from "./components/PMPositionDetail.jsx";

// inside <Routes>, at same level as other routes:
<Route path="/mercats-publics/:id"
       element={<RequireAuth><PMPositionDetail /></RequireAuth>} />
```

---

## 5. File Map

| File | Action |
|------|--------|
| `src/components/Dashboard.jsx` | Modify — sub-tab list (add rv/rf), render conditionals (add PMTipusTab), import. Capital cridat gate already patched. |
| `src/components/PMTipusTab.jsx` | Create — shared RV/RF attribution chart + toggle + position list |
| `src/components/PMPositionDetail.jsx` | Create — standalone per-tranche detail page |
| `src/router.jsx` | Modify — add `/mercats-publics/:id` route with RequireAuth |

---

## 6. Out of Scope

- Aggregating multiple tranches of the same ETF into a combined detail view
- True IRR computation (requires cash flow timeline per position)
- Benchmark comparison lines
- Historical weight changes per year
- Real-time NAV / price updates
- Sorting by other columns in position list
- Closed/liquidated positions
