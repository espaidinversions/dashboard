# Investment Detail Pages Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add individual detail pages for each capital-call fund and portfolio company, reachable via a new unified `/investments` index and by clicking rows in existing tables.

**Architecture:** Add React Router v6 with `<BrowserRouter>` + `<Routes>`. Three new components — `InvestmentsIndex`, `FundDetail`, `CompanyDetail` — read data from the same localStorage key (`"tc_rawCC"`) and static import that `Dashboard.jsx` uses. Navigation entry points are added to existing table rows via `<Link>` with `stopPropagation` to preserve existing expand behavior.

**Tech Stack:** React 18.3, Vite 6, React Router v6 (`react-router-dom`), Recharts 2.13, existing `TC_LIGHT`/`TC_DARK` theme, `fmtM` formatter, `Badge`/`FlagImg` from `SharedComponents.jsx`.

**Spec:** `docs/superpowers/specs/2026-03-18-investment-detail-pages-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/utils.js` | Modify | Add `slugify` export |
| `src/main.jsx` | Modify | Wrap app in `<BrowserRouter>`, render `<AppRoutes>` |
| `src/router.jsx` | Create | `<AppRoutes>` with all route definitions + dev collision check |
| `src/components/InvestmentsIndex.jsx` | Create | Unified sortable table of all funds + companies |
| `src/components/FundDetail.jsx` | Create | Fund detail: 4 KPI cards, J-curve chart, transaction log |
| `src/components/CompanyDetail.jsx` | Create | Company detail: 5 KPI cards, operative metrics, chart placeholder |
| `src/components/Dashboard.jsx` | Modify | Add `<Link>` on fund name cells; add "Inversions" header nav link |
| `src/components/PortfolioCompaniesTab.jsx` | Modify | Add `<Link>` on company name cells |
| `package.json` | Modify | Add `react-router-dom` dependency |

---

## Task 1: Install dependency and add `slugify`

**Files:**
- Modify: `package.json`
- Modify: `src/utils.js`

- [ ] **Step 1: Install react-router-dom**

```bash
npm install react-router-dom
```

Expected: `react-router-dom` appears in `package.json` dependencies, no errors.

- [ ] **Step 2: Add `slugify` to `src/utils.js`**

Append after the existing `usePersistedState` export at the end of the file:

```js
// ── Slug utility ──────────────────────────────────────────
export function slugify(str) {
  return String(str).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
```

- [ ] **Step 3: Verify in browser console**

Start dev server (`npm run dev`), open browser console, run:
```js
import('/src/utils.js').then(m => console.log(m.slugify('ACP Secondaries 4 FCR')))
```
Expected output: `"acp-secondaries-4-fcr"`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/utils.js
git commit -m "feat: add react-router-dom and slugify utility"
```

---

## Task 2: Set up routing

**Files:**
- Create: `src/router.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: Create `src/router.jsx`**

```jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard.jsx";
import InvestmentsIndex from "./components/InvestmentsIndex.jsx";
import FundDetail from "./components/FundDetail.jsx";
import CompanyDetail from "./components/CompanyDetail.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/investments" element={<InvestmentsIndex />} />
      <Route path="/fund/:id" element={<FundDetail />} />
      <Route path="/company/:id" element={<CompanyDetail />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Update `src/main.jsx`**

Replace the entire file with:

```jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import AppRoutes from "./router.jsx";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
);
```

- [ ] **Step 3: Create stub components so app compiles**

Create `src/components/InvestmentsIndex.jsx`:
```jsx
import React from "react";
export default function InvestmentsIndex() {
  return <div style={{padding:32}}>InvestmentsIndex — coming soon</div>;
}
```

Create `src/components/FundDetail.jsx`:
```jsx
import React from "react";
export default function FundDetail() {
  return <div style={{padding:32}}>FundDetail — coming soon</div>;
}
```

Create `src/components/CompanyDetail.jsx`:
```jsx
import React from "react";
export default function CompanyDetail() {
  return <div style={{padding:32}}>CompanyDetail — coming soon</div>;
}
```

- [ ] **Step 4: Verify routing works**

With dev server running, navigate to:
- `http://localhost:5173/` → Dashboard renders normally
- `http://localhost:5173/investments` → "InvestmentsIndex — coming soon"
- `http://localhost:5173/fund/test` → "FundDetail — coming soon"
- `http://localhost:5173/company/test` → "CompanyDetail — coming soon"

- [ ] **Step 5: Commit**

