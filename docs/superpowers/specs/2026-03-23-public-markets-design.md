# Public Markets Tab — Implementation Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Alternatives" top-level section to the dashboard with "Mercats Públics" and "Real Estate" sub-tabs; implement the Public Markets tab showing portfolio value evolution and manager performance.

**Architecture:** Static historical data embedded in a new data file; new component renders three stacked sections (KPIs, evolution chart, manager grid + performance bars); navigation wired into existing SUPRA/tab system in Dashboard.jsx. Real Estate is a placeholder.

**Tech Stack:** React 18, Recharts (AreaChart, BarChart), existing theme/utils/config patterns.

---

## 1. Navigation Changes — `src/components/Dashboard.jsx`

### 1a. SUPRA array
Add `{ id: "alternatives", label: "Alternatives" }` as the fifth entry in the `SUPRA` array (after "Detall per Inversió").

### 1b. `supra` derivation
```js
const supra = tab === "searchers"     ? "searchers"
  : tab === "portfolio"               ? "portfolio"
  : tab === "inversions"              ? "inversions"
  : (tab === "mercats-publics" || tab === "real-estate") ? "alternatives"
  : "fons";
```

### 1c. SUPRA click handler
Update the `onClick` on each SUPRA button:
```js
onClick={() => {
  setTab(
    s.id === "fons"         ? "pipeline"        :
    s.id === "searchers"    ? "searchers"        :
    s.id === "portfolio"    ? "portfolio"        :
    s.id === "inversions"   ? "inversions"       :
    s.id === "alternatives" ? "mercats-publics"  :
    s.id
  );
}}
```

### 1d. Keyboard navigation
Update `supraIds` array (used in ArrowLeft/ArrowRight handler):
```js
const supraIds = ["fons", "searchers", "portfolio", "inversions", "alternatives"];
```
Update the `setTab` call inside the keyboard handler to handle "alternatives":
```js
const nextSupra = supraIds[(idx + dir + supraIds.length) % supraIds.length];
setTab(
  nextSupra === "fons"         ? "pipeline"       :
  nextSupra === "alternatives" ? "mercats-publics" :
  nextSupra
);
```

### 1e. ALTERNATIVES_TABS constant
```js
const ALTERNATIVES_TABS = [
  { id: "mercats-publics", label: "Mercats Públics" },
  { id: "real-estate",     label: "Real Estate" },
];
```

When `supra === "alternatives"`, render `ALTERNATIVES_TABS` in the second tab bar (same style as `TABS_FONS`).

### 1f. Render body additions
```jsx
{tab === "mercats-publics" && <PublicMarketsTab />}
{tab === "real-estate"     && <RealEstatePlaceholder />}
```

`RealEstatePlaceholder` is an inline minimal component (empty state with label) — no separate file needed.

### 1g. Imports
Add to Dashboard.jsx imports:
```js
import { PublicMarketsTab } from "./PublicMarketsTab.jsx";
```

---

## 2. Data File — `src/data/publicMarkets.js`

### `PM_MONTHLY`
Array of 28 monthly objects covering Dec 2023 → Mar 2026.

```js
{
  date:    "2024-01",   // ISO year-month
  label:   "Gen '24",  // Catalan abbreviated month + year
  caixaRV: 6_381_485,  // Caixa Renda Variable NAV (end of month) — confirmed
  caixaRF: 4_043_704,  // Caixa Renda Fixa NAV — confirmed for 2024; held flat at 3_992_338 for 2025
  ubsRV:   10_411_866, // UBS Renda Variable NAV — confirmed where available; linearly interpolated for gaps
  ubsRF:   3_713_698,  // UBS Renda Fixa NAV — confirmed to Jun 2024; interpolated thereafter
  abelBK:  null,       // Abel Bankinter total portfolio — null before Apr 2025; confirmed Apr 2025–Mar 2026
}
```

**Data provenance:**
- `caixaRV`: Complete monthly series from TWR sheets (Dec 2023–Mar 2026). Zero interpolation.
- `caixaRF`: Complete for 2024 from TWR sheets. Dec 2025 confirmed at 3,992,338. Held flat at 3,992,338 for Jan–Nov 2025 (low-volatility RF fund, 0.47% monthly vol). Jan–Feb 2026 confirmed from TWR sheet.
- `ubsRV`: Dec 2023–Jun 2024 confirmed. Jul–Nov 2024 linearly interpolated (7,893,005 → 8,250,234). Jan–Jun 2025 confirmed. Jul–Nov 2025 linearly interpolated (8,765,865 → 10,678,097). Dec 2025–Mar 2026 confirmed.
- `ubsRF`: Dec 2023–Jun 2024 confirmed. Jul 2024–Nov 2025 linearly interpolated (2,716,639 → 2,228,738, accounting for known Apr 2024 ~986k redemption). Dec 2025–Feb 2026 confirmed.
- `abelBK`: null for all months before Apr 2025. Apr 2025–Mar 2026 confirmed from Bankinter report.

