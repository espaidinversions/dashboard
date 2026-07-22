# Landing Page ("Inici") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a section-agnostic default landing tab ("Inici") that shows a portfolio-wide KPI strip plus one click-through card per top-level section the user can access.

**Architecture:** A pure aggregation module (`landingModel.js`) rolls up the cash-flow rows already in `useDashboardData` into per-section summaries and a headline. A presentational `LandingTab` renders the KPI strip + section cards from that model. Mercats Públics is value-based (not cash-flow), so its card lazy-loads its own value from `usePmMonthly` in a Suspense boundary and only mounts when the user has PM access. Permission filtering happens in the model layer.

**Tech Stack:** React 18 (function components, hooks, `lazy`/`Suspense`), Vite, `react-router-dom` search params, Node `node --test` runner.

## Global Constraints

- UI copy is **Catalan**. Section labels: "Alternatius", "Real Estate", "Mercats Públics". KPI labels: "Total Invertit", "Compromès pendent", "Total Retornat", "# posicions", "Valor actual".
- Money is EUR; rows already carry a signed `eur` number. No FX work in any new module.
- Cash-flow category conventions (match `src/data/altCohortModel.js`): `invertit` = Σ `eur` where `cat === "Capital Call"`; `retornat` = Σ `Math.abs(eur)` where `cat ∈ {"Distribució","Retorn Capital"}`; committed = Σ `eur` where `cat === "Compromís"`; `compromesPendent = max(0, committed − invertit)`.
- New source files must stay under 800 lines; models are pure (no React, no I/O) and unit-tested.
- Existing Supabase migrations are immutable. This feature adds **no** migrations and **no** API endpoints.
- Deploy target is the `master` branch through the existing CI → Vercel pipeline.

---

### Task 1: `landingModel.js` — pure aggregation

**Files:**
- Create: `src/data/landingModel.js`
- Test: `test/landingModel.test.js`

**Interfaces:**
- Consumes: capital-call row objects shaped `{ id, fons, cat, est, eur }` (as produced by `useDashboardData`); an access predicate `canAccess(sectionId: string) => boolean`; an optional `pmSummary` object `{ valorActual: number, nGestors: number } | null`.
- Produces:
  - `buildSectionSummary({ tx, compr, sectionId, label }) => { sectionId, label, kind: "cashflow", invertit, compromesPendent, retornat, netCashFlow, nPosicions }`
  - `buildLandingModel({ altTx, altCompr, reTx, reCompr, pmSummary, canAccess }) => { headline, cards }`
    - `cards`: ordered array; cash-flow cards for `"alternatives"` / `"real-estate"`, plus a value card `{ sectionId: "mercats-publics", label: "Mercats Públics", kind: "value", valorActual, nGestors }` when `pmSummary` is non-null.
    - `headline`: `{ kind: "cashflow", invertit, compromesPendent, retornat, nPosicions }` rolled up over included cash-flow cards; OR `{ kind: "value", valorActual }` when no cash-flow section is accessible but PM is.
  - `SECTION_NAV_TARGET` map: `{ alternatives: "alt-resum", "real-estate": "re-directe", "mercats-publics": "mp-resum" }`.

- [ ] **Step 1: Write the failing test**