```bash
git add src/main.jsx src/router.jsx src/components/InvestmentsIndex.jsx src/components/FundDetail.jsx src/components/CompanyDetail.jsx
git commit -m "feat: wire up React Router with stub pages"
```

---

## Task 3: Investments Index page

**Files:**
- Modify: `src/components/InvestmentsIndex.jsx`

This page replaces the stub. It reads from both `rawCC` (funds) and the static `PORTFOLIO_COMPANIES` import, renders a unified sortable table.

- [ ] **Step 1: Implement `InvestmentsIndex.jsx`**

Replace stub with full implementation:

```jsx
import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { RAW_CC as RAW_CC_DEFAULT } from "../config.js";
import { PORTFOLIO_COMPANIES } from "../data/searchers.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify } from "../utils.js";
import { Badge } from "./SharedComponents.jsx";

function InvestmentsIndexInner() {
  const { tc, dark } = useTheme();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("compromis");
  const [sortDir, setSortDir] = useState("desc");

  // Load rawCC (same pattern as Dashboard.jsx)
  const rawCC = useMemo(() => {
    try {
      const s = localStorage.getItem("tc_rawCC");
      return s ? JSON.parse(s) : RAW_CC_DEFAULT;
    } catch { return RAW_CC_DEFAULT; }
  }, []);

  // Build fund rows: one entry per unique fons
  const fundRows = useMemo(() => {
    const map = new Map();
    for (const r of rawCC) {
      if (!map.has(r.fons)) {
        map.set(r.fons, { fons: r.fons, vcpe: r.vcpe, compromis: 0, calls: 0 });
      }
      const f = map.get(r.fons);
      if (r.cat === "Compromís") f.compromis += r.eur;
      if (r.cat === "Capital Call") f.calls += r.eur;
    }
    return Array.from(map.values()).map(f => ({
      ...f,
      slug: slugify(f.fons),
      tipus: `Fons ${f.vcpe}`,
      utilitat: f.compromis > 0 ? (f.calls / f.compromis) * 100 : null,
    }));
  }, [rawCC]);

  // Build company rows
  const companyRows = useMemo(() =>
    PORTFOLIO_COMPANIES.map(c => ({
      nom: c.nom,
      slug: slugify(c.nom),
      tipus: c.tipus === "SF" ? "Empresa SF" : "Empresa PE",
      compromis: c.ticket,
      calls: null,
      utilitat: null,
      tvpi: c.tvpi,
      _isCompany: true,
    })),
  []);

  const allRows = useMemo(() => [...fundRows, ...companyRows], [fundRows, companyRows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter(r => (r.fons || r.nom).toLowerCase().includes(q));
  }, [allRows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av, bv;
      if (sortKey === "compromis") { av = a.compromis ?? 0; bv = b.compromis ?? 0; }
      else if (sortKey === "utilitat") { av = a.utilitat ?? -1; bv = b.utilitat ?? -1; }
      else if (sortKey === "tvpi") { av = a.tvpi ?? -1; bv = b.tvpi ?? -1; }
      else { av = (a.fons || a.nom).toLowerCase(); bv = (b.fons || b.nom).toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortArrow = ({ k }) => (
    <span style={{ marginLeft: 3, opacity: sortKey === k ? 1 : 0.2, fontSize: 9 }}>
      {sortKey === k && sortDir === "asc" ? "▲" : "▼"}
    </span>
  );

  const tvpiColor = (v) => {
    if (v == null) return tc.textLight;
    if (v < 1) return "#E53E3E";
    if (v < 1.5) return "#D69E2E";
    return tc.green;
  };

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      {/* Header */}
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Dashboard</Link>
        <span style={{ fontSize: 18, fontWeight: 700, color: tc.navy, letterSpacing: "-0.02em" }}>
          Totes les <span style={{ color: tc.green }}>Inversions</span>
        </span>
        <div style={{ flex: 1 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca per nom…"
          style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", width: 200 }}
        />
      </div>

      {/* Table */}
      <div style={{ padding: "24px 32px" }}>
        {sorted.length === 0
          ? <div style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap resultat</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: tc.bgAlt }}>
                  {[
                    { k: "nom", label: "Nom" },
                    { k: "tipus", label: "Tipus" },
                    { k: "compromis", label: "Compromís" },
                    { k: "utilitat", label: "Utilizat" },
                    { k: "tvpi", label: "TVPI" },
                  ].map(({ k, label }) => (
                    <th key={k}
                      onClick={() => toggleSort(k)}
                      style={{ padding: "10px 12px", textAlign: k === "nom" || k === "tipus" ? "left" : "right", fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                      {label}<SortArrow k={k} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const name = r.fons || r.nom;
                  const href = r._isCompany ? `/company/${r.slug}` : `/fund/${r.slug}`;
                  const bg = i % 2 === 0 ? "transparent" : tc.bgAlt;
                  return (
                    <tr key={r.slug} style={{ background: bg, borderBottom: `1px solid ${tc.border}` }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                        <Link to={href} style={{ color: tc.navy, textDecoration: "none" }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                          {name}
                        </Link>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: tc.textMid }}>{r.tipus}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navyLight }}>
                        {r.compromis ? fmtM(r.compromis) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>
                        {r.utilitat != null ? `${r.utilitat.toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: tvpiColor(r.tvpi) }}>
                        {r.tvpi != null ? `${r.tvpi.toFixed(2)}×` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}

