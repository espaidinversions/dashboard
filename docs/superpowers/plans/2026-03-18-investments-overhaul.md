# Investments Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the investments index into separate `/investments/funds` and `/investments/companies` pages with TVPI/DPI/RVPI columns, change the J-curve to a grouped BarChart, and add a quarterly KPI chart to the company detail page.

**Architecture:** Two new index components (FundsIndex, CompaniesIndex) replace the single InvestmentsIndex. A `FUND_META` array is added to `src/config.js` for manual TVPI input per fund. A `quarters` array field is added to each `PORTFOLIO_COMPANIES` entry in `src/data/searchers.js`. FundDetail and CompanyDetail are updated in-place.

**Tech Stack:** React, Recharts (BarChart, Bar — already installed), React Router v7 (Navigate for redirect)

---

## File Map

| File | Action |
|---|---|
| `src/config.js` | Modify — add `FUND_META` export |
| `src/data/searchers.js` | Modify — add `quarters: []` to each PORTFOLIO_COMPANIES entry |
| `src/components/FundsIndex.jsx` | Create |
| `src/components/CompaniesIndex.jsx` | Create |
| `src/components/InvestmentsIndex.jsx` | Delete |
| `src/router.jsx` | Modify — redirect + 2 new routes, remove old import |
| `src/components/FundDetail.jsx` | Modify — 3 new KPI cards, AreaChart → BarChart |
| `src/components/CompanyDetail.jsx` | Modify — remove LTM cards, add quarterly BarChart |

---

## Task 1: Add FUND_META to src/config.js

**Files:**
- Modify: `src/config.js`

**Context:** `config.js` already exports `RAW_CC`, `ALL_FONS` (line 56: `[...new Set(RAW_CC.map(r=>r.fons))].sort()`). Add `FUND_META` after `ALL_FONS`. One entry per unique fund — use the `ALL_FONS` list as your reference for fund names. All start with `tvpi: null`.

- [ ] **Step 1: Read src/config.js lines 54-57 to confirm ALL_FONS location**

- [ ] **Step 2: Add FUND_META export after ALL_FONS**

Append after line 56 (`export const ALL_FONS = ...`):

```js
// Fund-level metadata — set tvpi manually from fund manager reports
// Use ALL_FONS to identify all fund names. One entry per fund.
export const FUND_META = ALL_FONS.map(fons => ({ fons, tvpi: null }));
```

This derives the list dynamically from `ALL_FONS` so it stays in sync automatically when new funds are added to `RAW_CC`.

- [ ] **Step 3: Verify**

Navigate to the app dev server (`npm run dev` if not running). Open browser console and run:
```js
import('/src/config.js').then(m => console.log(m.FUND_META.length, m.FUND_META[0]))
```
Expected: array length matches number of unique funds, first entry has `{ fons: "...", tvpi: null }`.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\EduardGenís\OneDrive - Espai d'Inversions\Documents\Claude\01. Dashboard" && git add src/config.js && git commit -m "feat: add FUND_META to config.js for per-fund TVPI input"
```

---

## Task 2: Add quarters field to PORTFOLIO_COMPANIES

**Files:**
- Modify: `src/data/searchers.js`

**Context:** Each company in `PORTFOLIO_COMPANIES` needs a `quarters` field. Start with empty arrays — the user will populate actual data later. The component falls back to a placeholder when `quarters` is empty.

- [ ] **Step 1: Add `quarters: []` to every company entry in PORTFOLIO_COMPANIES**

In `src/data/searchers.js`, add `, quarters: []` at the end of each object inside `PORTFOLIO_COMPANIES` (lines ~23–end of array). Every entry gets it.

Example — TTPack becomes:
```js
{nom:"TTPack", tipus:"SF", ..., multEntry:4.65, quarters: []},
```

Do this for all entries in `PORTFOLIO_COMPANIES`. Do NOT modify `ACTIVE_SEARCHERS` or `ALL_SEARCHERS`.

- [ ] **Step 2: Verify**

In browser console:
```js
import('/src/data/searchers.js').then(m => console.log(m.PORTFOLIO_COMPANIES[0].quarters))
```
Expected: `[]`

- [ ] **Step 3: Commit**

```bash
git add src/data/searchers.js && git commit -m "feat: add quarters field to PORTFOLIO_COMPANIES (empty, ready for data)"
```

---

## Task 3: Create FundsIndex.jsx

**Files:**
- Create: `src/components/FundsIndex.jsx`

- [ ] **Step 1: Create the file with the following complete content**

```jsx
import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { RAW_CC as RAW_CC_DEFAULT, FUND_META as FUND_META_DEFAULT } from "../config.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify } from "../utils.js";
import { Badge } from "./SharedComponents.jsx";

