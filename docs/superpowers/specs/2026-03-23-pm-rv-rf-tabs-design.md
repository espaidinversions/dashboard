# Public Markets RV/RF Tabs — Design Spec

**Goal:** Add Renda Variable and Renda Fixa sub-tabs to Mercats Públics, each with a McKinsey-style performance attribution chart, All/Directe/Bankinter toggle, and navigation to per-position detail pages. Fix the capital cridat section leaking from Alternatives.

**Architecture:** One shared `PMTipusTab` component (parameterised by `tipus`), a new `PMPositionDetail` route page, and a new React Router route at `/mercats-publics/:id`. Dashboard sub-tab bar gains two new tabs. Capital cridat gate already patched.

**Tech Stack:** React 18, Recharts (`BarChart`), React Router v6, existing `useTheme`/`fmtM`/`usePersistedState` utilities. No new dependencies.

---

## 1. Navigation — `src/components/Dashboard.jsx`

### Sub-tab bar

The Mercats Públics sub-tab bar gains two new tabs between "Resum" and "Posicions":

```
Resum | Renda Variable | Renda Fixa | Posicions
```

Tab IDs: `"resum"`, `"rv"`, `"rf"`, `"posicions"`.

Update the `mercatsPublicsTab` state initialiser to `useState("resum")` (already present, no change needed).

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

Add two new render conditionals immediately after the existing `mercatsPublicsTab==="resum"` and before `mercatsPublicsTab==="posicions"` blocks:

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

### Capital cridat gate (already patched)

The `{/* ── CAPITAL CALLS: KPIs ── */}` block condition was changed from:
```js
{supra==="fons"&&tab!=="pipeline"&&(
```
to:
```js
{section==="alternatives"&&supra==="fons"&&tab!=="pipeline"&&(
```
This prevents the block from rendering under Mercats Públics (where `section==="mercats-publics"` but `supra` defaults to `"fons"`).

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

const visible = toggle === "all"       ? positions
              : toggle === "directe"   ? positions.filter(p => p.gestor === "CaixaBank / UBS")
              : /* bankinter */          positions.filter(p => p.gestor === "Abel Font");

const totalMV = visible.reduce((s, p) => s + (p.valorMercat || 0), 0);
```

### Attribution chart data

Years array: `["rend2023", "rend2024", "rend2025", "rend2026"]` with display labels `["2023", "2024", "2025", "2026"]`.

For each year, build one Recharts data point:

```js
{ year: "2023", pos_id_1: contribution, pos_id_2: contribution, ... }
```

Where for each visible position `p` that has a non-null value for that year's field:

```js
const grossRend = p[rendField];                                    // e.g. p.rend2023
const netRend   = p.gestor === "Abel Font"
                  ? grossRend - (p.costAnual ?? 0)                 // subtract TER for externally managed
                  : grossRend;
const contribution = netRend * (p.valorMercat / totalMV);          // weighted contribution
```

Positions with null for that year are excluded from that bar (contribute 0 implicitly — do not push a key).

Positions are sorted by `valorMercat` descending. In Recharts stacked bars, the first `<Bar>` renders at the bottom — so iterate positions largest-first to stack largest-at-bottom.

**IRR label** (displayed to the right of the chart or as a final column):

```js
const irr = visible.reduce((sum, p) => {
  if (p.rendInici == null) return sum;
  const yearsHeld = (Date.now() - new Date(p.dataCompra).getTime()) / (365.25 * 24 * 3600 * 1000);
  const net = p.gestor === "Abel Font"
    ? p.rendInici - (p.costAnual ?? 0) * yearsHeld
    : p.rendInici;
  return sum + net * (p.valorMercat / totalMV);
}, 0);
```

Displayed as: `IRR: +X.XX%` (green if positive, red if negative) in a chip to the right of the chart title.

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

```jsx
<BarChart data={chartData} margin={{ top: 8, right: 48, bottom: 8, left: 8 }}>
  <XAxis dataKey="year" />
  <YAxis tickFormatter={v => v.toFixed(1) + "%"} />
  <Tooltip formatter={(v, name) => [v.toFixed(2) + "%", name]} />
  {visibleSorted.map((p, i) => (
    <Bar key={p.id} dataKey={p.id} stackId="a" fill={COLORS[i % COLORS.length]}
         name={p.nom} />
  ))}