```javascript
// test/landingModel.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSectionSummary, buildLandingModel, SECTION_NAV_TARGET } from "../src/data/landingModel.js";

const call = (id, eur) => ({ id, fons: id, cat: "Capital Call", est: "Fons Primari", eur });
const dist = (id, eur) => ({ id, fons: id, cat: "Distribució", est: "Fons Primari", eur });
const compr = (id, eur) => ({ id, fons: id, cat: "Compromís", est: "Fons Primari", eur });

test("buildSectionSummary aggregates invertit, retornat and pending commitment", () => {
  // Arrange
  const tx = [call("A", 100), call("A", 50), dist("A", -30), call("B", 200)];
  const cm = [compr("A", 400)];

  // Act
  const s = buildSectionSummary({ tx, compr: cm, sectionId: "alternatives", label: "Alternatius" });

  // Assert
  assert.equal(s.invertit, 350);
  assert.equal(s.retornat, 30);          // Math.abs of distribution
  assert.equal(s.compromesPendent, 50);  // max(0, 400 - 350)
  assert.equal(s.nPosicions, 2);         // distinct ids A, B
  assert.equal(s.kind, "cashflow");
});

test("compromesPendent floors at zero when calls exceed commitment", () => {
  const s = buildSectionSummary({ tx: [call("A", 500)], compr: [compr("A", 400)], sectionId: "alternatives", label: "Alternatius" });
  assert.equal(s.compromesPendent, 0);
});

test("buildLandingModel excludes sections the user cannot access", () => {
  // Arrange
  const canAccess = (id) => id === "alternatives";
  // Act
  const model = buildLandingModel({
    altTx: [call("A", 100)], altCompr: [compr("A", 100)],
    reTx: [call("R", 999)], reCompr: [],
    pmSummary: { valorActual: 12345, nGestors: 3 },
    canAccess,
  });
  // Assert
  assert.equal(model.cards.length, 1);
  assert.equal(model.cards[0].sectionId, "alternatives");
  assert.equal(model.headline.invertit, 100);   // RE and PM excluded
});

test("headline rolls up only included cash-flow cards", () => {
  const canAccess = () => true;
  const model = buildLandingModel({
    altTx: [call("A", 100)], altCompr: [],
    reTx: [call("R", 400)], reCompr: [],
    pmSummary: { valorActual: 5000, nGestors: 2 },
    canAccess,
  });
  assert.equal(model.headline.invertit, 500);    // 100 + 400, PM not summed
  assert.equal(model.headline.kind, "cashflow");
  assert.equal(model.cards.length, 3);           // alt, re, pm(value)
  assert.equal(model.cards[2].kind, "value");
  assert.equal(model.cards[2].valorActual, 5000);
});

test("PM-only access falls back to a value headline", () => {
  const canAccess = (id) => id === "mercats-publics";
  const model = buildLandingModel({
    altTx: [], altCompr: [], reTx: [], reCompr: [],
    pmSummary: { valorActual: 8000, nGestors: 4 },
    canAccess,
  });
  assert.equal(model.headline.kind, "value");
  assert.equal(model.headline.valorActual, 8000);
  assert.equal(model.cards.length, 1);
});

test("empty input yields zeroed cash-flow summary without throwing", () => {
  const s = buildSectionSummary({ tx: [], compr: [], sectionId: "alternatives", label: "Alternatius" });
  assert.deepEqual(
    { i: s.invertit, r: s.retornat, c: s.compromesPendent, n: s.nPosicions },
    { i: 0, r: 0, c: 0, n: 0 },
  );
});

test("SECTION_NAV_TARGET maps each section to its default nav item", () => {
  assert.equal(SECTION_NAV_TARGET.alternatives, "alt-resum");
  assert.equal(SECTION_NAV_TARGET["real-estate"], "re-directe");
  assert.equal(SECTION_NAV_TARGET["mercats-publics"], "mp-resum");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/landingModel.test.js`
Expected: FAIL — `Cannot find module '../src/data/landingModel.js'`.

- [ ] **Step 3: Write the minimal implementation**

