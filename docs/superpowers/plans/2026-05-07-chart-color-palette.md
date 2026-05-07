# Chart Color Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralise all chart color constants into `src/chartColors.js` and fix remaining hardcoded hex values in semantic roles.

**Architecture:** Create one new module (`src/chartColors.js`) that exports `CHART_PALETTE`, `MGR_COLORS`, and `SANKEY_NODE_COLORS`. Ten existing files import from it and delete their local copies. Semantic colors in `config.js` are updated to use `TC` tokens. No runtime behaviour changes — only constant sources move.

**Tech Stack:** React, ECharts (ReactECharts wrapper), Vite build. Verify with `npm run verify` (tests + build + knip + madge).

---

### Task 1: Create `src/chartColors.js`

**Files:**
- Create: `src/chartColors.js`

- [ ] **Step 1: Create the file**

```js
// src/chartColors.js
// Single source of truth for all reusable chart color constants.

import { TC_LIGHT } from "./theme.js";

/** 9-color brand-derived categorical palette.
 *  Order chosen for maximum perceptual separation when cycling. */
export const CHART_PALETTE = [
  TC_LIGHT.navy,       // #2B5070
  TC_LIGHT.green,      // #3DC83E
  TC_LIGHT.navyLight,  // #4A789A
  TC_LIGHT.greenDark,  // #28A029
  TC_LIGHT.navyDark,   // #1C3A52
  TC_LIGHT.greenLight, // #62D963
  TC_LIGHT.purple,     // #6A4C8A
  TC_LIGHT.red,        // #C62828
  TC_LIGHT.yellow,     // #B8860B
];

/** Canonical manager/custodian identity colors.
 *  Keys match the lowercase manager slugs used throughout the PM data layer. */
export const MGR_COLORS = {
  caixa:              TC_LIGHT.navy,       // #2B5070
  ubs:                TC_LIGHT.navyLight,  // #4A789A
  creditSuisse:       "#C46B5A",           // institution-specific warm tone
  bankinter:          TC_LIGHT.green,      // #3DC83E
  interactiveBrokers: TC_LIGHT.greenLight, // #62D963
  andbank:            TC_LIGHT.purple,     // #6A4C8A
  jpmorgan:           TC_LIGHT.yellow,     // #B8860B
  abel:               TC_LIGHT.green,      // #3DC83E
  altres:             "#9AA4B2",           // neutral grey — no brand equivalent
};

/** Node colors for the Searcher Sankey diagram.
 *  Shared between SearchersTab and SearchersBadges. */
export const SANKEY_NODE_COLORS = {
  Searchers:      TC_LIGHT.navy,      // #2B5070
  "Equity Gap":   TC_LIGHT.purple,    // #6A4C8A
  Cercant:        TC_LIGHT.greenDark, // #28A029
  "Acabat Cerca": TC_LIGHT.navyDark,  // #1C3A52
  Portafoli:      TC_LIGHT.navyLight, // #4A789A
  Operant:        TC_LIGHT.navy,      // #2B5070
};
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: `✓ built in ...`

- [ ] **Step 3: Commit**

```bash
git add src/chartColors.js
git commit -m "feat: add chartColors.js — single source of truth for chart color constants"
```

---

### Task 2: Update `SearcherCharts.jsx`

**Files:**
- Modify: `src/components/SearcherCharts.jsx` line 6

- [ ] **Step 1: Replace local `GEO_COLORS`**

Remove line 6:
```js
const GEO_COLORS = ["#2B5070","#3DC83E","#6A4C8A","#B8860B","#C62828","#1C6B1D","#2563A8","#8A6400","#007A8A"];
```

Add import at top of file (after line 4):
```js
import { CHART_PALETTE } from "../chartColors.js";
```

Replace every occurrence of `GEO_COLORS` in the file with `CHART_PALETTE`. There are two usages: in `SearcherGeoPieChart` and `SearcherGeoBarChart`, both in `data:` arrays mapping `(d, i) => GEO_COLORS[i % GEO_COLORS.length]` → change to `CHART_PALETTE[i % CHART_PALETTE.length]`.

- [ ] **Step 2: Verify**

```bash
npm run verify
```

Expected: 56 tests pass, clean build, no knip warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/SearcherCharts.jsx
git commit -m "refactor: SearcherCharts uses CHART_PALETTE from chartColors.js"
```

---

### Task 3: Update `SearchersBadges.jsx`

`SearchersTab.jsx` already imports `SANKEY_NODE_COLORS` from `SearchersBadges.jsx`, so updating the badge file fixes both.

**Files:**
- Modify: `src/components/SearchersBadges.jsx` lines 5–12

