# Chart Color Palette — Design Spec

**Date:** 2026-05-07  
**Status:** Approved

## Problem

Chart colors are defined in at least 8 separate places, with duplication and drift between files:

- `GEO_COLORS` (9-color array) appears identically in `SearcherCharts.jsx` and `PortfolioCompaniesTab.jsx`
- `MGR_COLORS` (manager→color map) is defined independently in `CumulativeFlowsChart.jsx`, `PublicMarketsShared.jsx`, and `PublicMarketsSummarySection.jsx` with slight inconsistencies
- `SANKEY_NODE_COLORS` is duplicated between `SearchersTab.jsx` and `SearchersBadges.jsx`
- `PM_COLORS`, `TOP5_COLORS`, `ASSET_COLORS` are local arrays with no shared source
- A handful of semantic roles use hardcoded hex values instead of TC theme tokens

## Goals

1. Single source of truth for every reusable color constant
2. Brand-derived categorical palette (navy/green family) replacing ad-hoc arrays
3. Semantic colors anchored to TC theme tokens everywhere (no hardcoded hex for roles)
4. No visible change to the application — this is a code organisation task

## Non-goals

- Dark-mode variants of categorical colors (categorical charts don't currently adapt per-theme and that is acceptable)
- Changing manager identity colors (custodian brand associations must stay stable)
- Touching `config.js` SCOL/GCOL/CCOL/SECCOL pipeline configs that already use TC tokens correctly

## Approach: `src/chartColors.js`

New dedicated module. Three named exports:

### `CHART_PALETTE`

9-color brand-derived categorical palette. Order chosen for maximum perceptual separation when cycling:

```js
export const CHART_PALETTE = [
  "#2B5070", // navy
  "#3DC83E", // green
  "#4A789A", // navyLight
  "#28A029", // greenDark
  "#1C3A52", // navyDark
  "#62D963", // greenLight
  "#6A4C8A", // purple
  "#C62828", // red
  "#B8860B", // yellow
];
```

Used for: geographic region series, fund position series, any chart cycling through unnamed categories.

### `MGR_COLORS`

Canonical manager/custodian identity map. Deduped from three current sources:

```js
export const MGR_COLORS = {
  caixa:                "#2B5070",
  ubs:                  "#4A789A",
  creditSuisse:         "#C46B5A",
  bankinter:            "#3DC83E",
  interactiveBrokers:   "#62D963",
  andbank:              "#6A4C8A",
  jpmorgan:             "#B8860B",
  abel:                 "#3DC83E",
  altres:               "#9AA4B2",
};
```

Note: `ubs` changes from `#4E79A7` → `#4A789A` (navyLight) for brand consistency. `creditSuisse` kept as `#C46B5A` (institution-specific warm tone with no brand equivalent).

### `SANKEY_NODE_COLORS`

Node colors for the searcher Sankey diagram. Shared between `SearchersTab.jsx` and `SearchersBadges.jsx`:

```js
export const SANKEY_NODE_COLORS = {
  Searchers:      "#2B5070",
  "Equity Gap":   "#6A4C8A",
  Cercant:        "#28A029",
  "Acabat Cerca": "#1C3A52",
  Portafoli:      "#4A789A",
  Operant:        "#2B5070",
};
```

## Files Changed

| File | Change |
|---|---|
| `src/chartColors.js` | **Created** |
| `src/components/SearcherCharts.jsx` | `GEO_COLORS` → `CHART_PALETTE` |
| `src/components/PortfolioCompaniesTab.jsx` | `GEO_COLORS` → `CHART_PALETTE`; `ORIG_COLORS` values mapped from `CHART_PALETTE` indices |
| `src/components/PMTipusTab.jsx` | `PM_COLORS` → `CHART_PALETTE` |
| `src/components/CumulativeFlowsChart.jsx` | `MGR_COLORS` → import; `TOP5_COLORS` → `CHART_PALETTE.slice(0,5)` |
| `src/components/PublicMarketsShared.jsx` | `MGR_COLORS` → import; `AREA_COLORS` manager slots keyed to imported `MGR_COLORS` |
| `src/components/PublicMarketsSummarySection.jsx` | `MGR_COLORS` + `AREA_COLORS` → imports |
| `src/components/SearchersTab.jsx` | `SANKEY_NODE_COLORS` → import |
| `src/components/SearchersBadges.jsx` | `SANKEY_NODE_COLORS` → import |
| `src/components/PipelineFY26.jsx` | `SECCOL` hardcoded `#7A5A8A`→`TC.purple`, `#28A029`→`TC.greenDark`; `STCOL` `#B8860B`→`TC.yellow`, `#2E7D32`→`TC.greenDark`, `#C62828`→`TC.red` |
| `src/components/PriceHistoryChart.jsx` | Hardcoded `#4E79A7` bar color → `CHART_PALETTE[0]` |

## Verification

`npm run verify` catches unused exports via knip and validates the build. No new tests needed — color constants have no logic to test.