```javascript
// src/data/landingModel.js
const DIST_CATS = new Set(["Distribució", "Retorn Capital"]);

export const SECTION_NAV_TARGET = {
  alternatives: "alt-resum",
  "real-estate": "re-directe",
  "mercats-publics": "mp-resum",
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function countPositions(rows) {
  const ids = new Set();
  for (const r of rows) ids.add(r.id ?? r.fons);
  ids.delete(undefined);
  ids.delete(null);
  return ids.size;
}

export function buildSectionSummary({ tx, compr, sectionId, label }) {
  const txRows = Array.isArray(tx) ? tx : [];
  const comprRows = Array.isArray(compr) ? compr : [];

  const invertit = txRows
    .filter((r) => r.cat === "Capital Call")
    .reduce((s, r) => s + num(r.eur), 0);
  const retornat = txRows
    .filter((r) => DIST_CATS.has(r.cat))
    .reduce((s, r) => s + Math.abs(num(r.eur)), 0);
  const committed = comprRows.reduce((s, r) => s + num(r.eur), 0);
  const compromesPendent = Math.max(0, committed - invertit);
  const nPosicions = countPositions([...txRows, ...comprRows]);

  return {
    sectionId,
    label,
    kind: "cashflow",
    invertit,
    compromesPendent,
    retornat,
    netCashFlow: retornat - invertit,
    nPosicions,
  };
}

export function buildLandingModel({ altTx, altCompr, reTx, reCompr, pmSummary, canAccess }) {
  const allow = typeof canAccess === "function" ? canAccess : () => true;
  const cards = [];

  if (allow("alternatives")) {
    cards.push(buildSectionSummary({ tx: altTx, compr: altCompr, sectionId: "alternatives", label: "Alternatius" }));
  }
  if (allow("real-estate")) {
    cards.push(buildSectionSummary({ tx: reTx, compr: reCompr, sectionId: "real-estate", label: "Real Estate" }));
  }
  if (allow("mercats-publics") && pmSummary) {
    cards.push({
      sectionId: "mercats-publics",
      label: "Mercats Públics",
      kind: "value",
      valorActual: num(pmSummary.valorActual),
      nGestors: num(pmSummary.nGestors),
    });
  }

  const cashCards = cards.filter((c) => c.kind === "cashflow");
  let headline;
  if (cashCards.length > 0) {
    headline = {
      kind: "cashflow",
      invertit: cashCards.reduce((s, c) => s + c.invertit, 0),
      compromesPendent: cashCards.reduce((s, c) => s + c.compromesPendent, 0),
      retornat: cashCards.reduce((s, c) => s + c.retornat, 0),
      nPosicions: cashCards.reduce((s, c) => s + c.nPosicions, 0),
    };
  } else {
    const pmCard = cards.find((c) => c.kind === "value");
    headline = { kind: "value", valorActual: pmCard ? pmCard.valorActual : 0 };
  }

  return { headline, cards };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/landingModel.test.js`
Expected: PASS — 7 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/data/landingModel.js test/landingModel.test.js
git commit -m "feat: add landingModel pure aggregation for section-agnostic landing"
```

---

### Task 2: `LandingTab` presentational component + PM value card

**Files:**
- Create: `src/components/tabs/LandingTab.jsx`
- Create: `src/components/tabs/PmLandingCard.jsx`
- Modify: `src/components/tabs/index.js:1`
- Test: `test/landingTab.test.js`

**Interfaces:**
- Consumes: `buildLandingModel` output (`{ headline, cards }`); `SECTION_NAV_TARGET`; the theme object `tc`; `KpiCard` from `../shared/KpiCard.jsx` (`{ label, value, sub, valueColor, hero, progress, tc }`); the callback `onNavigate(navItemId: string)` (the existing `handleNavigate`); `usePmMonthly` from `../hooks/usePmMonthly.js` (`{ monthly, managerOverrides, loading }`).
- Produces:
  - `LandingTab({ model, tc, onNavigate, pmCard }) => JSX` — pure render; `pmCard` is an already-rendered node or `null`.
  - `PmLandingCard({ tc, onNavigate }) => JSX` (default export) — self-fetches PM value via `usePmMonthly`, renders a value card.
  - Helper `formatEur(n: number) => string` exported from `LandingTab.jsx` for the test.

- [ ] **Step 1: Write the failing test**

```javascript
// test/landingTab.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatEur } from "../src/components/tabs/LandingTab.jsx";

test("formatEur renders whole euros with a euro suffix and no decimals", () => {
  assert.equal(formatEur(1234567), "1.234.567 €");
});