export default function InvestmentsIndex() {
  const { dark } = useTheme();
  return (
    <ThemeContext.Provider value={dark ? TC_DARK : TC_LIGHT}>
      <InvestmentsIndexInner />
    </ThemeContext.Provider>
  );
}
```


- [ ] **Step 2: Verify**

Navigate to `http://localhost:5173/investments`.
- Table shows a mix of funds and companies
- Sort by "Compromís" column works (click header)
- Search filters rows
- Clicking a name navigates to the stub detail page

- [ ] **Step 3: Commit**

```bash
git add src/components/InvestmentsIndex.jsx
git commit -m "feat: add investments index page with unified sortable table"
```

---

## Task 4: Fund Detail page

**Files:**
- Modify: `src/components/FundDetail.jsx`

- [ ] **Step 1: Implement `FundDetail.jsx`**

Replace stub with:

```jsx
import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { RAW_CC as RAW_CC_DEFAULT } from "../config.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify } from "../utils.js";
import { Badge } from "./SharedComponents.jsx";

const CAT_CFG = {
  "Capital Call":   { color: "#2B4C7E", bg: "#E8EFF5" },
  "Distribució":    { color: "#276749", bg: "#E8F5E9" },
  "Retorn Capital": { color: "#1E5738", bg: "#D6EAE0" },
  "Compromís":      { color: "#6B8CAE", bg: "#EAF0F6" },
  "Altres":         { color: "#999",    bg: "#F0F0F0" },
};

function KpiCard({ label, value, sub, tc }) {
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px", minWidth: 160, flex: 1 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tc.navy, fontFamily: "'DM Mono',monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: tc.textLight, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function FundDetailInner() {
  const { id } = useParams();
  const { tc, dark } = useTheme();

  const rawCC = useMemo(() => {
    try {
      const s = localStorage.getItem("tc_rawCC");
      return s ? JSON.parse(s) : RAW_CC_DEFAULT;
    } catch { return RAW_CC_DEFAULT; }
  }, []);

  // Find all transactions for this fund
  const txs = useMemo(
    () => rawCC.filter(r => slugify(r.fons) === id),
    [rawCC, id]
  );

  if (txs.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", padding: 32 }}>
        <Link to="/investments" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Inversions</Link>
        <div style={{ marginTop: 48, textAlign: "center", color: tc.textLight }}>Fons no trobat.</div>
      </div>
    );
  }

  const fundName = txs[0].fons;
  const vcpe = txs[0].vcpe;
  const est = txs[0].est;

  // KPI sums
  const compromis = txs.filter(r => r.cat === "Compromís").reduce((s, r) => s + r.eur, 0);
  const calls     = txs.filter(r => r.cat === "Capital Call").reduce((s, r) => s + r.eur, 0);
  const dist      = txs.filter(r => r.cat === "Distribució" || r.cat === "Retorn Capital").reduce((s, r) => s + Math.abs(r.eur), 0);
  const net       = dist - calls;
  const utilPct   = compromis > 0 ? (calls / compromis * 100).toFixed(1) + "%" : null;

  // J-curve data: sort by date, compute running sums
  const jCurveRows = txs
    .filter(r => r.cat === "Capital Call" || r.cat === "Distribució" || r.cat === "Retorn Capital")
    .sort((a, b) => a.data.localeCompare(b.data));

  const jCurveData = useMemo(() => {
    let cumCalls = 0, cumDist = 0;
    return jCurveRows.map(r => {
      if (r.cat === "Capital Call") cumCalls += r.eur;
      else cumDist += Math.abs(r.eur);
      return { data: r.data, cumCalls, cumDist };
    });
  }, [jCurveRows]);

  // Transaction log: sorted newest first
  const txLog = [...txs].sort((a, b) => b.data.localeCompare(a.data));

  const vcpeCfg = {
    "PE": { color: "#2B4C7E", bg: "#E8EFF5" },
    "VC": { color: "#276749", bg: "#E8F5E9" },
    "RE": { color: "#6B2E7E", bg: "#F3EEF8" },
  };
  const estCfg = {
    "Fons Primari": { color: "#2B4C7E", bg: "#E8EFF5" },
    "Fons de Fons": { color: "#276749", bg: "#D6EAE0" },
    "SOCIMI":       { color: "#6B2E7E", bg: "#F3EEF8" },
  };

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      {/* Header */}
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/investments" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Inversions</Link>
        <span style={{ fontSize: 18, fontWeight: 700, color: tc.navy, letterSpacing: "-0.02em", flex: 1 }}>{fundName}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <Badge label={vcpe} cfg={vcpeCfg[vcpe] || {}} />
          <Badge label={est}  cfg={estCfg[est]   || {}} />
        </div>
      </div>

      <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* KPI cards */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <KpiCard label="Compromís"      value={compromis ? fmtM(compromis) : "—"} tc={tc} />
          <KpiCard label="Capital Cridat" value={fmtM(calls)} sub={utilPct ? `${utilPct} del compromís` : null} tc={tc} />
          <KpiCard label="Distribucions"  value={dist ? fmtM(dist) : "—"} tc={tc} />
          <KpiCard label="Net"            value={(net >= 0 ? "+" : "") + fmtM(net)} tc={tc} />
        </div>

        {/* J-curve */}
        <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 16 }}>Evolució acumulada (J-curve)</div>
          {jCurveData.length === 0
            ? <div style={{ textAlign: "center", color: tc.textLight, padding: "32px 0" }}>Encara no hi ha aportacions registrades.</div>
            : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={jCurveData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: tc.textLight }} />
                  <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 10, fill: tc.textLight }} width={70} />
                  <Tooltip formatter={(v, name) => [fmtM(v), name === "cumCalls" ? "Capital Cridat" : "Distribucions"]} labelStyle={{ color: tc.text }} contentStyle={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="cumCalls" name="cumCalls" stroke="#2B4C7E" fill={dark ? "#1A2F45" : "#E8EFF5"} strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="cumDist"  name="cumDist"  stroke="#276749" fill={dark ? "#0E2820" : "#E8F5E9"} strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Transaction log */}
        <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 16 }}>
            Transaccions · {txLog.length}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: tc.bgAlt }}>
                {["Data", "Tipus", "Categoria", "Import"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: h === "Import" ? "right" : "left", fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txLog.map((r, i) => {
                const cfg = CAT_CFG[r.cat] || {};
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${tc.border}`, background: i % 2 === 0 ? "transparent" : tc.bgAlt }}>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: tc.textMid }}>{r.data}</td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: tc.textMid }}>{r.tipus}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontSize: 10, background: cfg.bg || tc.bgAlt, color: cfg.color || tc.textMid, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>
                        {r.cat}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: r.eur > 0 ? tc.navy : tc.green }}>
                      {r.eur < 0 && "+ "}{fmtM(Math.abs(r.eur))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function FundDetail() {
  const { dark } = useTheme();
  return (
    <ThemeContext.Provider value={dark ? TC_DARK : TC_LIGHT}>
      <FundDetailInner />
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to `http://localhost:5173/fund/acp-secondaries-4-fcr` (or any valid slug from your data):
- Fund name appears in header with VCPE and strategy badges
- 4 KPI cards show correct values
- J-curve chart renders with two area series
- Transaction log shows all transactions sorted newest-first
- Navigate to `http://localhost:5173/fund/nonexistent` → "Fons no trobat." message

- [ ] **Step 3: Commit**

```bash
git add src/components/FundDetail.jsx
git commit -m "feat: add fund detail page with J-curve and transaction log"
```

---

## Task 5: Company Detail page

**Files:**
- Modify: `src/components/CompanyDetail.jsx`

- [ ] **Step 1: Implement `CompanyDetail.jsx`**

Replace stub with:

```jsx
import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { PORTFOLIO_COMPANIES } from "../data/searchers.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify } from "../utils.js";
import { FlagImg } from "./SharedComponents.jsx";

function KpiCard({ label, value, sub, valueColor, tc }) {
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px", minWidth: 130, flex: 1 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor || tc.navy, fontFamily: "'DM Mono',monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: tc.textLight, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function CompanyDetailInner() {
  const { id } = useParams();
  const { tc, dark } = useTheme();
  const [kpiTab, setKpiTab] = useState("tvpi");

  const company = useMemo(
    () => PORTFOLIO_COMPANIES.find(c => slugify(c.nom) === id),
    [id]
  );

  if (!company) {
    return (
      <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", padding: 32 }}>
        <Link to="/investments" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Inversions</Link>
        <div style={{ marginTop: 48, textAlign: "center", color: tc.textLight }}>Empresa no trobada.</div>
      </div>
    );
  }

  const { nom, tipus, segment, entrepreneurs, origen, geo, ticket,
          tvpi, rvpiEur, dpiEur, mesosOperant, rev, ebitda,
          dataCompr, multEntry } = company;

  const tvpiColor = tvpi == null ? tc.textLight : tvpi < 1 ? "#E53E3E" : tvpi < 1.5 ? "#D69E2E" : tc.green;
  const margin = rev && ebitda ? `${(ebitda / rev * 100).toFixed(1)}% marge` : null;

  const KPI_TABS = [
    { id: "tvpi", label: "TVPI" },
    { id: "rev", label: "Ingressos" },
    { id: "ebitda", label: "EBITDA" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      {/* Header */}
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/investments" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Inversions</Link>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: tc.navy, letterSpacing: "-0.02em" }}>{nom}</span>
            <span style={{ fontSize: 11, background: tc.bgAlt, color: tc.textMid, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>{tipus}</span>
            <span style={{ fontSize: 11, background: tc.bgAlt, color: tc.textMid, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>{segment}</span>
            {geo && <FlagImg geo={geo} size={18} />}
          </div>
          {entrepreneurs && <div style={{ fontSize: 12, color: tc.textLight, marginTop: 3 }}>{entrepreneurs}</div>}
        </div>
      </div>

      <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* KPI cards */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <KpiCard label="Ticket"        value={fmtM(ticket)} tc={tc} />
          <KpiCard label="TVPI"          value={tvpi != null ? `${tvpi.toFixed(2)}×` : "—"} valueColor={tvpiColor} tc={tc} />
          <KpiCard label="RVPI"          value={fmtM(rvpiEur ?? 0)} tc={tc} />
          <KpiCard label="DPI"           value={fmtM(dpiEur ?? 0)} tc={tc} />
          <KpiCard label="Mesos operant" value={mesosOperant ?? "—"} tc={tc} />
        </div>

        {/* Operative metrics */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px", flex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }}>Ingressos LTM</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: tc.navy, fontFamily: "'DM Mono',monospace" }}>{rev != null ? fmtM(rev) : "—"}</div>
            {margin && <div style={{ fontSize: 11, color: tc.textLight, marginTop: 4 }}>{margin}</div>}
          </div>
          <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px", flex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }}>EBITDA LTM</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: tc.navy, fontFamily: "'DM Mono',monospace" }}>{ebitda != null ? fmtM(ebitda) : "—"}</div>
          </div>
        </div>

        {/* KPI evolution (placeholder) */}
        <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 16 }}>Evolució KPIs</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {KPI_TABS.map(t => (
              <button key={t.id} onClick={() => setKpiTab(t.id)}
                style={{ padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${kpiTab === t.id ? tc.green : tc.border}`, background: kpiTab === t.id ? (dark ? "#0E2820" : "#E8F5E9") : "transparent", color: kpiTab === t.id ? tc.green : tc.textLight, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: kpiTab === t.id ? 700 : 400 }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ border: `2px dashed ${tc.border}`, borderRadius: 8, padding: "48px 24px", textAlign: "center", color: tc.textLight, fontSize: 13 }}>
            Afegeix dades històriques per veure l'evolució
          </div>
        </div>

        {/* Entry info */}
        <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12 }}>Entrada</div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {[
              ["Data d'entrada", dataCompr || "—"],
              ["Múltiple entrada", multEntry != null ? `${multEntry}×` : "—"],
              ["Origen", origen || "—"],
              ["Emprenedors", entrepreneurs || "—"],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: tc.text }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompanyDetail() {
  const { dark } = useTheme();
  return (
    <ThemeContext.Provider value={dark ? TC_DARK : TC_LIGHT}>
      <CompanyDetailInner />
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 3: Verify**

Navigate to a valid company slug (e.g. `http://localhost:5173/company/collective`):
- Company name, type badge, segment badge, country flag in header
- 5 KPI cards with correct values (TVPI color-coded)
- Revenue + EBITDA cards (null values show "—")
- KPI evolution tabs switch but all show placeholder
- Entry info section shows date, multiple, origin, entrepreneurs
- Navigate to `/company/nonexistent` → "Empresa no trobada."

- [ ] **Step 4: Commit**

```bash
git add src/components/CompanyDetail.jsx
git commit -m "feat: add company detail page with KPI cards and evolution placeholder"
```

---

## Task 6: Wire navigation entry points

**Files:**
- Modify: `src/components/Dashboard.jsx`
- Modify: `src/components/PortfolioCompaniesTab.jsx`

- [ ] **Step 1: Add `slugify` import and "Inversions" nav link to `Dashboard.jsx`**

At the top of `Dashboard.jsx`, add to the imports:
```js
import { Link } from "react-router-dom";
import { slugify } from "../utils.js";
```

In the header section (around line 415, the `<div style={{display:"flex",alignItems:"center",gap:10}}>` that holds the buttons), add before the "↑ Carregar dades" button:

```jsx
<Link to="/investments"
  style={{ background: "transparent", color: tc.textMid, border: `1.5px solid ${tc.border}`, borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontFamily: "inherit", textDecoration: "none" }}>
  Inversions
</Link>
```

- [ ] **Step 2: Add `<Link>` to fund name cell in "Per Fons" table**

In `Dashboard.jsx` around line 794, the fund name `<td>` currently contains just `{f.fons}`. Wrap it in a Link:

```jsx
<td style={{padding:"10px 10px",fontWeight:700,color:isExp?tc.green:tc.text,fontSize:12,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
  <Link
    to={`/fund/${slugify(f.fons)}`}
    onClick={e => e.stopPropagation()}
    style={{ color: "inherit", textDecoration: "none" }}
    onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
    onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
  >
    {f.fons}
  </Link>
</td>
```

The `e.stopPropagation()` prevents the row-expand `onClick` from firing when clicking the link.

- [ ] **Step 3: Verify Dashboard.jsx**

- "Inversions" link appears in header, navigates to `/investments`
- Clicking a fund name navigates to `/fund/:id`
- Clicking elsewhere on the fund row still expands the inline transaction sub-row

- [ ] **Step 4: Add `<Link>` to company name cells in `PortfolioCompaniesTab.jsx`**

Read `src/components/PortfolioCompaniesTab.jsx` to find the company name cell. Add these imports:

```js
import { Link } from "react-router-dom";
import { slugify } from "../utils.js";
```

Wrap the company name cell content (wherever `c.nom` or the company name is rendered in a `<td>`) with:

```jsx
<Link
  to={`/company/${slugify(c.nom)}`}
  style={{ color: "inherit", textDecoration: "none" }}
  onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
  onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
>
  {c.nom}
</Link>
```

- [ ] **Step 5: Verify full navigation flow**

End-to-end test:
1. `http://localhost:5173/` → Dashboard loads
2. Click "Inversions" in header → `/investments` opens
3. Click any fund row → `/fund/:id` opens with correct data
4. Click "← Inversions" → back to `/investments`
5. Click "← Dashboard" (if present) → back to `/`
6. Navigate to "Portfolio Companies" section in Dashboard
7. Click any company name → `/company/:id` opens
8. Direct URL `http://localhost:5173/fund/acp-secondaries-4-fcr` → loads without 404

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.jsx src/components/PortfolioCompaniesTab.jsx
git commit -m "feat: wire navigation links from fund and company tables to detail pages"
```

---

## Done

All tasks complete when:
- `/investments` shows unified table of all funds + companies, sortable, searchable
- `/fund/:id` shows KPI cards, J-curve, transaction log for any fund
- `/company/:id` shows KPI cards, operative metrics, evolution placeholder for any company
- Clicking fund names in "Per Fons" navigates to fund detail (row expansion preserved)
- Clicking company names in Portfolio Companies navigates to company detail
- "Inversions" nav link in Dashboard header works
- Direct URL loads work (no 404 on refresh)
- "Not found" states render cleanly for invalid slugs