### `PM_MANAGERS`
Array of 7 manager snapshot objects (current as of Mar 2026).

Fields: `id`, `nom`, `gestor`, `tipus` ("RV" | "RF" | "RV+RF"), `valorActual`, `rendPct`, `ytd`, `r2025`, `r2024`.

| id | nom | gestor | tipus | valorActual | rendPct | ytd | r2025 | r2024 |
|----|-----|--------|-------|-------------|---------|-----|-------|-------|
| caixa-rv | Caixa RV | CaixaBank | RV | 8,037,347 | 7.44 | -1.20 | 9.51 | 17.02 |
| caixa-rf | Caixa RF | CaixaBank | RF | 3,990,758 | -0.04 | -0.004 | 4.96 | 4.96 |
| ubs-rv | UBS RV | UBS | RV | 10,704,128 | 0.37 | 0.37 | null | null |
| ubs-rf | UBS RF | UBS | RF | 2,220,845 | -0.35 | -0.35 | null | null |
| wam | WAM (Goyo) | WAM | RF | 6,089,314 | 18.11 | 0.48 | null | null |
| abel | Abel (BK+IB) | Abel Font | RV+RF | 20,933,017 | null | -2.68 | -8.05 | 11.44 |
| andbank | Andbank Bons | Andbank | RF | 6,088,661 | 17.76 | 0.60 | 4.18 | 6.32 |

**Field notes:**
- `rendPct` for WAM and Andbank is since-inception TWR; for UBS it is YTD; for Abel it is null (complex multi-sleeve). `rendPct` is not rendered in this version — reserved for a future "des de creació" display.
- Abel `ytd`/`r2025`/`r2024` are Bankinter-sleeve only (€16.7M of the €20.9M total).
- `ubs-rv` and `ubs-rf` `r2025`/`r2024` are null (incomplete TWR data extracted).

Abel total = 16,676,391 (Bankinter, confirmed 19/03/2026) + 4,256,627 (IB, Dec 2025 starting NAV).

**Total portfolio: ~€58,064,070**
- RV estimate: ~34.5M (59.4%)
- RF estimate: ~22.6M (38.9%)
- Other/Liquidity: ~1.0M (1.7%)

---

## 3. Component — `src/components/PublicMarketsTab.jsx`

No props. Reads from `PM_MONTHLY` and `PM_MANAGERS` directly (static imports). Uses `useTheme()` for colors.

### KpiCard (local)
`KpiCard` is **not exported** from FundDetail.jsx. Replicate it as a local function in `PublicMarketsTab.jsx`:
```jsx
function KpiCard({ label, value, sub, tc, valueColor }) { ... }
```
Same structure: card background, uppercase label, DM Mono value, optional sub line.

### Section ①: KPI Cards (5 cards, flex-wrap row)

| Label | Value | Derivation |
|-------|-------|------------|
| Total Patrimoni | fmtM(total) | `PM_MANAGERS.reduce((s, m) => s + m.valorActual, 0)` |
| Renda Variable | fmtM(rv) + " · X%" | `PM_MANAGERS.reduce`: `tipus === "RV"` → full `valorActual`; `tipus === "RV+RF"` → `valorActual * 0.7516` (Bankinter split); `tipus === "RF"` → 0 |
| Renda Fixa | fmtM(rf) + " · X%" | `PM_MANAGERS.reduce`: `tipus === "RF"` → full `valorActual`; `tipus === "RV+RF"` → `valorActual * 0.1868`; `tipus === "RV"` → 0 |
| YTD Global | X% | Weighted avg: `sum(m.ytd * m.valorActual) / sum(m.valorActual)` where `m.ytd != null` |
| Millor Gestor 2025 | "Caixa RV · +9.51%" | `PM_MANAGERS.filter(m => m.r2025 != null).sort by r2025 desc [0]` |