const VCPE_CFG = {
  "PE": { color: "#2B4C7E", bg: "#E8EFF5" },
  "VC": { color: "#276749", bg: "#E8F5E9" },
  "RE": { color: "#6B2E7E", bg: "#F3EEF8" },
};
const EST_CFG = {
  "Fons Primari": { color: "#2B4C7E", bg: "#E8EFF5" },
  "Fons de Fons": { color: "#276749", bg: "#D6EAE0" },
  "SOCIMI":       { color: "#6B2E7E", bg: "#F3EEF8" },
};

function FundsIndexInner() {
  const { tc } = useTheme();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("compromis");
  const [sortDir, setSortDir] = useState("desc");

  const rawCC = useMemo(() => {
    try { const s = localStorage.getItem("tc_rawCC"); return s ? JSON.parse(s) : RAW_CC_DEFAULT; }
    catch { return RAW_CC_DEFAULT; }
  }, []);

  const fundMeta = useMemo(() => {
    try { const s = localStorage.getItem("tc_fundMeta"); return s ? JSON.parse(s) : FUND_META_DEFAULT; }
    catch { return FUND_META_DEFAULT; }
  }, []);

  const rows = useMemo(() => {
    const map = new Map();
    for (const r of rawCC) {
      if (!map.has(r.fons)) map.set(r.fons, { fons: r.fons, vcpe: r.vcpe, est: r.est, compromis: 0, calls: 0, dist: 0 });
      const f = map.get(r.fons);
      if (r.cat === "Compromís") f.compromis += r.eur;
      if (r.cat === "Capital Call") f.calls += r.eur;
      if (r.cat === "Distribució" || r.cat === "Retorn Capital") f.dist += Math.abs(r.eur);
    }
    return Array.from(map.values()).map(f => {
      const meta = fundMeta.find(m => m.fons === f.fons);
      const tvpi = meta?.tvpi ?? null;
      const dpi = f.calls > 0 ? f.dist / f.calls : 0;
      const rvpi = tvpi != null ? tvpi - dpi : null;
      return {
        ...f,
        slug: slugify(f.fons),
        utilizat: f.compromis > 0 ? (f.calls / f.compromis) * 100 : null,
        tvpi,
        dpi,
        rvpi,
      };
    });
  }, [rawCC, fundMeta]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => r.fons.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av, bv;
      if (sortKey === "compromis") { av = a.compromis ?? 0; bv = b.compromis ?? 0; }
      else if (sortKey === "cridat") { av = a.calls ?? 0; bv = b.calls ?? 0; }
      else if (sortKey === "utilizat") { av = a.utilizat ?? -1; bv = b.utilizat ?? -1; }
      else if (sortKey === "tvpi") { av = a.tvpi ?? -1; bv = b.tvpi ?? -1; }
      else if (sortKey === "dpi") { av = a.dpi ?? -1; bv = b.dpi ?? -1; }
      else if (sortKey === "rvpi") { av = a.rvpi ?? -1; bv = b.rvpi ?? -1; }
      else { av = a.fons.toLowerCase(); bv = b.fons.toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortArrow = ({ k }) => (
    <span style={{ marginLeft: 3, opacity: sortKey === k ? 1 : 0.2, fontSize: 9 }}>
      {sortKey === k && sortDir === "asc" ? "▲" : "▼"}
    </span>
  );

  const utilizatColor = v => {
    if (v == null) return tc.textLight;
    if (v < 50) return "#E53E3E";
    if (v < 80) return "#D69E2E";
    return tc.green;
  };

  const multipleColor = v => {
    if (v == null) return tc.textLight;
    if (v < 1) return "#E53E3E";
    if (v < 1.5) return "#D69E2E";
    return tc.green;
  };

  const fmtX = v => v != null ? `${v.toFixed(2)}×` : "—";

  const COLS = [
    { k: "nom",       label: "Nom",      align: "left" },
    { k: "tipus",     label: "Tipus",    align: "left" },
    { k: "compromis", label: "Compromís",align: "right" },
    { k: "cridat",    label: "Cridat",   align: "right" },
    { k: "utilizat",  label: "Utilizat", align: "right" },
    { k: "tvpi",      label: "TVPI",     align: "right" },
    { k: "dpi",       label: "DPI",      align: "right" },
    { k: "rvpi",      label: "RVPI",     align: "right" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Dashboard</Link>
        <div style={{ display: "flex", gap: 4 }}>
          <span style={{ padding: "4px 14px", borderRadius: 6, borderBottom: `2px solid ${tc.green}`, color: tc.green, fontSize: 13, fontWeight: 700 }}>Fons</span>
          <Link to="/investments/companies" style={{ padding: "4px 14px", color: tc.textLight, textDecoration: "none", fontSize: 13 }}>Empreses</Link>
        </div>
        <div style={{ flex: 1 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per nom…"
          style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", width: 200 }} />
      </div>

      <div style={{ padding: "24px 32px" }}>
        {sorted.length === 0
          ? <div style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap resultat</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: tc.bgAlt }}>
                  {COLS.map(({ k, label, align }) => (
                    <th key={k} onClick={() => toggleSort(k)}
                      style={{ padding: "10px 12px", textAlign: align, fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                      {label}<SortArrow k={k} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.slug} style={{ background: i % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}` }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                      <Link to={`/fund/${r.slug}`} style={{ color: tc.navy, textDecoration: "none" }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                        {r.fons}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <Badge label={r.vcpe} cfg={VCPE_CFG[r.vcpe] || {}} />
                        {r.est && <Badge label={r.est} cfg={EST_CFG[r.est] || {}} />}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navyLight }}>
                      {r.compromis ? fmtM(r.compromis) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navyLight }}>
                      {r.calls ? fmtM(r.calls) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: utilizatColor(r.utilizat) }}>
                      {r.utilizat != null ? `${r.utilizat.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.tvpi) }}>
                      {fmtX(r.tvpi)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.dpi) }}>
                      {fmtX(r.dpi)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.rvpi) }}>
                      {fmtX(r.rvpi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}

export default function FundsIndex() {
  const [dark, setDark] = useState(() => localStorage.getItem("tc_dark") === "1");
  const tc = dark ? TC_DARK : TC_LIGHT;
  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: () => setDark(d => !d) }}>
      <FundsIndexInner />
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 2: Verify — navigate to `/investments/funds` in the dev server**

Expected: table shows funds with Compromís, Cridat, Utilizat%, TVPI (—), DPI (0.00×), RVPI (—). "Fons" tab is green/active. "Empreses" link navigates to companies page.

- [ ] **Step 3: Commit**

```bash
git add src/components/FundsIndex.jsx && git commit -m "feat: add FundsIndex page at /investments/funds"
```

---

## Task 4: Create CompaniesIndex.jsx

**Files:**
- Create: `src/components/CompaniesIndex.jsx`

- [ ] **Step 1: Create the file with the following complete content**

```jsx
import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PORTFOLIO_COMPANIES } from "../data/searchers.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify } from "../utils.js";
import { Badge } from "./SharedComponents.jsx";

const TIPUS_CFG = {
  "SF": { color: "#276749", bg: "#E8F5E9" },
  "PE": { color: "#2B4C7E", bg: "#E8EFF5" },
};

function CompaniesIndexInner() {
  const { tc } = useTheme();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("ticket");
  const [sortDir, setSortDir] = useState("desc");

  const rows = useMemo(() =>
    PORTFOLIO_COMPANIES.map(c => ({
      ...c,
      slug: slugify(c.nom),
      dpiMultiple: c.ticket > 0 && c.dpiEur != null ? c.dpiEur / c.ticket : null,
      rvpiMultiple: c.ticket > 0 && c.rvpiEur != null ? c.rvpiEur / c.ticket : null,
    })),
  []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => r.nom.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av, bv;
      if (sortKey === "ticket") { av = a.ticket ?? 0; bv = b.ticket ?? 0; }
      else if (sortKey === "tvpi") { av = a.tvpi ?? -1; bv = b.tvpi ?? -1; }
      else if (sortKey === "dpi") { av = a.dpiMultiple ?? -1; bv = b.dpiMultiple ?? -1; }
      else if (sortKey === "rvpi") { av = a.rvpiMultiple ?? -1; bv = b.rvpiMultiple ?? -1; }
      else { av = a.nom.toLowerCase(); bv = b.nom.toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortArrow = ({ k }) => (
    <span style={{ marginLeft: 3, opacity: sortKey === k ? 1 : 0.2, fontSize: 9 }}>
      {sortKey === k && sortDir === "asc" ? "▲" : "▼"}
    </span>
  );

  const multipleColor = v => {
    if (v == null) return tc.textLight;
    if (v < 1) return "#E53E3E";
    if (v < 1.5) return "#D69E2E";
    return tc.green;
  };

  const fmtX = v => v != null ? `${v.toFixed(2)}×` : "—";

  const COLS = [
    { k: "nom",    label: "Nom",    align: "left" },
    { k: "tipus",  label: "Tipus",  align: "left" },
    { k: "ticket", label: "Ticket", align: "right" },
    { k: "tvpi",   label: "TVPI",   align: "right" },
    { k: "dpi",    label: "DPI",    align: "right" },
    { k: "rvpi",   label: "RVPI",   align: "right" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Dashboard</Link>
        <div style={{ display: "flex", gap: 4 }}>
          <Link to="/investments/funds" style={{ padding: "4px 14px", color: tc.textLight, textDecoration: "none", fontSize: 13 }}>Fons</Link>
          <span style={{ padding: "4px 14px", borderRadius: 6, borderBottom: `2px solid ${tc.green}`, color: tc.green, fontSize: 13, fontWeight: 700 }}>Empreses</span>
        </div>
        <div style={{ flex: 1 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per nom…"
          style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", width: 200 }} />
      </div>

      <div style={{ padding: "24px 32px" }}>
        {sorted.length === 0
          ? <div style={{ textAlign: "center", color: tc.textLight, padding: 48 }}>Cap resultat</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: tc.bgAlt }}>
                  {COLS.map(({ k, label, align }) => (
                    <th key={k} onClick={() => toggleSort(k)}
                      style={{ padding: "10px 12px", textAlign: align, fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                      {label}<SortArrow k={k} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.slug} style={{ background: i % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}` }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                      <Link to={`/company/${r.slug}`} style={{ color: tc.navy, textDecoration: "none" }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                        {r.nom}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                        <Badge label={r.tipus} cfg={TIPUS_CFG[r.tipus] || {}} />
                        <span style={{ fontSize: 11, color: tc.textMid }}>{r.segment}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navyLight }}>
                      {fmtM(r.ticket)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.tvpi) }}>
                      {fmtX(r.tvpi)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.dpiMultiple) }}>
                      {fmtX(r.dpiMultiple)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: multipleColor(r.rvpiMultiple) }}>
                      {fmtX(r.rvpiMultiple)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}