- [ ] **Step 1: Replace local `SANKEY_NODE_COLORS`**

Add import after line 3:
```js
import { SANKEY_NODE_COLORS as _SANKEY_NODE_COLORS } from "../chartColors.js";
```

Replace the entire block (lines 5–12):
```js
export const SANKEY_NODE_COLORS = {
  "Searchers":    "#2563A8",
  "Equity Gap":   "#6B2E7E",
  "Cercant":      "#27A55A",
  "Acabat Cerca": "#145230",
  "Portafoli":    "#5A3E9A",
  "Operant":      "#2B5070",
};
```

With:
```js
export const SANKEY_NODE_COLORS = _SANKEY_NODE_COLORS;
```

- [ ] **Step 2: Verify**

```bash
npm run verify
```

Expected: 56 tests pass, clean build, no knip warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/SearchersBadges.jsx
git commit -m "refactor: SearchersBadges uses SANKEY_NODE_COLORS from chartColors.js"
```

---

### Task 4: Update `PortfolioCompaniesTab.jsx`

**Files:**
- Modify: `src/components/PortfolioCompaniesTab.jsx` lines 14–19

- [ ] **Step 1: Replace `ORIG_COLORS` and `GEO_COLORS`**

Add import after line 6:
```js
import { CHART_PALETTE } from "../chartColors.js";
```

Replace lines 14–19:
```js
const ORIG_COLORS = {
  "Equity Gap":    "#3DC83E",
  "Search Capital":"#2B5070",
  "Direct PE":     "#6A4C8A",
};
const GEO_COLORS = ["#2B5070","#3DC83E","#6A4C8A","#B8860B","#C62828","#1C6B1D","#2563A8","#8A6400","#007A8A"];
```

With:
```js
const ORIG_COLORS = {
  "Equity Gap":    CHART_PALETTE[1],  // green
  "Search Capital": CHART_PALETTE[0], // navy
  "Direct PE":     CHART_PALETTE[6],  // purple
};
const GEO_COLORS = CHART_PALETTE;
```

- [ ] **Step 2: Verify**

```bash
npm run verify
```

Expected: 56 tests pass, clean build, no knip warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/PortfolioCompaniesTab.jsx
git commit -m "refactor: PortfolioCompaniesTab uses CHART_PALETTE from chartColors.js"
```

---

### Task 5: Update `PMTipusTab.jsx`

**Files:**
- Modify: `src/components/PMTipusTab.jsx` lines 20–24

- [ ] **Step 1: Replace `PM_COLORS`**

Add import after existing imports (after the last import line):
```js
import { CHART_PALETTE } from "../chartColors.js";
```

Remove lines 20–24:
```js
const PM_COLORS = [
  "#4E79A7","#F28E2B","#E15759","#76B7B2","#59A14F",
  "#EDC948","#B07AA1","#FF9DA7","#9C755F","#BAB0AC",
  "#D37295","#A0CBE8",
];
```

Then find all usages of `PM_COLORS` in the file and replace with `CHART_PALETTE`. The palette has 9 entries — any index ≥ 9 will wrap with `% CHART_PALETTE.length`. Check if the existing code already uses modulo; if it accesses by index directly (e.g. `PM_COLORS[i]`), change to `CHART_PALETTE[i % CHART_PALETTE.length]`.

- [ ] **Step 2: Verify**

```bash
npm run verify
```

Expected: 56 tests pass, clean build, no knip warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/PMTipusTab.jsx
git commit -m "refactor: PMTipusTab uses CHART_PALETTE from chartColors.js"
```

---

### Task 6: Update `CumulativeFlowsChart.jsx`

**Files:**
- Modify: `src/components/CumulativeFlowsChart.jsx` lines 50–54

- [ ] **Step 1: Replace `MGR_COLORS` and `TOP5_COLORS`**

Add import after existing imports:
```js
import { MGR_COLORS, CHART_PALETTE } from "../chartColors.js";
```

Remove line 50:
```js
const MGR_COLORS = { caixa: "#2B5070", ubs: "#4E79A7", creditSuisse: "#C46B5A", bankinter: "#3DC83E", interactiveBrokers: "#7BC96F", andbank: "#6B2E7E", jpmorgan: "#8A6D3B", altres: "#BAB0AC" };
```

Remove line 54:
```js
const TOP5_COLORS  = ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F"];
```

Where `TOP5_COLORS` is used in the file, replace with `CHART_PALETTE.slice(0, 5)` or, if used as `TOP5_COLORS[i]`, replace with `CHART_PALETTE[i]`.

Leave `ASSET_COLORS` (`{ RV: "#2B5070", RF: "#F28E2B" }`) unchanged — it encodes a semantic role (RF = fixed income amber) not covered by the categorical palette.

- [ ] **Step 2: Verify**

```bash
npm run verify
```

Expected: 56 tests pass, clean build, no knip warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/CumulativeFlowsChart.jsx
git commit -m "refactor: CumulativeFlowsChart uses MGR_COLORS + CHART_PALETTE from chartColors.js"
```