The RV+RF split percentages (75.16% / 18.68%) come from the Bankinter Mar 2026 report and are applied uniformly to the full Abel `valorActual` (BK + IB). The remaining ~6.16% (cash/liquidity) is excluded from both totals — consistent with how Per Actiu chart handles it. All four KPI values therefore stay in sync when `PM_MANAGERS` is updated.

### Section ②: Portfolio Evolution Chart

Container card with `borderRadius: 10`, `padding: 20px 24px`.

**Toggle bar** (3 buttons, top-right): `Total` | `Per Actiu` | `Per Gestor`

**Chart data** derived via `useMemo` from `PM_MONTHLY`. WAM and Andbank values are sourced from `PM_MANAGERS` (not hardcoded), so they stay in sync if the data is updated:
```js
const wamVal    = PM_MANAGERS.find(m => m.id === "wam").valorActual;
const andbankVal = PM_MANAGERS.find(m => m.id === "andbank").valorActual;
```

**Chart modes:**

`Total` — single `total` key per point:
```js
total = caixaRV + caixaRF + ubsRV + ubsRF + (abelBK ?? 0)
// WAM and Andbank excluded (no monthly series)
```
Single `<Area dataKey="total">`. A text note below the chart reads: "WAM (€6.1M) i Andbank (€6.1M) no inclosos a la sèrie temporal per manca de dades mensuals."

`Per Actiu` — two keys: `rv` and `rf`:
```js
rv = caixaRV + ubsRV + (abelBK != null ? abelBK * 0.7516 : 0)
rf = caixaRF + ubsRF + (abelBK != null ? abelBK * 0.1868 : 0)
// The remaining ~6.16% of abelBK (cash/liquidity) is excluded from both stacks.
// This means the Per Actiu chart understates total by up to ~1M when abelBK is present.
// RV/RF split percentages (75.16%/18.68%) are from the Bankinter report and apply to abelBK only.
```
Two stacked `<Area>` components: RV (`#2B5070`), RF (`#E8A020`).

`Per Gestor` — five keys per point:
```js
caixa   = caixaRV + caixaRF
ubs     = ubsRV + ubsRF
abel    = abelBK ?? 0
wam     = wamVal     // flat line sourced from PM_MANAGERS
andbank = andbankVal // flat line sourced from PM_MANAGERS
```
Five stacked `<Area>` components: Caixa (`#2B5070`), UBS (`#E8A020`), Abel (`#3DC83E`), WAM (`#6B2E7E`), Andbank (`#7A6000`).

**Recharts config:**
- `<AreaChart>` with `stackOffset="none"` (absolute values, not percentage)
- `<CartesianGrid strokeDasharray="3 3">`
- `<XAxis dataKey="label" tick={{ fontSize: 10 }}>`
- `<YAxis tickFormatter={fmtM} width={70}>`
- `<Tooltip>` with custom formatter showing each active series + total
- Height: 280px

### Section ③: Manager Section

**Manager cards grid** (`display: flex`, `flexWrap: wrap`, `gap: 12`):
One card per `PM_MANAGERS` entry. Each card (~200px wide) shows:
- Manager name (`nom`) + asset type badge (`Badge` from SharedComponents, color from `tipus`)
- Current value: large DM Mono
- YTD chip: green if `> 0`, red if `< 0`, grey if `null`
- `r2025`: small line (or "—")
- `r2024`: small line (or "—")
- Gestor name: small `tc.textLight`

**Performance bar chart** (grouped, below cards):
- `<BarChart>` height 220px
- X-axis: abbreviated manager names
- Three `<Bar>` groups per manager: `ytd` (blue `#2B5070`), `r2025` (green `#3DC83E`), `r2024` (amber `#E8A020`)
- Null values: excluded (bar simply absent for that manager × year combination)
- Y-axis: percentage, `tickFormatter={v => v + "%"}`
- Only show managers with at least one non-null return value

---

## 4. File Map

| File | Action |
|------|--------|
| `src/data/publicMarkets.js` | Create — `PM_MONTHLY` + `PM_MANAGERS` |
| `src/components/PublicMarketsTab.jsx` | Create — full tab component with local `KpiCard` |
| `src/components/Dashboard.jsx` | Modify — SUPRA array, `supra` derivation, click handler, keyboard nav, tab bar, render, import |

No changes to router, config, utils, theme, or SharedComponents.

---

## 5. Out of Scope (future)

- Live price scraping via Vercel function (ISIN → current NAV)
- XLSX upload to refresh position data
- Real Estate tab content
- Individual position drilldown / holdings table
- `rendPct` "des de creació" display on manager cards