export default function CompaniesIndex() {
  const [dark, setDark] = useState(() => localStorage.getItem("tc_dark") === "1");
  const tc = dark ? TC_DARK : TC_LIGHT;
  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: () => setDark(d => !d) }}>
      <CompaniesIndexInner />
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 2: Verify — navigate to `/investments/companies`**

Expected: table shows companies with Ticket, TVPI (color-coded), DPI (×), RVPI (×). "Empreses" tab is green/active.

- [ ] **Step 3: Commit**

```bash
git add src/components/CompaniesIndex.jsx && git commit -m "feat: add CompaniesIndex page at /investments/companies"
```

---

## Task 5: Update router.jsx

**Files:**
- Modify: `src/router.jsx`

- [ ] **Step 1: Replace src/router.jsx with the following complete content**

```jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard.jsx";
import FundsIndex from "./components/FundsIndex.jsx";
import CompaniesIndex from "./components/CompaniesIndex.jsx";
import FundDetail from "./components/FundDetail.jsx";
import CompanyDetail from "./components/CompanyDetail.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/investments" element={<Navigate to="/investments/funds" replace />} />
      <Route path="/investments/funds" element={<FundsIndex />} />
      <Route path="/investments/companies" element={<CompaniesIndex />} />
      <Route path="/fund/:id" element={<FundDetail />} />
      <Route path="/company/:id" element={<CompanyDetail />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Verify — test routing**

- Navigate to `/` — Dashboard loads
- Navigate to `/investments` — redirects to `/investments/funds`
- Click "Empreses" tab — navigates to `/investments/companies`
- Click back to "Fons" tab — navigates to `/investments/funds`
- No console errors

- [ ] **Step 3: Commit**

```bash
git add src/router.jsx && git rm src/components/InvestmentsIndex.jsx && git commit -m "feat: add routing for /investments/funds and /investments/companies, remove InvestmentsIndex"
```

---

## Task 6: Update FundDetail.jsx — TVPI/DPI/RVPI cards + BarChart

**Files:**
- Modify: `src/components/FundDetail.jsx`

**Context:** Current file imports `AreaChart, Area` from recharts and `RAW_CC as RAW_CC_DEFAULT` from config.

- [ ] **Step 1: Update recharts import and add FUND_META import**

Change line 3–6 from:
```jsx
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { RAW_CC as RAW_CC_DEFAULT } from "../config.js";
```

To:
```jsx
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { RAW_CC as RAW_CC_DEFAULT, FUND_META as FUND_META_DEFAULT } from "../config.js";
```

- [ ] **Step 2: Add fundMeta loading in FundDetailInner**

After the existing `rawCC` useMemo (around line 33–38), add:

```jsx
const fundMeta = useMemo(() => {
  try {
    const s = localStorage.getItem("tc_fundMeta");
    return s ? JSON.parse(s) : FUND_META_DEFAULT;
  } catch { return FUND_META_DEFAULT; }
}, []);
```

- [ ] **Step 3: Compute TVPI/DPI/RVPI after existing KPI sums (after line ~64)**

After the existing `const utilPct = ...` line, add:

```jsx
const meta = fundMeta.find(m => m.fons === fundName);
const tvpiFund = meta?.tvpi ?? null;
const dpiFund = calls > 0 ? dist / calls : 0;
const rvpiFund = tvpiFund != null ? tvpiFund - dpiFund : null;
const multipleColor = v => v == null ? tc.textLight : v < 1 ? "#E53E3E" : v < 1.5 ? "#D69E2E" : tc.green;
const fmtX = v => v != null ? `${v.toFixed(2)}×` : "—";
```

- [ ] **Step 4: Add `valueColor` prop to KpiCard in FundDetail.jsx**

The `KpiCard` in `FundDetail.jsx` hardcodes `tc.navy` for the value. Add `valueColor` prop so the new cards can use color-coded multiples.

Find the `KpiCard` definition (look for `function KpiCard`). Change:
```jsx
function KpiCard({ label, value, sub, tc }) {
```
To:
```jsx
function KpiCard({ label, value, sub, tc, valueColor }) {
```
And in its JSX, change the value color from `tc.navy` to `valueColor ?? tc.navy`.

- [ ] **Step 5: Add 3 new KPI cards after the existing 4**

After the closing `</div>` of the existing KPI cards section (after the Net card), add:

```jsx
<KpiCard label="TVPI" value={fmtX(tvpiFund)} sub="Inputat manualment" valueColor={multipleColor(tvpiFund)} tc={tc} />
<KpiCard label="DPI"  value={fmtX(dpiFund)}  valueColor={multipleColor(dpiFund)}  tc={tc} />
<KpiCard label="RVPI" value={fmtX(rvpiFund)} valueColor={multipleColor(rvpiFund)} tc={tc} />
```

- [ ] **Step 6: Replace AreaChart with BarChart in the J-curve section**

Find the `<AreaChart` block (search for `<AreaChart` — don't rely on line numbers) and replace it with:

```jsx
<BarChart data={jCurveData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%" barGap={4}>
  <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
  <XAxis dataKey="data" tick={{ fontSize: 10, fill: tc.textLight }} />
  <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 10, fill: tc.textLight }} width={70} />
  <Tooltip
    formatter={(v, name) => [fmtM(v), name === "cumCalls" ? "Capital Cridat" : "Distribucions"]}
    labelStyle={{ color: tc.text }}
    contentStyle={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8 }}
  />
  <Bar dataKey="cumCalls" name="cumCalls" fill="#2B4C7E" />
  <Bar dataKey="cumDist"  name="cumDist"  fill="#276749" />