</BarChart>
```

`COLORS`: a palette of 12 distinct colors defined at module level (not from theme — needs variety).

### Position list below chart

Scrollable list of the visible positions sorted by `valorMercat` desc. Each row:

```
[colored dot] Nom (nom)              Gestor    IRR net    Valor
```

`nom` is a `<Link to={/mercats-publics/${p.id}}>` for navigation to the detail page. IRR net = `rendInici` adjusted for Abel Font cost (same formula as above, using yearsHeld). Render `—` if null.

---

## 3. Detail page — `src/components/PMPositionDetail.jsx`

### Route

Added to `src/router.jsx`:

```jsx
import { PMPositionDetail } from "./components/PMPositionDetail.jsx";
// inside <Routes>:
<Route path="/mercats-publics/:id" element={<PMPositionDetail />} />
```

The component reads the `id` param with `useParams()` and finds the position:

```js
const { id } = useParams();
const positions = PM_POSITIONS.filter(p => p.id === id);
// positions may be multiple (same ETF, multiple tranches)
// aggregate: sum costEur, sum valorMercat, sum unitats; take first isin/dataCompra/gestor
```

**Aggregation note:** Multiple rows may share the same `id` (same ETF, different purchase tranches). The detail page aggregates them: `valorMercat = sum`, `costEur = sum`, `unitats = sum`, `pes = sum`, returns = weighted average by tranche valorMercat.

If no positions found → show "Posició no trobada" with back link.

### Layout

**Header**
```
← Mercats Públics          [★ Morningstar link]
[nom]
[ISIN monospace]  [gestor badge]  [divisa badge]
```

Back link: `<Link to="/">` then navigate to Mercats Públics tab (use `useNavigate` + set persisted state, or just `<Link to="/?tab=mercats-publics">`). Simplest: use `useNavigate(-1)` (browser back).

**KPI row** — 4 cards side by side:
| Card | Value |
|------|-------|
| Valor mercat | `fmtM(valorMercat)` |
| Cost total | `fmtM(costEur)` |
| P&L | `fmtM(valorMercat − costEur)` green/red |
| Pes cartera | `pes.toFixed(1) + "%"` |

**Return history chart** — `BarChart` (grouped, not stacked). X-axis = years. For each year with a non-null return:
- If Abel Font: two bars — gross return (`rend_year`, lighter color) and net return (`rend_year − costAnual`, darker color)
- If CaixaBank/UBS: single bar per year (TER already in NAV)

Reference line at Y=0. Years: 2023, 2024, 2025, 2026. Include `rendInici` as a separate rightmost group labeled "Inici".

**Cost breakdown panel** — card with table:
| Label | Value |
|-------|-------|
| Unitats | `unitats.toLocaleString("ca-ES")` |
| Preu d'entrada | `costInici.toFixed(4)` |
| Cost total | `fmtM(costEur)` |
| TER anual | `costAnual != null ? costAnual.toFixed(2) + "%" : "—"` |
| Cost anual implícit | `costAnual != null ? fmtM(costEur * costAnual / 100) + "/any" : "—"` |
| Data compra | `dataCompra` |

For Abel Font positions, add a note: *"Gestió externa — el TER reflecteix el cost de gestió del vehicle."*

**Since-inception summary** — large number display:
```
Rendiment des d'inici:   +XX.XX%  (rendInici, green/red)
Net estimat:             +XX.XX%  (rendInici − costAnual × yearsHeld) — only for Abel Font
```

---

## 4. Router — `src/router.jsx`

Add one new route. Check existing router structure before editing — the new route goes inside the existing `<Routes>` block, at the same level as existing routes.

```jsx
<Route path="/mercats-publics/:id" element={<PMPositionDetail />} />
```

---

## 5. File Map

| File | Action |
|------|--------|
| `src/components/Dashboard.jsx` | Modify — sub-tab list (add rv/rf), render conditionals (add PMTipusTab), import, capital cridat gate (already patched) |
| `src/components/PMTipusTab.jsx` | Create — shared RV/RF attribution chart + toggle + position list |
| `src/components/PMPositionDetail.jsx` | Create — standalone position detail page |
| `src/router.jsx` | Modify — add `/mercats-publics/:id` route |

---

## 6. Out of Scope

- Benchmark comparison lines (requires external data)
- Historical weight changes per year (only current weights available)
- Real-time NAV / price updates
- Sorting by other columns in position list (click-to-sort)
- Closed/liquidated positions