test("formatEur coerces non-finite input to zero", () => {
  assert.equal(formatEur(undefined), "0 €");
  assert.equal(formatEur(NaN), "0 €");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/landingTab.test.js`
Expected: FAIL — cannot find module `../src/components/tabs/LandingTab.jsx`.

> Note: `.jsx` imports run under Node's test runner only if the repo's test setup transpiles JSX. If `node --test` cannot parse JSX (SyntaxError on `<`), move `formatEur` into a plain `.js` sibling `src/components/tabs/landingFormat.js`, import it from both `LandingTab.jsx` and the test, and point this test at the `.js` file. Verify by running the command; pick the path that passes.

- [ ] **Step 3: Write the minimal implementation**

```jsx
// src/components/tabs/PmLandingCard.jsx
import React from "react";
import { usePmMonthly } from "../hooks/usePmMonthly.js";
import { KpiCard } from "../shared/KpiCard.jsx";
import { formatEur } from "./LandingTab.jsx";

const PM_VALUE_FIELDS = ["caixaRV", "caixaRF", "ubsRV", "ubsRF", "abelBK", "andbank"];

export default function PmLandingCard({ tc, onNavigate }) {
  const { monthly, loading } = usePmMonthly();
  const latest = Array.isArray(monthly) && monthly.length ? monthly[monthly.length - 1] : null;
  const valorActual = latest
    ? PM_VALUE_FIELDS.reduce((s, f) => s + (Number(latest[f]) || 0), 0)
    : 0;

  return (
    <button
      type="button"
      onClick={() => onNavigate("mp-resum")}
      style={{ textAlign: "left", border: "none", background: "none", padding: 0, cursor: "pointer", width: "100%" }}
    >
      <KpiCard
        tc={tc}
        label="Mercats Públics — Valor actual"
        value={loading && !latest ? "—" : formatEur(valorActual)}
        sub={latest ? latest.label : null}
      />
    </button>
  );
}
```

```jsx
// src/components/tabs/LandingTab.jsx
import React from "react";
import { KpiCard } from "../shared/KpiCard.jsx";
import { SECTION_NAV_TARGET } from "../../data/landingModel.js";

const EUR_FMT = new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 0 });

export function formatEur(n) {
  const value = Number(n);
  return `${EUR_FMT.format(Number.isFinite(value) ? value : 0)} €`;
}

function HeadlineStrip({ headline, tc }) {
  const items = headline.kind === "value"
    ? [{ label: "Valor actual", value: formatEur(headline.valorActual) }]
    : [
        { label: "Total Invertit", value: formatEur(headline.invertit) },
        { label: "Compromès pendent", value: formatEur(headline.compromesPendent) },
        { label: "Total Retornat", value: formatEur(headline.retornat) },
        { label: "# posicions", value: String(headline.nPosicions) },
      ];
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      {items.map((it, i) => (
        <KpiCard key={it.label} tc={tc} hero={i === 0} label={it.label} value={it.value} />
      ))}
    </div>
  );
}

function CashflowCard({ card, tc, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(SECTION_NAV_TARGET[card.sectionId])}
      style={{ textAlign: "left", border: "none", background: "none", padding: 0, cursor: "pointer", width: "100%" }}
    >
      <KpiCard
        tc={tc}
        label={card.label}
        value={formatEur(card.invertit)}
        sub={`${formatEur(card.retornat)} retornat · ${card.nPosicions} posicions`}
      />
    </button>
  );
}

export function LandingTab({ model, tc, onNavigate, pmCard }) {
  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: tc.navy, margin: "0 0 20px" }}>Inici</h1>
      <HeadlineStrip headline={model.headline} tc={tc} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {model.cards
          .filter((c) => c.kind === "cashflow")
          .map((c) => <CashflowCard key={c.sectionId} card={c} tc={tc} onNavigate={onNavigate} />)}
        {pmCard}
      </div>
    </div>
  );
}
```

```javascript
// src/components/tabs/index.js
export { ResumTab } from "./ResumTab.jsx";
export { LandingTab } from "./LandingTab.jsx";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/landingTab.test.js`
Expected: PASS — 2 tests. (If JSX fails to parse, apply the Step 2 note and re-run.)

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/LandingTab.jsx src/components/tabs/PmLandingCard.jsx src/components/tabs/index.js test/landingTab.test.js
git commit -m "feat: add LandingTab and PM value card for section-agnostic landing"
```