</BarChart>
```

- [ ] **Step 7: Verify — navigate to any `/fund/:id` page**

Expected:
- 7 KPI cards total (Compromís, Capital Cridat, Distribucions, Net, TVPI, DPI, RVPI)
- TVPI shows `—` (tvpi is null in FUND_META)
- DPI shows a number if there are distributions, else `0.00×`
- J-curve section shows grouped bars (blue for calls, green for distributions)

- [ ] **Step 8: Commit**

```bash
git add src/components/FundDetail.jsx && git commit -m "feat: add TVPI/DPI/RVPI cards and BarChart J-curve to FundDetail"
```

---

## Task 7: Update CompanyDetail.jsx — quarterly BarChart

**Files:**
- Modify: `src/components/CompanyDetail.jsx`

**Context:** Current file has: (1) KPI cards, (2) Operative metrics section with Ingressos LTM + EBITDA LTM cards, (3) KPI evolution section with placeholder. Remove section 2, replace section 3 with real chart.

- [ ] **Step 1: Update imports — add BarChart, Bar, Legend**

Change the current import (line 1 — only React/useState/useMemo):
```jsx
import React, { useState, useMemo } from "react";
```
Add recharts import after line 1:
```jsx
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from "recharts";
```

- [ ] **Step 2: Update destructuring — add quarters, remove rev/ebitda**

Find the destructuring block around line 37–39:
```jsx
const { nom, tipus, segment, entrepreneurs, origen, geo, ticket,
        tvpi, rvpiEur, dpiEur, mesosOperant, rev, ebitda,
        dataCompr, multEntry } = company;