---

### Task 7: Update `PublicMarketsShared.jsx`

`PublicMarketsSummarySection.jsx` imports `MGR_COLORS` and `AREA_COLORS` from this file — updating it fixes both.

**Files:**
- Modify: `src/components/publicMarkets/PublicMarketsShared.jsx` lines 19–42

- [ ] **Step 1: Import from chartColors and update `MGR_COLORS` + `AREA_COLORS`**

Add import after line 1 (`import React from "react";`):
```js
import { MGR_COLORS as _MGR_COLORS } from "../../chartColors.js";
```

Replace lines 19–32 (`AREA_COLORS`) and lines 34–42 (`MGR_COLORS`):

```js
export const MGR_COLORS = _MGR_COLORS;

export const AREA_COLORS = {
  total: "#2B5070",
  rv:    "#2B5070",
  rf:    "#E8A020",
  ...MGR_COLORS,
};
```

This spreads all manager keys from the canonical `MGR_COLORS` into `AREA_COLORS`, replacing the eight previously duplicated entries.

- [ ] **Step 2: Verify**

```bash
npm run verify
```

Expected: 56 tests pass, clean build, no knip warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/publicMarkets/PublicMarketsShared.jsx
git commit -m "refactor: PublicMarketsShared uses MGR_COLORS from chartColors.js"
```

---

### Task 8: Fix semantic hardcoded hex in `config.js`

**Files:**
- Modify: `src/config.js` lines 88–90

- [ ] **Step 1: Update `SECCOL` and `STCOL` to use TC tokens**

Line 88 — replace:
```js
export const SECCOL= {Software:TC.navy,Generalista:TC.green,"B2B Services":TC.greenDark,Healthcare:"#7A5A8A","Software / B2B":TC.greenLight};
```
With:
```js
export const SECCOL= {Software:TC.navy,Generalista:TC.green,"B2B Services":TC.greenDark,Healthcare:TC.purple,"Software / B2B":TC.greenLight};
```

Line 89 — replace:
```js
export const STCOL = {"En estudi":"#B8860B","Aprovat":"#2E7D32","Descartat":"#C62828"};
```
With:
```js
export const STCOL = {"En estudi":TC.yellow,"Aprovat":TC.greenDark,"Descartat":TC.red};
```

Line 90 — replace:
```js
export const CCOL  = {"Arcano":TC.navy,"Placement Agent":TC.green,"Propietari":TC.navyLight,"Altres":"#6A4C8A"};
```
With:
```js
export const CCOL  = {"Arcano":TC.navy,"Placement Agent":TC.green,"Propietari":TC.navyLight,"Altres":TC.purple};
```

- [ ] **Step 2: Verify**

```bash
npm run verify
```

Expected: 56 tests pass, clean build, no knip warnings.

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "refactor: config.js SECCOL/STCOL/CCOL use TC tokens instead of hardcoded hex"
```

---

### Task 9: Fix `PriceHistoryChart.jsx` bar color

**Files:**
- Modify: `src/components/PriceHistoryChart.jsx` line 195

- [ ] **Step 1: Replace hardcoded bar color**

Add import after existing imports:
```js
import { CHART_PALETTE } from "../chartColors.js";
```

Find line 195:
```js
itemStyle: { color: "#4E79A7", opacity: 0.55, borderRadius: [3, 3, 0, 0] },
```

Replace with:
```js
itemStyle: { color: CHART_PALETTE[0], opacity: 0.55, borderRadius: [3, 3, 0, 0] },
```

(`CHART_PALETTE[0]` is navy `#2B5070`, consistent with cumulative inflow bars elsewhere.)

- [ ] **Step 2: Verify**

```bash
npm run verify
```

Expected: 56 tests pass, clean build, no knip warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/PriceHistoryChart.jsx
git commit -m "refactor: PriceHistoryChart uses CHART_PALETTE for bar color"
```

---

### Task 10: Final verify and deploy

- [ ] **Step 1: Full verify**

```bash
npm run verify
```

Expected: 56 tests pass, `✓ No circular dependency found!`, knip clean.

- [ ] **Step 2: Deploy**

```bash
vercel --prod
```

Expected: `Aliased: https://turtle-capital-dashboard.vercel.app`