---

### Task 3: Default tab → `home` + sidebar "Inici" entry

**Files:**
- Modify: `src/components/hooks/useTabRouter.js:33` (default tab), `:50-75` (handleNavigate `home` case), `:5` (export + `home` branch in `normalizeNavState`)
- Modify: `src/components/Sidebar.jsx` (add "Inici" nav item, active on `home`)
- Test: `test/useTabRouter.test.js` (create if absent; otherwise append)

**Interfaces:**
- Consumes: existing `handleNavigate(itemId)` switch and `setTab`.
- Produces: default `tab === "home"` when no `?tab=` param; `handleNavigate("home")` sets `tab` to `"home"`; `normalizeNavState` returns `"home"` when `tab === "home"`.

- [ ] **Step 1: Write the failing test**

```javascript
// test/useTabRouter.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeNavState } from "../src/components/hooks/useTabRouter.js";

test("normalizeNavState maps the home tab to the home nav item", () => {
  assert.equal(normalizeNavState({ tab: "home" }), "home");
});

test("normalizeNavState still maps inversions/resum to alt-resum", () => {
  assert.equal(normalizeNavState({ tab: "inversions", inversionsSubTab: "resum" }), "alt-resum");
});
```

> `normalizeNavState` is not currently exported. Step 3 adds `export` to its declaration (it is a pure function; exporting it is safe).

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/useTabRouter.test.js`
Expected: FAIL — `normalizeNavState is not a function` (not yet exported), or the `home` assertion fails (returns `null`).

- [ ] **Step 3: Write the minimal implementation**

In `src/components/hooks/useTabRouter.js`, export and extend `normalizeNavState` (line 5):

```javascript
export function normalizeNavState({ tab, inversionsSubTab, realEstateTab, mercatsPublicsTab, activeNavItem }) {
  if (tab === "home") return "home";
  if (tab === "real-estate") {
```

Change the default tab (line 33) from:

```javascript
  const tab = searchParams.get("tab") ?? "resum";
```

to:

```javascript
  const tab = searchParams.get("tab") ?? "home";
```

Add a `home` case at the top of the `handleNavigate` switch (right after `setActiveNavItem(itemId);`):

```javascript
      case "home":           setTab("home"); break;
```

In `src/components/Sidebar.jsx`, add an always-visible top nav item that calls `onNavigate("home")` and renders active when `activeNavItem === "home"`. Follow the existing nav-item markup pattern in that file (same button/label styling used for other top-level items); label text is `Inici`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/useTabRouter.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/hooks/useTabRouter.js src/components/Sidebar.jsx test/useTabRouter.test.js
git commit -m "feat: default to home tab and add Inici sidebar entry"
```

---

### Task 4: Wire `LandingTab` into `Dashboard`

**Files:**
- Modify: `src/components/Dashboard.jsx` (imports, `landingModel` memo, `home` render branch, lazy PM card, header title at `:509`, render branch before `:533`)

**Interfaces:**
- Consumes: `altAllTx` / `altAllCompr` (already destructured at `Dashboard.jsx:337-338` — the full Alternatius scope: primary/secondary/coinvestment fund flows + searchers + participades, RE and PM excluded); `d.reTx`, `d.reCompr`, `d.isLoading`; `canAccessSection` (already destructured at `Dashboard.jsx:91`); `handleNavigate`; `tc`.
- Produces: renders `<LandingTab />` when `tab === "home"`.

- [ ] **Step 1: Add imports (top of `Dashboard.jsx`, with the other tab imports)**

```jsx
import { LandingTab } from "./tabs/index.js";
import { buildLandingModel } from "../data/landingModel.js";
const PmLandingCard = React.lazy(() => import("./tabs/PmLandingCard.jsx"));
```

- [ ] **Step 2: Compute the landing model (near the other `useMemo` blocks, after `d` is available)**

```jsx
const landingModel = React.useMemo(() => buildLandingModel({
  altTx: altAllTx,
  altCompr: altAllCompr,
  reTx: d.reTx,
  reCompr: d.reCompr,
  pmSummary: canAccessSection("mercats-publics") ? { valorActual: 0, nGestors: 0 } : null,
  canAccess: canAccessSection,
}), [altAllTx, altAllCompr, d.reTx, d.reCompr, canAccessSection]);
```

> `pmSummary.valorActual` here only decides whether the PM **card** is included; the real PM value is rendered inside the lazy `PmLandingCard`. Passing a non-null placeholder when PM is accessible keeps the card in the grid.

- [ ] **Step 3: Add the render branch as the FIRST child inside `<main id="dashboard-content">` (before `{tab === "resum" && ...}` at `Dashboard.jsx:533`)**

```jsx
{tab === "home" && (
  <LandingTab
    model={landingModel}
    tc={tc}
    onNavigate={handleNavigate}
    pmCard={canAccessSection("mercats-publics")
      ? <React.Suspense fallback={null}><PmLandingCard tc={tc} onNavigate={handleNavigate} /></React.Suspense>
      : null}
  />
)}
```

- [ ] **Step 4: Update the header title (`Dashboard.jsx:509`) so `home` reads "Inici"**

Prepend to the ternary chain:

```jsx
{tab === "home" ? "Inici" : (tab === "mercats-publics" || tab === "tx-mp") ? "Mercats Públics" : /* ...unchanged rest of the existing ternary... */}
```

- [ ] **Step 5: Verify the build and full test suite**

Run: `npm test`
Expected: PASS — existing suite plus the three new test files green.

Run: `npm run build`
Expected: build succeeds, no unresolved imports for `LandingTab` / `PmLandingCard` / `landingModel`.

- [ ] **Step 6: Manual smoke check**

Run: `npm run dev`, open the app. Expected: opens on "Inici"; headline strip + one card per accessible section; clicking a card routes into that section; sidebar highlights "Inici". Deep link `?tab=inversions` still opens Alternatius directly.

- [ ] **Step 7: Commit**

```bash
git add src/components/Dashboard.jsx
git commit -m "feat: render Inici landing tab as the default view"
```

---

## Self-Review

**Spec coverage:**
- Default view on open → Task 3 (default `tab = "home"`) + Task 4 (render branch). ✓
- Portfolio-wide headline aggregated across accessible sections → Task 1 (`buildLandingModel.headline`). ✓
- One card per accessible top-level section, click-through → Task 1 (`cards`) + Task 2 (`CashflowCard`/`PmLandingCard` `onNavigate`). ✓
- Permission filtering (hidden entirely) → Task 1 (`canAccess` gate) + Task 4 (PM card only mounts with access). ✓
- No new API / no migration → satisfied; PM value via existing `usePmMonthly`. ✓
- Error/empty handling → Task 1 (defensive defaults, zeros) + Task 2 (`—` placeholder while loading). ✓
- PM is value-based, not cash-flow → Task 1 (`kind: "value"` card + value headline fallback) + Task 2 (`PmLandingCard`). ✓ (refinement over the spec's uniform-card framing; flagged to Roberto.)

**Placeholder scan:** No TBD/TODO. `pmSummary: { valorActual: 0, nGestors: 0 }` in Task 4 Step 2 is an intentional inclusion flag, explained inline — the displayed value comes from `PmLandingCard`.

**Type consistency:** `buildSectionSummary`/`buildLandingModel`/`SECTION_NAV_TARGET` names and the `{ headline, cards }` shape are identical across Tasks 1, 2, 4. `formatEur` defined in Task 2, imported by `PmLandingCard`. `onNavigate` targets (`alt-resum`, `re-directe`, `mp-resum`) match `handleNavigate` cases in `useTabRouter.js`. ✓

**Alternatius scope (confirmed):** the roll-up uses `altAllTx`/`altAllCompr` — the full Alternatius scope including primary, secondary, fund-of-funds and coinvestment flows, plus searchers and participades (RE and PM excluded). This is the same row set the "Totes les Transaccions (Alternatius)" view uses, so the headline matches that section's totals.