```

Replace with:
```jsx
const { nom, tipus, segment, entrepreneurs, origen, geo, ticket,
        tvpi, rvpiEur, dpiEur, mesosOperant,
        dataCompr, multEntry, quarters = [] } = company;
```

- [ ] **Step 3: Remove the margin variable (was used in operative metrics)**

Delete line 42:
```jsx
const margin = rev && ebitda ? `${(ebitda / rev * 100).toFixed(1)}% marge` : null;
```

- [ ] **Step 4: Fix kpiTab initial state**

The existing `useState` for `kpiTab` is initialized to `"tvpi"`. The new tab IDs are `"rev"`, `"ebitda"`, `"dfn"`. Change it to `"rev"`:

Find: `const [kpiTab, setKpiTab] = useState("tvpi");`
Replace with: `const [kpiTab, setKpiTab] = useState("rev");`

If no `kpiTab` state exists yet, it will be created in Step 4b — skip this step.

- [ ] **Step 4b: Add LTM calculation and chart config — replace existing KPI_TABS**

Replace the existing `KPI_TABS` constant with:

```jsx
const KPI_CFG = {
  rev:    { label: "Ingressos",  ltmLabel: "Ingressos LTM",  color: "#276749", actualKey: "rev",    budgetKey: "revBudget" },
  ebitda: { label: "EBITDA",     ltmLabel: "EBITDA LTM",     color: "#2B4C7E", actualKey: "ebitda", budgetKey: "ebitdaBudget" },
  dfn:    { label: "Deute Net",  ltmLabel: "Deute Net LTM",  color: "#6B2E7E", actualKey: "dfn",    budgetKey: "dfnBudget" },
};

const KPI_TABS = [
  { id: "rev",    label: "Ingressos" },
  { id: "ebitda", label: "EBITDA" },
  { id: "dfn",    label: "Deute Net" },
];

const ltm = useMemo(() => {
  if (quarters.length === 0) return null;
  const last4 = quarters.slice(-4);
  const sum = key => last4.reduce((s, q) => s + (q[key] ?? 0), 0);
  return { rev: sum("rev"), ebitda: sum("ebitda"), dfn: sum("dfn"), n: last4.length };
}, [quarters]);
```

- [ ] **Step 5: Remove the operative metrics section**

Delete the entire "Operative metrics" section (the JSX block from `{/* Operative metrics */}` through its closing `</div>` — lines ~77–87 in the original file). This is the section containing "Ingressos LTM" and "EBITDA LTM" cards.

- [ ] **Step 6: Replace the KPI evolution section with the quarterly chart**

Find the `{/* KPI evolution (placeholder) */}` section and replace the entire block with:

```jsx
{/* Quarterly KPIs */}
<div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
  <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 16 }}>Evolució Trimestral</div>
  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
    {KPI_TABS.map(t => (
      <button key={t.id} onClick={() => setKpiTab(t.id)}
        style={{ padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${kpiTab === t.id ? tc.green : tc.border}`, background: kpiTab === t.id ? (dark ? "#0E2820" : "#E8F5E9") : "transparent", color: kpiTab === t.id ? tc.green : tc.textLight, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: kpiTab === t.id ? 700 : 400 }}>
        {t.label}
      </button>
    ))}
  </div>
  {quarters.length === 0
    ? (
      <div style={{ border: `2px dashed ${tc.border}`, borderRadius: 8, padding: "48px 24px", textAlign: "center", color: tc.textLight, fontSize: 13 }}>
        Afegeix dades històriques per veure l'evolució
      </div>
    )
    : (() => {
        const cfg = KPI_CFG[kpiTab];
        const hasBudget = quarters.some(q => q[cfg.budgetKey] != null);
        const ltmVal = ltm?.[cfg.actualKey];
        return (
          <>
            {ltm && (
              <div style={{ background: tc.bgAlt, borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "inline-block" }}>
                <div style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                  {cfg.ltmLabel}{ltm.n < 4 ? ` (${ltm.n} trim.)` : ""}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: tc.navy, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
                  {ltmVal != null ? fmtM(ltmVal) : "—"}
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={quarters} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
                <XAxis dataKey="q" tick={{ fontSize: 10, fill: tc.textLight }} />
                <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 10, fill: tc.textLight }} width={70} />
                <Tooltip
                  formatter={(v, name) => [fmtM(v), name === "actual" ? "Real" : "Pressupost"]}
                  labelStyle={{ color: tc.text }}
                  contentStyle={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8 }}
                />
                {hasBudget && <Legend formatter={v => v === "actual" ? "Real" : "Pressupost"} />}
                <Bar dataKey={cfg.actualKey} name="actual" fill={cfg.color} />
                {hasBudget && <Bar dataKey={cfg.budgetKey} name="budget" fill={cfg.color} fillOpacity={0.35} />}
              </BarChart>
            </ResponsiveContainer>
          </>
        );
      })()
  }
</div>
```

- [ ] **Step 7: Verify — navigate to any `/company/:id` page**

Expected:
- KPI cards section unchanged (5 cards)
- Operative metrics section (LTM cards) is gone
- Quarterly KPIs section shows tabs + placeholder message (no quarters data yet)
- Switching tabs works
- No console errors

To test with data: temporarily add to one company entry:
```js
quarters: [
  { q: "Q1 2024", rev: 2000000, ebitda: 250000, dfn: 1500000, revBudget: 2100000, ebitdaBudget: 260000, dfnBudget: null },
  { q: "Q2 2024", rev: 2200000, ebitda: 280000, dfn: 1450000, revBudget: null, ebitdaBudget: null, dfnBudget: null },
]
```
Then verify the chart renders bars, LTM card shows, budget bar appears only on Q1.
Remove the test data after verification.

- [ ] **Step 8: Commit**

```bash
git add src/components/CompanyDetail.jsx && git commit -m "feat: add quarterly KPI chart to CompanyDetail, remove static LTM cards"
```

---

## Final Verification

- [ ] `/investments` redirects to `/investments/funds`
- [ ] `/investments/funds` shows: Fons tab active, funds table with 8 columns, Utilizat color-coded
- [ ] `/investments/companies` shows: Empreses tab active, companies table with 6 columns
- [ ] Switching between Fons/Empreses tabs works
- [ ] `/fund/:id` shows 7 KPI cards, J-curve as grouped bars
- [ ] `/company/:id` shows quarterly chart with placeholder (no data yet)
- [ ] `npm run build` exits 0 (no TypeScript/import errors)
